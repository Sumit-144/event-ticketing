import { Prisma } from '../../generated/prisma/client';

/** The only booking shape that leaves the repository (no raw Prisma entities in responses). */
export const BOOKING_SELECT = {
  id: true,
  userId: true,
  eventId: true,
  ticketTierId: true,
  quantity: true,
  totalAmount: true,
  status: true,
  ticketCode: true,
  createdAt: true,
  deletedAt: true, // for bookings this is the cancellation time (D20)
  event: {
    select: { id: true, title: true, venue: true, city: true, startDate: true, status: true },
  },
  ticketTier: { select: { id: true, name: true, price: true } },
} satisfies Prisma.BookingSelect;

export type BookingView = Prisma.BookingGetPayload<{ select: typeof BOOKING_SELECT }>;

export interface CreateBookingInput {
  userId: string;
  ticketTierId: string;
  quantity: number;
}

/** Everything the transaction can conclude. The service maps each case to an HTTP result. */
export type CreateBookingOutcome =
  | {
      kind: 'created';
      booking: BookingView;
      /** Seats left in the tier right after this booking. */
      availableSeats: number;
      event: { title: string; organizerId: string; startDate: Date };
    }
  | { kind: 'tier_not_found' }
  | { kind: 'event_closed'; reason: 'NOT_PUBLISHED' | 'STARTED' }
  | { kind: 'sold_out'; availableSeats: number };

export type CancelBookingOutcome =
  | {
      kind: 'cancelled';
      booking: BookingView;
      organizerId: string;
      /** Seats left in the tier right after the cancellation. */
      availableSeats: number;
    }
  | { kind: 'not_found' }
  | { kind: 'not_cancellable' };