import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { WsException } from '@nestjs/websockets';
import type { Socket } from 'socket.io';
import { AppConfigService } from '../../config/config.service';
import type { AuthenticatedUser } from '../interfaces/authenticated-user.interface';
import type { JwtPayload } from '../interfaces/jwt-payload.interface';

@Injectable()
export class WsAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly config: AppConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const client = context.switchToWs().getClient<Socket>();

    if (!client.data.user) {
      client.data.user = await this.authenticate(client);
    }

    return true;
  }

  async authenticate(client: Socket): Promise<AuthenticatedUser> {
    const token = this.extractToken(client);

    if (!token) {
      throw new WsException('Missing access token');
    }

    try {
      const payload = await this.jwtService.verifyAsync<JwtPayload>(token, {
        secret: this.config.jwtAccessSecret,
      });

      return { id: payload.sub, email: payload.email, role: payload.role };
    } catch {
      throw new WsException('Invalid or expired access token');
    }
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