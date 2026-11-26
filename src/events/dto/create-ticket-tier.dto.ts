import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { trim } from '../../common/utils/transform.util';

export class CreateTicketTierDto {
  @ApiProperty({ example: 'VIP', minLength: 2, maxLength: 100 })
  @Transform(trim)
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name!: string;

  @ApiProperty({ example: 1499.5, description: 'Price per ticket, max 2 decimals; 0 = free' })
  @IsNumber({ maxDecimalPlaces: 2, allowNaN: false, allowInfinity: false })
  @Min(0)
  @Max(99999999.99)
  price!: number;

  @ApiProperty({ example: 200, minimum: 1, maximum: 100000 })
  @IsInt()
  @Min(1)
  @Max(100000)
  totalSeats!: number;

  @ApiPropertyOptional({ maxLength: 500 })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(500)
  description?: string;
}

export class UpdateTicketTierDto extends PartialType(CreateTicketTierDto) {}