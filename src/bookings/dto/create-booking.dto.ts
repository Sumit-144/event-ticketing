import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsUUID, Max, Min } from 'class-validator';

export const MAX_TICKETS_PER_BOOKING = 10;

/** The event is derived from the tier, so a mismatched event/tier pair cannot be sent. */
export class CreateBookingDto {
  @ApiProperty({ description: 'Ticket tier to book' })
  @IsUUID()
  ticketTierId!: string;

  @ApiProperty({ example: 2, minimum: 1, maximum: MAX_TICKETS_PER_BOOKING })
  @IsInt()
  @Min(1)
  @Max(MAX_TICKETS_PER_BOOKING)
  quantity!: number;
}