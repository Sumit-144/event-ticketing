/** Redis key builders. Keep every key name here so nothing is typed by hand elsewhere. */

export const blacklistKey = (jti: string): string => `auth:blacklist:${jti}`;

/** Version counter for event lists; INCR it to orphan every cached list at once (D6). */
export const EVENT_LIST_VERSION_KEY = 'events:list:version';

export const eventListKey = (version: number | string, hash: string): string =>
  `events:list:${version}:${hash}`;

export const eventDetailKey = (eventId: string): string =>
  `events:detail:${eventId}`;

/** Available-seat counter per tier (step 5). Postgres stays the source of truth. */
export const seatsKey = (tierId: string): string => `seats:tier:${tierId}`;