import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';
import type { Role, User } from '../../generated/prisma/client';
import type { JwtPayload } from '../common/interfaces/jwt-payload.interface';
import { AppConfigService } from '../config/config.service';
import { UsersService } from '../users/users.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { Logger } from '@nestjs/common';
import { generateOpaqueToken, sha256Hex } from '../common/utils/crypto.util';
import { durationToMs } from '../common/utils/duration.util';
import { RefreshTokensRepository } from './refresh-tokens.repository';
import { blacklistKey } from '../common/constants/redis-keys';
import type { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface';
import { RedisService } from '../redis/redis.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { publishAudit } from '../common/events/publish.util';

export interface PublicUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  createdAt: Date;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

@Injectable()
export class AuthService {
  // Hashed once at startup. Login for an unknown email compares against it,
  // so "no such user" costs the same time as "wrong password".
  private readonly dummyHash: Promise<string>;
  private readonly logger = new Logger(AuthService.name);
  private readonly refreshTtlMs: number;

  constructor(
    private readonly users: UsersService,
    private readonly refreshTokens: RefreshTokensRepository,
    private readonly redis: RedisService,
    private readonly jwt: JwtService,
    private readonly config: AppConfigService,
    private readonly emitter: EventEmitter2,
  ) {
    this.dummyHash = bcrypt.hash(randomUUID(), this.config.bcryptSaltRounds);
    this.refreshTtlMs = durationToMs(this.config.jwtRefreshExpiresIn);
  }

  async register(dto: RegisterDto): Promise<PublicUser> {
    const passwordHash = await bcrypt.hash(
      dto.password,
      this.config.bcryptSaltRounds,
    );
    const user = await this.users.create({
      name: dto.name,
      email: dto.email,
      passwordHash,
      role: dto.role,
    });
    return this.toPublicUser(user);
  }

  async login(dto: LoginDto): Promise<AuthTokens & { user: PublicUser }> {
    const user = await this.users.findByEmail(dto.email);
    const hash = user ? user.passwordHash : await this.dummyHash;
    const passwordMatches = await bcrypt.compare(dto.password, hash);

    if (!user || !passwordMatches) {
      throw new UnauthorizedException('Invalid email or password');
    }

    return {
      accessToken: await this.signAccessToken(user),
      refreshToken: await this.issueRefreshToken(user.id, randomUUID()),
      user: this.toPublicUser(user),
    };
  }

  private signAccessToken(user: User): Promise<string> {
    const payload: Omit<JwtPayload, 'iat' | 'exp'> = {
      sub: user.id,
      email: user.email,
      role: user.role,
      jti: randomUUID(),
    };
    return this.jwt.signAsync(payload);
  }

  // Explicit allow-list: passwordHash can never leak by accident.
  private toPublicUser(user: User): PublicUser {
    const { id, name, email, role, createdAt } = user;
    return { id, name, email, role, createdAt };
  }

    /**
   * Rotates a refresh token: the presented token is consumed and a new pair is issued
   * in the same family. Presenting an already-used token revokes the whole family.
   */
  async refresh(rawToken: string): Promise<AuthTokens> {
    const tokenHash = sha256Hex(rawToken);
    const claimed = await this.refreshTokens.claim(tokenHash, new Date());

    if (!claimed) {
      const existing = await this.refreshTokens.findByHash(tokenHash);
      if (existing?.usedAt) {
        const revoked = await this.refreshTokens.deleteFamily(existing.familyId);
        this.logger.warn(
          `Refresh token reuse detected: user=${existing.userId} family=${existing.familyId}; family revoked`,
        );
        publishAudit(this.emitter, {
          userId: existing.userId,
          entityType: 'RefreshTokenFamily',
          entityId: existing.familyId,
          action: 'REFRESH_TOKEN_REUSE',
          before: null,
          after: { revokedTokens: revoked },
        });
      }
      throw new UnauthorizedException('Invalid refresh token');
    }

    // We won the claim, so the row exists and nobody else can use it.
    const row = (await this.refreshTokens.findByHash(tokenHash))!;
    const user = await this.users.findById(row.userId);

    if (!user) {
      await this.refreshTokens.deleteFamily(row.familyId);
      throw new UnauthorizedException('Invalid refresh token');
    }

    return {
      accessToken: await this.signAccessToken(user),
      refreshToken: await this.issueRefreshToken(user.id, row.familyId),
    };
  }

  /**
   * Ends a session: revokes the caller's refresh-token family first (the long-lived
   * credential), then blacklists the current access token until it would expire anyway.
   */
  async logout(user: AuthenticatedUser, rawRefreshToken: string): Promise<void> {
    const row = await this.refreshTokens.findByHash(sha256Hex(rawRefreshToken));

    // Foreign or unknown tokens are ignored, which keeps logout idempotent.
    if (row && row.userId === user.id) {
      await this.refreshTokens.deleteFamily(row.familyId);
    }

    const ttlSeconds = user.exp - Math.floor(Date.now() / 1000);
    if (ttlSeconds > 0) {
      await this.redis.setWithExpiry(blacklistKey(user.jti), '1', ttlSeconds);
    }
  }

  /** Creates an opaque token, stores only its hash, and returns the raw value once. */
  private async issueRefreshToken(userId: string, familyId: string): Promise<string> {
    const raw = generateOpaqueToken();
    await this.refreshTokens.create({
      tokenHash: sha256Hex(raw),
      familyId,
      userId,
      expiresAt: new Date(Date.now() + this.refreshTtlMs),
    });
    return raw;
  }
}