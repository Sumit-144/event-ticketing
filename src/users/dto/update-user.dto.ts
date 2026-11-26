import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  MinLength,
} from 'class-validator';

/**
 * Self-service profile update. Deliberately has no `role`, `email` or
 * `passwordHash`: with `forbidNonWhitelisted`, sending them gives a 400.
 */
export class UpdateUserDto {
  @ApiPropertyOptional({ example: 'Sumit Sharma', minLength: 2, maxLength: 100 })
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional({ example: 'https://example.com/avatar.png' })
  @IsOptional()
  @IsUrl({ require_protocol: true, protocols: ['http', 'https'] })
  @MaxLength(2048)
  avatarUrl?: string;
}