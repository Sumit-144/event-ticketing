import { Logger } from '@nestjs/common';
import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Job, UnrecoverableError } from 'bullmq';
import { DeadLetterService } from '../dead-letter.service';
import { QUEUES } from '../queue.constants';
import { QueueRepository } from '../queue.repository';
import type { BookingNotificationView, EmailJobData, EmailTemplate } from '../queue.types';

/** Mock email sender: logs instead of sending. Nodemailer would replace the log line. */
@Processor(QUEUES.EMAIL, { concurrency: 5 })
export class EmailProcessor extends WorkerHost {
  private readonly logger = new Logger(EmailProcessor.name);

  constructor(
    private readonly repo: QueueRepository,
    private readonly deadLetter: DeadLetterService,
  ) {
    super();
  }

  async process(job: Job<EmailJobData>): Promise<{ subject: string }> {
    const { template, bookingId } = job.data;

    const booking = await this.repo.findBookingForNotification(bookingId);
    // Retrying cannot make a missing row appear: fail straight to the dead-letter queue.
    if (!booking) throw new UnrecoverableError(`Booking ${bookingId} not found`);

    const subject = this.subjectFor(template, booking);
    this.logger.log(`[MOCK EMAIL] to=${booking.userEmail} subject="${subject}"`);
    return { subject };
  }

  private subjectFor(template: EmailTemplate, b: BookingNotificationView): string {
    switch (template) {
      case 'booking-confirmed':
        return `Booking confirmed: ${b.eventTitle} (${b.ticketCode})`;
      case 'booking-cancelled':
        return `Booking cancelled: ${b.eventTitle}`;
      case 'event-reminder':
        return `Reminder: ${b.eventTitle} starts ${b.eventStartDate.toISOString()}`;
      default:
        throw new Error(`Unknown email template '${String(template)}'`);
    }
  }

  @OnWorkerEvent('failed')
  async onFailed(job: Job | undefined, error: Error): Promise<void> {
    await this.deadLetter.captureIfExhausted(QUEUES.EMAIL, job, error);
  }
}