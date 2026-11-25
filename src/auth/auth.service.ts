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

export interface PublicUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  createdAt: Date;
}

@Injectable()
export class AuthService {
  // Hashed once at startup. Login for an unknown email compares against it,
  // so "no such user" costs the same time as "wrong password".
  private readonly dummyHash: Promise<string>;

  constructor(
    private readonly users: UsersService,
    private readonly jwt: JwtService,
    private readonly config: AppConfigService,
  ) {
    this.dummyHash = bcrypt.hash(randomUUID(), this.config.bcryptSaltRounds);
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

  async login(dto: LoginDto): Promise<{ accessToken: string; user: PublicUser }> {
    const user = await this.users.findByEmail(dto.email);
    const hash = user ? user.passwordHash : await this.dummyHash;
    const passwordMatches = await bcrypt.compare(dto.password, hash);

    if (!user || !passwordMatches) {
      throw new UnauthorizedException('Invalid email or password');
    }

    return {
      accessToken: await this.signAccessToken(user),
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
}