/** Client-facing socket event names and room naming (D29). */
export const WS_EVENTS = {
  SEATS_UPDATED: 'seats_updated',
  BOOKING_CONFIRMED: 'booking_confirmed',
  ORGANIZER_ALERT: 'organizer_alert',
  AUTH_ERROR: 'auth_error',
} as const;

/** Personal room: booking confirmation and organizer alerts. Joined automatically, own id only. */
export const userRoom = (userId: string) => `user:${userId}`;

/** Public room: live seat counts for one event. Joined on request via join_event. */
export const eventRoom = (eventId: string) => `event:${eventId}`;