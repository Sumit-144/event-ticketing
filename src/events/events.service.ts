import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventStatus, Role } from '../../generated/prisma/client';
import { EventsCacheService } from '../cache/events-cache.service';
import { CategoriesService } from '../categories/categories.service';
import { eventDetailKey, eventListKey } from '../common/constants/redis-keys';
import type { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface';
import type { PaginationMeta } from '../common/interceptors/response-wrapper.interceptor';
import { isPrismaError } from '../common/utils/prisma-error.util';
import { CreateEventDto } from './dto/create-event.dto';
import { CreateTicketTierDto, UpdateTicketTierDto } from './dto/create-ticket-tier.dto';
import { FilterEventsDto } from './dto/filter-events.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { EventsRepository } from './events.repository';
import {
  EventDetail,
  EventListItem,
  EventScalarUpdate,
  EventWriteTarget,
  TicketTierView,
} from './events.types';
import { hashEventFilters } from './utils/filter-hash.util';
import { UploadService } from '../upload/upload.service';

export interface EventListPage {
  items: EventListItem[];
  meta: PaginationMeta;
}

const EDITABLE_STATUSES: EventStatus[] = [EventStatus.DRAFT, EventStatus.PUBLISHED];

/**
 * Business rules for events and tiers: ownership, status rules (D15), cache-aside reads
 * and invalidation on writes. Check order on every write: 404, 403, 409, 400.
 */
@Injectable()
export class EventsService {
  constructor(
    private readonly repo: EventsRepository,
    private readonly cache: EventsCacheService,
    private readonly categories: CategoriesService,
    private readonly upload: UploadService,
  ) {}

  // ─── Reads ─────────────────────────────────────────────────────────────────

  /** Public list, cached under events:list:{version}:{hash}. Never contains drafts. */
  async listPublic(filters: FilterEventsDto): Promise<EventListPage> {
    const load = async () => this.toPage(await this.repo.findPublicList(filters), filters);
    const version = await this.cache.getListVersion();
    if (version === null) return load(); // Redis down: skip the cache
    return this.cache.remember(eventListKey(version, hashEventFilters(filters)), load);
  }

  /** The caller's own events (drafts included). Uncached on purpose. */
  async listMine(user: AuthenticatedUser, filters: FilterEventsDto): Promise<EventListPage> {
    return this.toPage(await this.repo.findMineList(user.id, filters), filters);
  }

  /** Public detail (event + tiers), cached. Drafts and deleted events are 404. */
  getPublic(id: string): Promise<EventDetail> {
    return this.cache.remember(eventDetailKey(id), async () => {
      const event = await this.repo.findPublicDetail(id);
      if (!event) throw new NotFoundException('Event not found');
      return event;
    });
  }

  /** Owner/admin view of any status, including drafts (D14). Uncached. */
  async getMine(user: AuthenticatedUser, id: string): Promise<EventDetail> {
    const event = await this.repo.findDetailAnyStatus(id);
    if (!event) throw new NotFoundException('Event not found');
    this.assertCanManage(user, event.organizerId);
    return event;
  }

  /** Tiers come from the cached detail, so a booking's detail eviction keeps them fresh. */
  async listTiers(eventId: string): Promise<TicketTierView[]> {
    return (await this.getPublic(eventId)).ticketTiers;
  }

  // ─── Event writes ──────────────────────────────────────────────────────────

  async create(user: AuthenticatedUser, dto: CreateEventDto): Promise<EventDetail> {
    this.assertDateOrder(dto.startDate, dto.endDate);
    if (dto.categoryIds?.length) await this.categories.assertAllExist(dto.categoryIds);

    const event = await this.repo.create(user.id, {
      title: dto.title,
      description: dto.description,
      venue: dto.venue,
      city: dto.city,
      startDate: dto.startDate,
      endDate: dto.endDate,
      categoryIds: dto.categoryIds,
    });
    await this.invalidateEvent(event.id);
    return event;
  }

  async update(user: AuthenticatedUser, id: string, dto: UpdateEventDto): Promise<EventDetail> {
    const target = await this.requireTarget(id);
    this.assertCanManage(user, target.organizerId);
    this.assertEditable(target.status);

    const scalars: EventScalarUpdate = {
      title: dto.title,
      description: dto.description,
      venue: dto.venue,
      city: dto.city,
      startDate: dto.startDate,
      endDate: dto.endDate,
    };
    const { categoryIds } = dto;
    if (Object.values(scalars).every((v) => v === undefined) && categoryIds === undefined) {
      throw new BadRequestException('No fields to update');
    }

    // Cross-field rule on MERGED values: patching only endDate must still be valid.
    this.assertDateOrder(
      scalars.startDate ?? target.startDate,
      scalars.endDate ?? target.endDate,
    );
    if (
      target.status === EventStatus.PUBLISHED &&
      scalars.startDate &&
      scalars.startDate.getTime() <= Date.now()
    ) {
      throw new BadRequestException('A published event cannot start in the past');
    }
    if (categoryIds?.length) await this.categories.assertAllExist(categoryIds);

    let updated: EventDetail;
    try {
      updated = await this.repo.update(id, scalars, categoryIds);
    } catch (error) {
      if (isPrismaError(error, 'P2025')) throw new NotFoundException('Event not found');
      throw error;
    }
    await this.invalidateEvent(id);
    return updated;
  }

  /** Soft delete; blocked while live bookings exist (D12), atomically (D21). */
  async remove(user: AuthenticatedUser, id: string): Promise<void> {
    const target = await this.requireTarget(id);
    this.assertCanManage(user, target.organizerId);

    const result = await this.repo.softDeleteIfNoLiveBookings(id);
    if (result === 'not_found') throw new NotFoundException('Event not found');
    if (result === 'has_live_bookings') {
      throw new ConflictException('Event has active bookings; cancel the event instead');
    }
    await this.invalidateEvent(id);
  }

  /** DRAFT to PUBLISHED (D10). The transition itself is atomic in the DB. */
  async publish(user: AuthenticatedUser, id: string): Promise<EventDetail> {
    const target = await this.requireTarget(id);
    this.assertCanManage(user, target.organizerId);
    if (target.status !== EventStatus.DRAFT) {
      throw new ConflictException('Only draft events can be published');
    }
    if (target.tierCount < 1) {
      throw new BadRequestException('Add at least one ticket tier before publishing');
    }
    this.assertDateOrder(target.startDate, target.endDate);
    if (target.startDate.getTime() <= Date.now()) {
      throw new BadRequestException('Cannot publish an event whose start date has passed');
    }
    return this.transition(id, EventStatus.DRAFT, EventStatus.PUBLISHED);
  }

  /** PUBLISHED to CANCELLED (D15). Does NOT auto-cancel bookings yet (D12, Phase 5). */
  async cancel(user: AuthenticatedUser, id: string): Promise<EventDetail> {
    const target = await this.requireTarget(id);
    this.assertCanManage(user, target.organizerId);
    if (target.status !== EventStatus.PUBLISHED) {
      throw new ConflictException('Only published events can be cancelled');
    }
    return this.transition(id, EventStatus.PUBLISHED, EventStatus.CANCELLED);
  }

  /** Replaces the banner: save new file, update DB, then delete the old file (never the reverse). */
  async setBanner(
    user: AuthenticatedUser,
    id: string,
    file: Express.Multer.File | undefined,
  ): Promise<EventDetail> {
    const target = await this.requireTarget(id);
    this.assertCanManage(user, target.organizerId);
    this.assertEditable(target.status);
    if (!file) {
      throw new BadRequestException('Banner image is required (multipart field "file")');
    }

    const newUrl = await this.upload.saveEventBanner(file);
    try {
      await this.repo.setBannerUrl(id, newUrl);
    } catch (error) {
      await this.upload.deleteBanner(newUrl); // do not leave an orphan behind
      if (isPrismaError(error, 'P2025')) throw new NotFoundException('Event not found');
      throw error;
    }
    await this.upload.deleteBanner(target.bannerUrl);
    await this.invalidateEvent(id);

    const event = await this.repo.findDetailAnyStatus(id);
    if (!event) throw new NotFoundException('Event not found');
    return event;
  }

  // ─── Tier writes ───────────────────────────────────────────────────────────

  async createTier(
    user: AuthenticatedUser,
    eventId: string,
    dto: CreateTicketTierDto,
  ): Promise<TicketTierView> {
    const target = await this.requireTarget(eventId);
    this.assertCanManage(user, target.organizerId);
    this.assertEditable(target.status);

    const tier = await this.repo.createTier(eventId, {
      name: dto.name,
      price: dto.price,
      totalSeats: dto.totalSeats,
      description: dto.description,
    });
    await this.cache.evictDetail(eventId); // lists hold no tiers, so no version bump
    return tier;
  }

  async updateTier(
    user: AuthenticatedUser,
    eventId: string,
    tierId: string,
    dto: UpdateTicketTierDto,
  ): Promise<TicketTierView> {
    const target = await this.requireTarget(eventId);
    this.assertCanManage(user, target.organizerId);
    this.assertEditable(target.status);

    const data = {
      name: dto.name,
      price: dto.price,
      totalSeats: dto.totalSeats,
      description: dto.description,
    };
    if (Object.values(data).every((v) => v === undefined)) {
      throw new BadRequestException('No fields to update');
    }

    const updated = await this.repo.updateTier(eventId, tierId, data);
    if (!updated) {
      // Nothing matched: tell "no such tier" apart from "capacity below booked seats" (D11).
      const tier = await this.repo.findTier(eventId, tierId);
      if (!tier) throw new NotFoundException('Ticket tier not found');
      throw new ConflictException(
        `totalSeats cannot be lower than the ${tier.bookedSeats} seats already booked`,
      );
    }
    await this.cache.evictDetail(eventId);

    const tier = await this.repo.findTier(eventId, tierId);
    if (!tier) throw new NotFoundException('Ticket tier not found');
    return tier;
  }

  // ─── Helpers ───────────────────────────────────────────────────────────────

  private toPage(
    result: { items: EventListItem[]; total: number },
    filters: FilterEventsDto,
  ): EventListPage {
    return {
      items: result.items,
      meta: { page: filters.page, limit: filters.limit, total: result.total },
    };
  }

  private async requireTarget(id: string): Promise<EventWriteTarget> {
    const target = await this.repo.findWriteTarget(id);
    if (!target) throw new NotFoundException('Event not found');
    return target;
  }

  /** Admin bypasses; everyone else must own the event (the check RolesGuard cannot do). */
  private assertCanManage(user: AuthenticatedUser, organizerId: string): void {
    if (user.role === Role.ADMIN) return;
    if (user.id !== organizerId) {
      throw new ForbiddenException('You can only manage your own events');
    }
  }

  /** D15: CANCELLED and COMPLETED events are read-only. */
  private assertEditable(status: EventStatus): void {
    if (!EDITABLE_STATUSES.includes(status)) {
      throw new ConflictException(`A ${status.toLowerCase()} event cannot be modified`);
    }
  }

  private assertDateOrder(start: Date, end: Date): void {
    if (end.getTime() <= start.getTime()) {
      throw new BadRequestException('endDate must be after startDate');
    }
  }

  /** Atomic status change; false means another request moved the event first. */
  private async transition(id: string, from: EventStatus, to: EventStatus): Promise<EventDetail> {
    if (!(await this.repo.transitionStatus(id, from, to))) {
      throw new ConflictException('Event status changed concurrently; reload and retry');
    }
    await this.invalidateEvent(id);
    const event = await this.repo.findDetailAnyStatus(id);
    if (!event) throw new NotFoundException('Event not found');
    return event;
  }

  /** Any event write: orphan every cached list and drop this event's detail (D6). */
  private async invalidateEvent(id: string): Promise<void> {
    await Promise.all([this.cache.bumpListVersion(), this.cache.evictDetail(id)]);
  }
}