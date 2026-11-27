import { Logger } from '@nestjs/common';
import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Job, UnrecoverableError } from 'bullmq';
import { DeadLetterService } from '../dead-letter.service';
import { QUEUES } from '../queue.constants';
import { QueueRepository } from '../queue.repository';
import type { TicketJobData } from '../queue.types';

/** Builds a text receipt off the HTTP path (a PDF generator would slot in here). */
@Processor(QUEUES.TICKET, { concurrency: 5 })
export class TicketProcessor extends WorkerHost {
  private readonly logger = new Logger(TicketProcessor.name);

  constructor(
    private readonly repo: QueueRepository,
    private readonly deadLetter: DeadLetterService,
  ) {
    super();
  }

  async process(job: Job<TicketJobData>): Promise<{ receipt: string }> {
    const b = await this.repo.findBookingForNotification(job.data.bookingId);
    if (!b) throw new UnrecoverableError(`Booking ${job.data.bookingId} not found`);

    const receipt = [
      `RECEIPT ${b.ticketCode}`,
      `Event: ${b.eventTitle} (${b.eventVenue}, ${b.eventCity})`,
      `Starts: ${b.eventStartDate.toISOString()}`,
      `Tier: ${b.tierName} x ${b.quantity}`,
      `Total: ${b.totalAmount}`,
    ].join('\n');

    this.logger.log(`[MOCK TICKET]\n${receipt}`);
    return { receipt };
  }

  @OnWorkerEvent('failed')
  async onFailed(job: Job | undefined, error: Error): Promise<void> {
    await this.deadLetter.captureIfExhausted(QUEUES.TICKET, job, error);
  }
}