import { Injectable } from '@nestjs/common';
import { BookingStatus, EventStatus, Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  BOOKING_SELECT,
  BookingView,
  CancelBookingOutcome,
  CreateBookingInput,
  CreateBookingOutcome,
} from './bookings.types';
import { ListBookingsDto } from './dto/list-bookings.dto';

interface TierLockRow {
  id: string;
  eventId: string;
  totalSeats: number;
  bookedSeats: number;
}

interface EventLockRow {
  id: string;
  title: string;
  organizerId: string;
  status: EventStatus;
  startDate: Date | string;
  deletedAt: Date | string | null;
}

/** The only layer that touches Prisma for bookings, including the locked transactions. */
@Injectable()
export class BookingsRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Available seats for the Redis warm-up. Null unless the tier belongs to a published,
   * non-deleted event, so hints never reveal drafts.
   */
  async getAvailableSeats(tierId: string): Promise<number | null> {
    const tier = await this.prisma.ticketTier.findFirst({
      where: { id: tierId, event: { deletedAt: null, status: EventStatus.PUBLISHED } },
      select: { totalSeats: true, bookedSeats: true },
    });
    return tier ? tier.totalSeats - tier.bookedSeats : null;
  }

  /**
   * The atomic booking. Lock order is always tier (FOR UPDATE) then event (FOR SHARE):
   * - the tier lock serialises bookings per tier, so the capacity check cannot oversell;
   * - the event share lock makes cancel/delete/edit of the event wait for in-flight
   *   bookings, while bookings on the same event still run in parallel.
   */
  createConfirmed(input: CreateBookingInput): Promise<CreateBookingOutcome> {
    return this.prisma.$transaction(async (tx): Promise<CreateBookingOutcome> => {
      const tiers = await tx.$queryRaw<TierLockRow[]>(Prisma.sql`
        SELECT id, "eventId", "totalSeats", "bookedSeats"
        FROM "TicketTier"
        WHERE id = ${input.ticketTierId}
        FOR UPDATE
      `);
      const tier = tiers[0];
      if (!tier) return { kind: 'tier_not_found' };

      const events = await tx.$queryRaw<EventLockRow[]>(Prisma.sql`
        SELECT id, title, "organizerId", status, "startDate", "deletedAt"
        FROM "Event"
        WHERE id = ${tier.eventId}
        FOR SHARE
      `);
      const event = events[0];
      // Drafts and deleted events look like "no such tier" so ids cannot be probed.
      if (!event || event.deletedAt !== null || event.status === EventStatus.DRAFT) {
        return { kind: 'tier_not_found' };
      }
      if (event.status !== EventStatus.PUBLISHED) {
        return { kind: 'event_closed', reason: 'NOT_PUBLISHED' };
      }
      const startDate = new Date(event.startDate);
      if (startDate.getTime() <= Date.now()) {
        return { kind: 'event_closed', reason: 'STARTED' };
      }

      const available = tier.totalSeats - tier.bookedSeats;
      if (input.quantity > available) {
        return { kind: 'sold_out', availableSeats: available };
      }

      // Read after the lock: a concurrent price edit waits for us, so this is consistent.
      const { price } = await tx.ticketTier.findUniqueOrThrow({
        where: { id: tier.id },
        select: { price: true },
      });
      await tx.ticketTier.update({
        where: { id: tier.id },
        data: { bookedSeats: { increment: input.quantity } },
      });
      const booking = await tx.booking.create({
        data: {
          userId: input.userId,
          eventId: tier.eventId,
          ticketTierId: tier.id,
          quantity: input.quantity,
          totalAmount: price.mul(input.quantity),
          status: BookingStatus.CONFIRMED, // D1: no payment step
        },
        select: BOOKING_SELECT,
      });

      return {
        kind: 'created',
        booking,
        availableSeats: available - input.quantity,
        event: { title: event.title, organizerId: event.organizerId, startDate },
      };
    });
  }

  /**
   * Mirror of booking. The conditional updateMany means two concurrent cancels cannot both
   * match: the loser gets `not_cancellable` and the seats are released exactly once.
   */
  cancelConfirmed(bookingId: string): Promise<CancelBookingOutcome> {
    return this.prisma.$transaction(async (tx): Promise<CancelBookingOutcome> => {
      const current = await tx.booking.findUnique({
        where: { id: bookingId },
        select: {
          quantity: true,
          ticketTierId: true,
          event: { select: { organizerId: true } },
        },
      });
      if (!current) return { kind: 'not_found' };

      const { count } = await tx.booking.updateMany({
        where: { id: bookingId, status: BookingStatus.CONFIRMED, deletedAt: null },
        data: { status: BookingStatus.CANCELLED, deletedAt: new Date() },
      });
      if (count !== 1) return { kind: 'not_cancellable' };

      const tier = await tx.ticketTier.update({
        where: { id: current.ticketTierId },
        data: { bookedSeats: { decrement: current.quantity } },
        select: { totalSeats: true, bookedSeats: true },
      });
      const booking = await tx.booking.findUniqueOrThrow({
        where: { id: bookingId },
        select: BOOKING_SELECT,
      });

      return {
        kind: 'cancelled',
        booking,
        organizerId: current.event.organizerId,
        availableSeats: tier.totalSeats - tier.bookedSeats,
      };
    });
  }

  /** Any status, cancelled included (D20). The service decides who may see it. */
  findById(id: string): Promise<BookingView | null> {
    return this.prisma.booking.findUnique({ where: { id }, select: BOOKING_SELECT });
  }

  /** The caller's own bookings, newest first, cancelled ones included (D20). */
  async findMine(
    userId: string,
    filters: ListBookingsDto,
  ): Promise<{ items: BookingView[]; total: number }> {
    const where: Prisma.BookingWhereInput = { userId };
    if (filters.status) where.status = filters.status;

    const [items, total] = await this.prisma.$transaction([
      this.prisma.booking.findMany({
        where,
        select: BOOKING_SELECT,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: filters.skip,
        take: filters.limit,
      }),
      this.prisma.booking.count({ where }),
    ]);
    return { items, total };
  }
}