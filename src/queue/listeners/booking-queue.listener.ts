import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import {
  BookingCancelledPayload,
  BookingConfirmedPayload,
  DomainEvents,
} from '../../common/events/domain-events';
import { QueueProducer } from '../producers/queue.producer';

/**
 * Turns booking domain events into background jobs (D28: the listener lives in the module
 * that owns the side effect). Enqueueing is best-effort: the booking already committed,
 * so a queue failure is logged and never propagates.
 */
@Injectable()
export class BookingQueueListener {
  private readonly logger = new Logger(BookingQueueListener.name);

  constructor(private readonly producer: QueueProducer) {}

  @OnEvent(DomainEvents.BOOKING_CONFIRMED, { async: true })
  async onBookingConfirmed(payload: BookingConfirmedPayload): Promise<void> {
    const { bookingId } = payload;
    await this.runAll(`booking.confirmed ${bookingId}`, [
      ['confirmation email', () => this.producer.addEmailJob('booking-confirmed', bookingId)],
      ['ticket receipt', () => this.producer.addTicketJob(bookingId)],
      [
        'reminder',
        async () => {
          const result = await this.producer.addReminderJob(
            bookingId,
            new Date(payload.eventStartDate),
          );
          if (result === 'skipped') {
            this.logger.log(`Reminder skipped for booking ${bookingId}: event is under 24h away`);
          }
        },
      ],
    ]);
  }

  @OnEvent(DomainEvents.BOOKING_CANCELLED, { async: true })
  async onBookingCancelled(payload: BookingCancelledPayload): Promise<void> {
    const { bookingId } = payload;
    await this.runAll(`booking.cancelled ${bookingId}`, [
      ['reminder removal', () => this.producer.cancelReminder(bookingId)],
      ['cancellation email', () => this.producer.addEmailJob('booking-cancelled', bookingId)],
    ]);
  }

  /** Runs every step even if an earlier one fails; logs each failure by name. */
  private async runAll(
    context: string,
    steps: Array<[label: string, run: () => Promise<unknown>]>,
  ): Promise<void> {
    const results = await Promise.allSettled(steps.map(([, run]) => run()));
    results.forEach((result, i) => {
      if (result.status === 'rejected') {
        const reason: unknown = result.reason;
        this.logger.error(
          `${context}: could not enqueue ${steps[i][0]}: ${reason instanceof Error ? reason.message : String(reason)}`,
        );
      }
    });
  }
}