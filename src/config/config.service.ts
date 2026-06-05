import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

@Injectable()
export class AppConfigService {
    constructor(private readonly configService: ConfigService){}

    get port(): number{
        return this.configService.get<number>('PORT')!;
    }

    get nodeEnv(): string{
        return this.configService.get<string>('NODE_ENV')!;
    }

    get isDevelopment(): boolean{
        return this.nodeEnv === 'development';
    }

    get databaseUrl(): string{
        return this.configService.get<string>('DATABASE_URL')!;
    }

    get jwtAccessSecret(): string {
        return this.configService.get<string>('JWT_ACCESS_SECRET')!;
    }

    get jwtAccessExpiresIn(): string {
        return this.configService.get<string>('JWT_ACCESS_EXPIRES_IN')!;
    }

    get jwtRefreshSecret(): string {
        return this.configService.get<string>('JWT_REFRESH_SECRET')!;
    }

    get jwtRefreshExpiresIn(): string {
        return this.configService.get<string>('JWT_REFRESH_EXPIRES_IN')!;
    }

    // Redis
    get redisHost(): string {
        return this.configService.get<string>('REDIS_HOST')!;
    }

    get redisPort(): number {
        return this.configService.get<number>('REDIS_PORT')!;
    }

    get redisPassword(): string | undefined {
        return this.configService.get<string>('REDIS_PASSWORD') || undefined;
    }

    // App settings
    get bcryptSaltRounds(): number {
        return this.configService.get<number>('BCRYPT_SALT_ROUNDS')!;
    }

    get uploadDest(): string {
        return this.configService.get<string>('UPLOAD_DEST')!;
    }

    get maxFileSizeMb(): number {
        return this.configService.get<number>('MAX_FILE_SIZE_MB')!;
    }

    // Throttle
    get throttleTtl(): number {
        return this.configService.get<number>('THROTTLE_TTL')!;
    }
    get throttleLimit(): number {
        return this.configService.get<number>('THROTTLE_LIMIT')!;
    }
    // CORS
    get corsOrigin(): string {
        return this.configService.get<string>('CORS_ORIGIN')!;
    }
}