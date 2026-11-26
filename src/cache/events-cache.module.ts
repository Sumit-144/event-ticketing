import { Module } from '@nestjs/common';
import { EventsCacheService } from './events-cache.service';

/** Imported by both EventsModule and CategoriesModule, so neither imports the other. */
@Module({
  providers: [EventsCacheService],
  exports: [EventsCacheService],
})
export class EventsCacheModule {}