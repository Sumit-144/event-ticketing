import type { EventDetail } from '../events.types';

/** Plain-JSON audit snapshot of an event (Dates turned into ISO strings). */
export function eventSnapshot(e: EventDetail): Record<string, unknown> {
  return {
    title: e.title,
    description: e.description,
    venue: e.venue,
    city: e.city,
    startDate: e.startDate.toISOString(),
    endDate: e.endDate.toISOString(),
    status: e.status,
    bannerUrl: e.bannerUrl,
    organizerId: e.organizerId,
  };
}