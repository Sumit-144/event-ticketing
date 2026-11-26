import { Injectable } from '@nestjs/common';
import { EventStatus, Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { FilterEventsDto } from './dto/filter-events.dto';
import {
  CreateEventData,
  DetailEventRow,
  EVENT_DETAIL_SELECT,
  EventDetail,
  EventListItem,
  EventScalarUpdate,
  EventWriteTarget,
  LEAN_EVENT_SELECT,
  LeanEventRow,
  TICKET_TIER_SELECT,
  TierCreateData,
  TierUpdateData,
  TicketTierView,
} from './events.types';

const toListItem = (row: LeanEventRow): EventListItem => ({
  ...row,
  categories: row.categories.map((c) => c.category),
});

const toDetail = (row: DetailEventRow): EventDetail => ({
  ...row,
  categories: row.categories.map((c) => c.category),
});

/** The only layer that talks to Prisma for events and tiers. No caching or auth here. */
@Injectable()
export class EventsRepository {
  constructor(private readonly prisma: PrismaService) {}

  // ─── Lists ─────────────────────────────────────────────────────────────────

  /** Public listing: never DRAFT, never soft-deleted. */
  findPublicList(filters: FilterEventsDto) {
    return this.list(filters, {
      deletedAt: null,
      status: { not: EventStatus.DRAFT },
    });
  }

  /** An organizer's own events, drafts included. */
  findMineList(organizerId: string, filters: FilterEventsDto) {
    return this.list(filters, { deletedAt: null, organizerId });
  }

  private async list(
    filters: FilterEventsDto,
    base: Prisma.EventWhereInput,
  ): Promise<{ items: EventListItem[]; total: number }> {
    const where = this.buildWhere(filters, base);
    // One transaction so rows and total come from the same snapshot.
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.event.findMany({
        where,
        select: LEAN_EVENT_SELECT,
        // `id` tie-breaker keeps offset pagination deterministic.
        orderBy: [{ startDate: 'asc' }, { id: 'asc' }],
        skip: filters.skip,
        take: filters.limit,
      }),
      this.prisma.event.count({ where }),
    ]);
    return { items: rows.map(toListItem), total };
  }

  /** `base` (visibility) AND user filters, so filters can never widen visibility. */
  private buildWhere(
    f: FilterEventsDto,
    base: Prisma.EventWhereInput,
  ): Prisma.EventWhereInput {
    const filters: Prisma.EventWhereInput = {};
    if (f.city) filters.city = { equals: f.city, mode: 'insensitive' };
    if (f.categoryId) filters.categories = { some: { categoryId: f.categoryId } };
    if (f.status) filters.status = f.status;
    if (f.search) filters.title = { contains: f.search, mode: 'insensitive' };
    if (f.dateFrom || f.dateTo) {
      const range: Prisma.DateTimeFilter = {};
      if (f.dateFrom) range.gte = f.dateFrom;
      if (f.dateTo) range.lte = f.dateTo;
      filters.startDate = range;
    }
    return { AND: [base, filters] };
  }

  // ─── Single reads ──────────────────────────────────────────────────────────

  /** Public detail (event + tiers); null for drafts and deleted events. */
  async findPublicDetail(id: string): Promise<EventDetail | null> {
    const row = await this.prisma.event.findFirst({
      where: { id, deletedAt: null, status: { not: EventStatus.DRAFT } },
      select: EVENT_DETAIL_SELECT,
    });
    return row ? toDetail(row) : null;
  }

  /** Any status (drafts too). Callers MUST do the ownership check (D14). */
  async findDetailAnyStatus(id: string): Promise<EventDetail | null> {
    const row = await this.prisma.event.findFirst({
      where: { id, deletedAt: null },
      select: EVENT_DETAIL_SELECT,
    });
    return row ? toDetail(row) : null;
  }

  /** Slim row for ownership / status / date / tier-count checks before a write. */
  async findWriteTarget(id: string): Promise<EventWriteTarget | null> {
    const row = await this.prisma.event.findFirst({
      where: { id, deletedAt: null },
      select: {
        id: true,
        organizerId: true,
        status: true,
        startDate: true,
        endDate: true,
        _count: { select: { ticketTiers: true } },
      },
    });
    if (!row) return null;
    const { _count, ...rest } = row;
    return { ...rest, tierCount: _count.ticketTiers };
  }

  // ─── Writes ────────────────────────────────────────────────────────────────

  /** Creates the event and its category links in a single nested write (atomic). */
  async create(organizerId: string, data: CreateEventData): Promise<EventDetail> {
    const { categoryIds, ...scalars } = data;
    const row = await this.prisma.event.create({
      data: {
        ...scalars,
        organizerId,
        categories: categoryIds?.length
          ? { create: categoryIds.map((categoryId) => ({ categoryId })) }
          : undefined,
      },
      select: EVENT_DETAIL_SELECT,
    });
    return toDetail(row);
  }

  /**
   * Updates scalars and, when `categoryIds` is given, replaces the whole category set.
   * Throws Prisma P2025 if the event is missing or soft-deleted (service maps to 404).
   */
  async update(
    id: string,
    scalars: EventScalarUpdate,
    categoryIds?: string[],
  ): Promise<EventDetail> {
    const row = await this.prisma.$transaction(async (tx) => {
      await tx.event.update({ where: { id, deletedAt: null }, data: scalars });
      if (categoryIds) {
        await tx.eventCategory.deleteMany({ where: { eventId: id } });
        if (categoryIds.length) {
          await tx.eventCategory.createMany({
            data: categoryIds.map((categoryId) => ({ eventId: id, categoryId })),
          });
        }
      }
      return tx.event.findFirstOrThrow({
        where: { id },
        select: EVENT_DETAIL_SELECT,
      });
    });
    return toDetail(row);
  }

  /** Soft delete. Throws P2025 if already deleted or missing. */
  async softDelete(id: string): Promise<void> {
    await this.prisma.event.update({
      where: { id, deletedAt: null },
      data: { deletedAt: new Date() },
    });
  }

  /** Bookings that still hold seats; D12 blocks deleting an event while any exist. */
  countLiveBookings(eventId: string): Promise<number> {
    return this.prisma.booking.count({
      where: {
        eventId,
        deletedAt: null,
        status: { in: ['PENDING', 'CONFIRMED'] },
      },
    });
  }

  /**
   * Atomic status transition: only succeeds if the event is still in `from`.
   * Returns false when another request already moved it (or it was deleted).
   */
  async transitionStatus(
    id: string,
    from: EventStatus,
    to: EventStatus,
  ): Promise<boolean> {
    const { count } = await this.prisma.event.updateMany({
      where: { id, deletedAt: null, status: from },
      data: { status: to },
    });
    return count === 1;
  }

  // ─── Ticket tiers ──────────────────────────────────────────────────────────

  listTiers(eventId: string): Promise<TicketTierView[]> {
    return this.prisma.ticketTier.findMany({
      where: { eventId },
      select: TICKET_TIER_SELECT,
      orderBy: [{ price: 'asc' }, { id: 'asc' }],
    });
  }

  /** Scoped by eventId so a tier id from another event never matches. */
  findTier(eventId: string, tierId: string): Promise<TicketTierView | null> {
    return this.prisma.ticketTier.findFirst({
      where: { id: tierId, eventId },
      select: TICKET_TIER_SELECT,
    });
  }

  createTier(eventId: string, data: TierCreateData): Promise<TicketTierView> {
    return this.prisma.ticketTier.create({
      data: { ...data, eventId },
      select: TICKET_TIER_SELECT,
    });
  }

  /**
   * Atomic update. When `totalSeats` changes, the WHERE also requires
   * `bookedSeats <= totalSeats`, so the DB refuses to drop capacity below what is sold.
   * Returns false when nothing matched: the service checks `findTier` to tell
   * "not found" (404) from "capacity below booked seats" (409).
   */
  async updateTier(
    eventId: string,
    tierId: string,
    data: TierUpdateData,
  ): Promise<boolean> {
    const where: Prisma.TicketTierWhereInput = { id: tierId, eventId };
    if (data.totalSeats !== undefined) {
      where.bookedSeats = { lte: data.totalSeats };
    }
    const { count } = await this.prisma.ticketTier.updateMany({ where, data });
    return count === 1;
  }
}