import { Module } from '@nestjs/common';
import { EventsCacheModule } from '../cache/events-cache.module';
import { CategoriesModule } from '../categories/categories.module';
import { EventsController } from './events.controller';
import { EventsRepository } from './events.repository';
import { EventsService } from './events.service';
import { UploadModule } from '../upload/upload.module';

@Module({
  imports: [CategoriesModule, EventsCacheModule, UploadModule],
  controllers: [EventsController],
  providers: [EventsRepository, EventsService],
  exports: [EventsService], // bookings (step 5) builds on this
})
export class EventsModule {}