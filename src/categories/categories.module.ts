import { Module } from '@nestjs/common';
import { EventsCacheModule } from '../cache/events-cache.module';
import { CategoriesController } from './categories.controller';
import { CategoriesRepository } from './categories.repository';
import { CategoriesService } from './categories.service';

@Module({
  imports: [EventsCacheModule],
  controllers: [CategoriesController],
  providers: [CategoriesRepository, CategoriesService],
  exports: [CategoriesService], // events validates category ids through this
})
export class CategoriesModule {}