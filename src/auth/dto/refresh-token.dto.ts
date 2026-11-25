import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

/** Body for /auth/refresh and /auth/logout. */
export class RefreshTokenDto {
  @ApiProperty({ description: 'Opaque refresh token returned by login/refresh' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200) // real tokens are 43 chars; the cap bounds the hashed input
  refreshToken!: string;
}