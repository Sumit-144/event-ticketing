import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import {
  BookingCancelledPayload,
  BookingConfirmedPayload,
  DomainEvents,
} from '../common/events/domain-events';
import { NotificationsService } from './notifications.service';

/** Turns booking domain events into socket pushes (D28). Never throws into the emitter. */
@Injectable()
export class NotificationsListener {
  private readonly logger = new Logger(NotificationsListener.name);

  constructor(private readonly notifications: NotificationsService) {}

  @OnEvent(DomainEvents.BOOKING_CONFIRMED, { async: true })
  onBookingConfirmed(p: BookingConfirmedPayload): void {
    this.safely('booking.confirmed', () => {
      this.notifications.seatsUpdated(p.eventId, p.ticketTierId, p.availableSeats);
      this.notifications.bookingConfirmed(p.userId, p.bookingId, p.ticketCode);
      this.notifications.organizerAlert(
        p.organizerId,
        p.eventId,
        `${p.quantity} ticket(s) booked for "${p.eventTitle}"`,
      );
    });
  }

  @OnEvent(DomainEvents.BOOKING_CANCELLED, { async: true })
  onBookingCancelled(p: BookingCancelledPayload): void {
    this.safely('booking.cancelled', () => {
      this.notifications.seatsUpdated(p.eventId, p.ticketTierId, p.availableSeats);
      this.notifications.organizerAlert(
        p.organizerId,
        p.eventId,
        `A booking was cancelled (${p.quantity} seat(s) released)`,
      );
    });
  }

  private safely(name: string, fn: () => void): void {
    try {
      fn();
    } catch (error) {
      this.logger.error(
        `Socket push for '${name}' failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}