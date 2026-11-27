import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { BookingStatus, Role } from '../../generated/prisma/client';
import { EventsCacheService } from '../cache/events-cache.service';
import { SeatCounterService } from '../cache/seat-counter.service';
import {
  AuditLogPayload,
  BookingCancelledPayload,
  BookingConfirmedPayload,
  DomainEvents,
} from '../common/events/domain-events';
import type { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface';
import type { PaginationMeta } from '../common/interceptors/response-wrapper.interceptor';
import { BookingsRepository } from './bookings.repository';
import { BookingView } from './bookings.types';
import { CreateBookingDto } from './dto/create-booking.dto';
import { ListBookingsDto } from './dto/list-bookings.dto';

export interface BookingListPage {
  items: BookingView[];
  meta: PaginationMeta;
}

/**
 * Booking use cases. The DB transaction decides; Redis and domain events are
 * post-commit, failure-tolerant side effects (a committed booking never fails because
 * Redis or a listener failed).
 */
@Injectable()
export class BookingsService {
  private readonly logger = new Logger(BookingsService.name);

  constructor(
    private readonly repo: BookingsRepository,
    private readonly seats: SeatCounterService,
    private readonly eventsCache: EventsCacheService,
    private readonly emitter: EventEmitter2,
  ) {}

  async create(user: AuthenticatedUser, dto: CreateBookingDto): Promise<BookingView> {
    // Fast path: reject obviously sold-out requests without opening a transaction.
    const hint = await this.seats.getAvailableHint(dto.ticketTierId, () =>
      this.repo.getAvailableSeats(dto.ticketTierId),
    );
    if (hint !== null && hint < dto.quantity) {
      throw this.soldOut(hint);
    }

    const outcome = await this.repo.createConfirmed({
      userId: user.id,
      ticketTierId: dto.ticketTierId,
      quantity: dto.quantity,
    });

    switch (outcome.kind) {
      case 'tier_not_found':
        throw new NotFoundException('Ticket tier not found');
      case 'event_closed':
        throw new ConflictException(
          outcome.reason === 'STARTED'
            ? 'Booking is closed: the event has already started'
            : 'This event is not open for booking',
        );
      case 'sold_out':
        await this.seats.correct(dto.ticketTierId, outcome.availableSeats); // fix a wrong hint
        throw this.soldOut(outcome.availableSeats);
      case 'created': {
        const { booking, availableSeats, event } = outcome;
        // Committed. Everything below is best-effort and must never fail the request.
        await this.seats.applyDelta(booking.ticketTierId, -booking.quantity);
        await this.eventsCache.evictDetail(booking.eventId); // detail holds bookedSeats (D9)

        this.publish<BookingConfirmedPayload>(DomainEvents.BOOKING_CONFIRMED, {
          bookingId: booking.id,
          userId: booking.userId,
          eventId: booking.eventId,
          eventTitle: event.title,
          eventStartDate: event.startDate,
          organizerId: event.organizerId,
          ticketTierId: booking.ticketTierId,
          quantity: booking.quantity,
          ticketCode: booking.ticketCode,
          availableSeats,
        });
        this.publish<AuditLogPayload>(DomainEvents.AUDIT_LOG, {
          userId: user.id,
          entityType: 'Booking',
          entityId: booking.id,
          action: 'CREATE',
          before: null,
          after: this.snapshot(booking),
        });
        return booking;
      }
    }
  }

  async listMine(user: AuthenticatedUser, filters: ListBookingsDto): Promise<BookingListPage> {
    const { items, total } = await this.repo.findMine(user.id, filters);
    return { items, meta: { page: filters.page, limit: filters.limit, total } };
  }

  /** Own booking or admin. Anyone else's id is a 404, so ids cannot be probed (D20). */
  async getOne(user: AuthenticatedUser, id: string): Promise<BookingView> {
    const booking = await this.repo.findById(id);
    if (!booking || (user.role !== Role.ADMIN && booking.userId !== user.id)) {
      throw new NotFoundException('Booking not found');
    }
    return booking;
  }

  /** D19: owner until the event starts, admin any time; only CONFIRMED can be cancelled. */
  async cancel(user: AuthenticatedUser, id: string): Promise<BookingView> {
    const existing = await this.getOne(user, id);

    if (existing.status !== BookingStatus.CONFIRMED) {
      throw new ConflictException('Only confirmed bookings can be cancelled');
    }
    if (user.role !== Role.ADMIN && existing.event.startDate.getTime() <= Date.now()) {
      throw new ConflictException('Cannot cancel after the event has started');
    }

    const outcome = await this.repo.cancelConfirmed(id);
    switch (outcome.kind) {
      case 'not_found':
        throw new NotFoundException('Booking not found');
      case 'not_cancellable':
        throw new ConflictException('Booking was already cancelled');
      case 'cancelled': {
        const { booking, organizerId, availableSeats } = outcome;
        await this.seats.applyDelta(booking.ticketTierId, booking.quantity);
        await this.eventsCache.evictDetail(booking.eventId);

        this.publish<BookingCancelledPayload>(DomainEvents.BOOKING_CANCELLED, {
          bookingId: booking.id,
          userId: booking.userId,
          eventId: booking.eventId,
          organizerId,
          ticketTierId: booking.ticketTierId,
          quantity: booking.quantity,
          availableSeats,
          cancelledByUserId: user.id,
        });
        this.publish<AuditLogPayload>(DomainEvents.AUDIT_LOG, {
          userId: user.id,
          entityType: 'Booking',
          entityId: booking.id,
          action: 'CANCEL',
          before: this.snapshot(existing),
          after: this.snapshot(booking),
        });
        return booking;
      }
    }
  }

  private soldOut(available: number): ConflictException {
    const left = Math.max(available, 0);
    return new ConflictException(
      left === 0 ? 'This tier is sold out' : `Only ${left} seat(s) left in this tier`,
    );
  }

  /** Plain-JSON snapshot for audit rows (Decimal and Date turned into strings). */
  private snapshot(b: BookingView): Record<string, unknown> {
    return {
      status: b.status,
      quantity: b.quantity,
      totalAmount: b.totalAmount.toString(),
      userId: b.userId,
      eventId: b.eventId,
      ticketTierId: b.ticketTierId,
      ticketCode: b.ticketCode,
      cancelledAt: b.deletedAt ? b.deletedAt.toISOString() : null,
    };
  }

  /** Emit after commit; a listener failure is logged, never propagated to the caller. */
  private publish<T>(name: string, payload: T): void {
    try {
      this.emitter.emit(name, payload);
    } catch (error) {
      this.logger.error(
        `Listener for '${name}' failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}