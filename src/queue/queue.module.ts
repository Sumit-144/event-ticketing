import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { AppConfigService } from '../config/config.service';
import { DeadLetterService } from './dead-letter.service';
import { EmailProcessor } from './processors/email.processor';
import { ReminderProcessor } from './processors/reminder.processor';
import { TicketProcessor } from './processors/ticket.processor';
import { QueueProducer } from './producers/queue.producer';
import { QUEUES } from './queue.constants';
import { QueueRepository } from './queue.repository';

/**
 * BullMQ setup (D22 to D26). Own Redis connections (never RedisService's fail-fast client),
 * in-process workers, retries with exponential backoff, bounded job retention.
 * The 'maintenance' queue arrives in 5e.
 */
@Module({
  imports: [
    BullModule.forRootAsync({
      inject: [AppConfigService],
      useFactory: (config: AppConfigService) => ({
        connection: {
          host: config.redisHost,
          port: config.redisPort,
          password: config.redisPassword,
          maxRetriesPerRequest: null, // required by BullMQ workers
        },
        defaultJobOptions: {
          attempts: 5,
          backoff: { type: 'exponential', delay: 2000 }, // 2s, 4s, 8s, 16s
          removeOnComplete: { count: 1000 },
          removeOnFail: { age: 7 * 24 * 3600 }, // keep failures 7 days
        },
      }),
    }),
    BullModule.registerQueue(
      { name: QUEUES.EMAIL },
      { name: QUEUES.TICKET },
      { name: QUEUES.REMINDER },
      { name: QUEUES.DEAD_LETTER },
    ),
  ],
  providers: [
    QueueRepository,
    QueueProducer,
    DeadLetterService,
    EmailProcessor,
    TicketProcessor,
    ReminderProcessor,
  ],
})
export class QueueModule {}