import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { JOB_NAMES, QUEUES, REMINDER_LEAD_MS, jobIds } from '../queue.constants';
import type { EmailJobData, EmailTemplate, ReminderJobData, TicketJobData } from '../queue.types';

/**
 * The only place that knows job names, ids and delays. Methods THROW on failure;
 * callers (the 5c listeners) catch, so a queue problem never fails a booking.
 */
@Injectable()
export class QueueProducer {
  private readonly logger = new Logger(QueueProducer.name);

  constructor(
    @InjectQueue(QUEUES.EMAIL) private readonly email: Queue<EmailJobData>,
    @InjectQueue(QUEUES.TICKET) private readonly ticket: Queue<TicketJobData>,
    @InjectQueue(QUEUES.REMINDER) private readonly reminder: Queue<ReminderJobData>,
  ) {}

  async addEmailJob(template: EmailTemplate, bookingId: string): Promise<void> {
    await this.email.add(
      JOB_NAMES.SEND_EMAIL,
      { template, bookingId },
      { jobId: jobIds.email(template, bookingId) },
    );
  }

  async addTicketJob(bookingId: string): Promise<void> {
    await this.ticket.add(
      JOB_NAMES.GENERATE_TICKET,
      { bookingId },
      { jobId: jobIds.ticket(bookingId) },
    );
  }

  /** Delay = startDate - 24h - now (D25). Returns 'skipped' when that moment already passed. */
  async addReminderJob(bookingId: string, eventStartDate: Date): Promise<'scheduled' | 'skipped'> {
    const delay = eventStartDate.getTime() - REMINDER_LEAD_MS - Date.now();
    if (delay <= 0) return 'skipped';
    await this.reminder.add(
      JOB_NAMES.SEND_REMINDER,
      { bookingId },
      { jobId: jobIds.reminder(bookingId), delay },
    );
    return 'scheduled';
  }

  /** True if a pending reminder was removed. Never throws (a locked/active job just logs). */
  async cancelReminder(bookingId: string): Promise<boolean> {
    try {
      return (await this.reminder.remove(jobIds.reminder(bookingId))) === 1;
    } catch (error) {
      this.logger.warn(
        `Could not remove reminder for booking ${bookingId}: ${error instanceof Error ? error.message : String(error)}`,
      );
      return false;
    }
  }
}