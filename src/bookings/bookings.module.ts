import { Module } from '@nestjs/common';
import { EventsCacheModule } from '../cache/events-cache.module';
import { BookingsController } from './bookings.controller';
import { BookingsRepository } from './bookings.repository';
import { BookingsService } from './bookings.service';

@Module({
  imports: [EventsCacheModule],
  controllers: [BookingsController],
  providers: [BookingsRepository, BookingsService],
})
export class BookingsModule {}