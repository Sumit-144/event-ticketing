import { Module } from '@nestjs/common';
import { EventsCacheService } from './events-cache.service';
import { SeatCounterService } from './seat-counter.service';

/**
 * Neutral home for Redis-backed event/seat caches. Imported by events, categories and
 * bookings so none of them has to import another (no circular modules).
 */
@Module({
  providers: [EventsCacheService, SeatCounterService],
  exports: [EventsCacheService, SeatCounterService],
})
export class EventsCacheModule {}