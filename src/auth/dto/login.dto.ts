import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail, IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { normalizeEmail } from './normalize-email';

export class LoginDto {
  @ApiProperty({ example: 'sumit@example.com' })
  @Transform(normalizeEmail)
  @IsEmail()
  email!: string;

  // No MinLength on purpose: login must not reveal the password policy.
  // MaxLength stops oversized inputs from being fed to bcrypt.
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(72)
  password!: string;
}