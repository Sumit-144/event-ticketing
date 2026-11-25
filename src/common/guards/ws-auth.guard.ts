import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { WsException } from '@nestjs/websockets';
import type { Socket } from 'socket.io';
import { AppConfigService } from '../../config/config.service';
import type { AuthenticatedUser } from '../interfaces/authenticated-user.interface';
import type { JwtPayload } from '../interfaces/jwt-payload.interface';
import { blacklistKey } from '../constants/redis-keys';
import { RedisService } from '../../redis/redis.service';

@Injectable()
export class WsAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly config: AppConfigService,
    private readonly redis: RedisService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const client = context.switchToWs().getClient<Socket>();

    if (!client.data.user) {
      client.data.user = await this.authenticate(client);
    }

    return true;
  }

  /** Verifies the handshake token the same way HTTP does, including the revocation check. */
  async authenticate(client: Socket): Promise<AuthenticatedUser> {
    const token = this.extractToken(client);

    if (!token) {
      throw new WsException('Missing access token');
    }

    let payload: JwtPayload;
    try {
      payload = await this.jwtService.verifyAsync<JwtPayload>(token, {
        secret: this.config.jwtAccessSecret,
        algorithms: ['HS256'],
      });
    } catch {
      throw new WsException('Invalid or expired access token');
    }

    if (!payload.jti || !payload.exp) {
      throw new WsException('Invalid or expired access token');
    }

    // Fails closed: if Redis is down this throws instead of letting a revoked token in.
    if (await this.redis.exists(blacklistKey(payload.jti))) {
      throw new WsException('Token has been revoked');
    }

    return {
      id: payload.sub,
      email: payload.email,
      role: payload.role,
      jti: payload.jti,
      exp: payload.exp,
    };
  }

  private extractToken(client: Socket): string | undefined {
    const { auth, headers, query } = client.handshake;

    if (typeof auth?.token === 'string') {
      return auth.token;
    }

    const [type, value] = headers.authorization?.split(' ') ?? [];
    if (type === 'Bearer' && value) {
      return value;
    }

    if (typeof query?.token === 'string') {
      return query.token;
    }

    return undefined;
  }
}