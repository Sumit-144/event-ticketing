import { Injectable } from '@nestjs/common';
import { NotificationsGateway } from './notifications.gateway';
import { WS_EVENTS, eventRoom, userRoom } from './notifications.constants';

/** Emit helpers: the rest of the app talks to this, never to socket.io directly. */
@Injectable()
export class NotificationsService {
  constructor(private readonly gateway: NotificationsGateway) {}

  seatsUpdated(eventId: string, tierId: string, availableSeats: number): void {
    this.gateway.server
      .to(eventRoom(eventId))
      .emit(WS_EVENTS.SEATS_UPDATED, { eventId, tierId, availableSeats });
  }

  bookingConfirmed(userId: string, bookingId: string, ticketCode: string): void {
    this.gateway.server
      .to(userRoom(userId))
      .emit(WS_EVENTS.BOOKING_CONFIRMED, { bookingId, ticketCode });
  }

  organizerAlert(organizerId: string, eventId: string, message: string): void {
    this.gateway.server
      .to(userRoom(organizerId))
      .emit(WS_EVENTS.ORGANIZER_ALERT, { eventId, message });
  }
}