import { Logger } from '@nestjs/common';
import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { BookingStatus, EventStatus } from '../../../generated/prisma/client';
import { DeadLetterService } from '../dead-letter.service';
import { QueueProducer } from '../producers/queue.producer';
import { QUEUES } from '../queue.constants';
import { QueueRepository } from '../queue.repository';
import type { ReminderJobData } from '../queue.types';

/**
 * Fires ~24h before the event. The job was scheduled days ago, so it re-checks the
 * world before acting (D25), then hands the actual sending to the email queue.
 */
@Processor(QUEUES.REMINDER, { concurrency: 5 })
export class ReminderProcessor extends WorkerHost {
  private readonly logger = new Logger(ReminderProcessor.name);

  constructor(
    private readonly repo: QueueRepository,
    private readonly producer: QueueProducer,
    private readonly deadLetter: DeadLetterService,
  ) {
    super();
  }

  async process(job: Job<ReminderJobData>): Promise<{ sent: boolean; reason?: string }> {
    const { bookingId } = job.data;
    const b = await this.repo.findBookingForNotification(bookingId);

    const skip = (reason: string) => {
      this.logger.log(`Reminder for booking ${bookingId} skipped: ${reason}`);
      return { sent: false, reason };
    };

    if (!b) return skip('booking-not-found');
    if (b.status !== BookingStatus.CONFIRMED) return skip('booking-not-confirmed');
    if (b.eventDeleted || b.eventStatus !== EventStatus.PUBLISHED) return skip('event-not-published');
    if (b.eventStartDate.getTime() <= Date.now()) return skip('event-already-started');

    await this.producer.addEmailJob('event-reminder', bookingId);
    return { sent: true };
  }

  @OnWorkerEvent('failed')
  async onFailed(job: Job | undefined, error: Error): Promise<void> {
    await this.deadLetter.captureIfExhausted(QUEUES.REMINDER, job, error);
  }
}