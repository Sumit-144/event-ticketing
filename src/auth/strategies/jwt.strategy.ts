import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AppConfigService } from '../../config/config.service';
import { RedisService } from '../../redis/redis.service';
import { blacklistKey } from '../../common/constants/redis-keys';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import type { JwtPayload } from '../../common/interfaces/jwt-payload.interface';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: AppConfigService,
    private readonly redis: RedisService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.jwtAccessSecret,
      algorithms: ['HS256'],
    });
  }

  // Runs only after Passport has verified signature and expiry.
  async validate(payload: JwtPayload): Promise<AuthenticatedUser> {
    if (!payload.jti || !payload.exp) {
      throw new UnauthorizedException('Invalid access token');
    }

    if (await this.redis.exists(blacklistKey(payload.jti))) {
      throw new UnauthorizedException('Token has been revoked');
    }

    return {
      id: payload.sub,
      email: payload.email,
      role: payload.role,
      jti: payload.jti,
      exp: payload.exp,
    };
  }
}