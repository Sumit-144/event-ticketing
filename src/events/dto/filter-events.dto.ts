import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsDate,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { EventStatus } from '../../../generated/prisma/client';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { trim } from '../../common/utils/transform.util';

/** Query params for event listings. Extends the shared page/limit rules. */
export class FilterEventsDto extends PaginationDto {
  @ApiPropertyOptional({ example: 'Mumbai' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(100)
  city?: string;

  @ApiPropertyOptional({ description: 'Category id' })
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @ApiPropertyOptional({ enum: EventStatus })
  @IsOptional()
  @IsEnum(EventStatus)
  status?: EventStatus;

  @ApiPropertyOptional({ description: 'Case-insensitive title search', maxLength: 100 })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(100)
  search?: string;

  @ApiPropertyOptional({ type: String, format: 'date-time', description: 'Events starting on/after' })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  dateFrom?: Date;

  @ApiPropertyOptional({ type: String, format: 'date-time', description: 'Events starting on/before' })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  dateTo?: Date;
}