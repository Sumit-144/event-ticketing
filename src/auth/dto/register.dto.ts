import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { normalizeEmail } from './normalize-email';

export class RegisterDto {
  @ApiProperty({ example: 'Sumit Sharma' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name!: string;

  @ApiProperty({ example: 'sumit@example.com' })
  @Transform(normalizeEmail)
  @IsEmail()
  @MaxLength(255)
  email!: string;

  @ApiProperty({ minLength: 8, maxLength: 72 })
  @IsString()
  @MinLength(8)
  @MaxLength(72) // bcrypt ignores everything after 72 bytes
  password!: string;

  @ApiPropertyOptional({ enum: ['ATTENDEE', 'ORGANIZER'], default: 'ATTENDEE' })
  @IsOptional()
  @IsIn(['ATTENDEE', 'ORGANIZER']) // ADMIN is never self-assignable
  role?: 'ATTENDEE' | 'ORGANIZER';
}