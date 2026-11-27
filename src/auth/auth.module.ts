import { Module } from '@nestjs/common';
import { JwtModule, JwtSignOptions } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AppConfigService } from '../config/config.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { UsersModule } from "../users/users.module";
import { AuthService } from "./auth.service";
import { RefreshTokensRepository } from './refresh-tokens.repository';
import { AuthController } from './auth.controller';


@Module({
  imports: [
    UsersModule,
    PassportModule,
    JwtModule.registerAsync({
      inject: [AppConfigService],
      useFactory: (config: AppConfigService) => ({
        secret: config.jwtAccessSecret,
        signOptions: {
          // @nestjs/jwt 11 types expiresIn as a ms StringValue, not plain string.
          // Joi has already guaranteed the format, so the cast is safe.
          expiresIn: config.jwtAccessExpiresIn as JwtSignOptions['expiresIn'],
          algorithm: 'HS256',
        },
      }),
    }),
  ],
  providers: [JwtStrategy, AuthService, RefreshTokensRepository],
  controllers: [AuthController],
  exports: [JwtModule], // for JwtStrategy injection in other modules
})
export class AuthModule {}