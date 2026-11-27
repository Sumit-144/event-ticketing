/** Names of internal domain events. Producers emit AFTER the DB commit; listeners arrive in Phase 5. */
export const DomainEvents = {
  BOOKING_CONFIRMED: 'booking.confirmed',
  BOOKING_CANCELLED: 'booking.cancelled',
  AUDIT_LOG: 'audit.log',
} as const;

export interface BookingConfirmedPayload {
  bookingId: string;
  userId: string;
  eventId: string;
  eventTitle: string;
  eventStartDate: Date;
  organizerId: string;
  ticketTierId: string;
  quantity: number;
  ticketCode: string;
  /** Seats left in the tier right after this booking committed. */
  availableSeats: number;
}

export interface BookingCancelledPayload {
  bookingId: string;
  userId: string;
  eventId: string;
  organizerId: string;
  ticketTierId: string;
  quantity: number;
  /** Seats left in the tier right after the cancellation committed. */
  availableSeats: number;
  cancelledByUserId: string;
}

export interface AuditLogPayload {
  userId: string | null; // null = system
  entityType: string;
  entityId: string;
  action: string;
  before?: unknown;
  after?: unknown;
  ipAddress?: string;
}