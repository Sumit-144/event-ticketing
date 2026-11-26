import { EventStatus, Prisma } from '../../generated/prisma/client';

/** Fields every event response exposes. Passing this to `select` means new columns can't leak. */
export const LEAN_EVENT_SELECT = {
  id: true,
  title: true,
  description: true,
  bannerUrl: true,
  venue: true,
  city: true,
  startDate: true,
  endDate: true,
  status: true,
  organizerId: true,
  createdAt: true,
  organizer: { select: { id: true, name: true } },
  categories: { select: { category: { select: { id: true, name: true } } } },
} satisfies Prisma.EventSelect;

export const TICKET_TIER_SELECT = {
  id: true,
  eventId: true,
  name: true,
  price: true,
  totalSeats: true,
  bookedSeats: true,
  description: true,
} satisfies Prisma.TicketTierSelect;

export const EVENT_DETAIL_SELECT = {
  ...LEAN_EVENT_SELECT,
  updatedAt: true,
  ticketTiers: { orderBy: { price: 'asc' }, select: TICKET_TIER_SELECT },
} satisfies Prisma.EventSelect;

export type LeanEventRow = Prisma.EventGetPayload<{ select: typeof LEAN_EVENT_SELECT }>;
export type DetailEventRow = Prisma.EventGetPayload<{ select: typeof EVENT_DETAIL_SELECT }>;

export interface CategoryRef {
  id: string;
  name: string;
}

/** List item with the bridge-table noise flattened: categories is a plain array. */
export type EventListItem = Omit<LeanEventRow, 'categories'> & { categories: CategoryRef[] };
export type EventDetail = Omit<DetailEventRow, 'categories'> & { categories: CategoryRef[] };
export type TicketTierView = Prisma.TicketTierGetPayload<{ select: typeof TICKET_TIER_SELECT }>;

/** Minimal row the service needs for ownership, status and date checks before a write. */
export interface EventWriteTarget {
  id: string;
  organizerId: string;
  status: EventStatus;
  startDate: Date;
  endDate: Date;
  bannerUrl: string | null;
  tierCount: number;
}

export interface CreateEventData {
  title: string;
  description?: string;
  venue: string;
  city: string;
  startDate: Date;
  endDate: Date;
  categoryIds?: string[];
}

export interface EventScalarUpdate {
  title?: string;
  description?: string;
  venue?: string;
  city?: string;
  startDate?: Date;
  endDate?: Date;
}

export interface TierCreateData {
  name: string;
  price: number;
  totalSeats: number;
  description?: string;
}

export type TierUpdateData = Partial<TierCreateData>;