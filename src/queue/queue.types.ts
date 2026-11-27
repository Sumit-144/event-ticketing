import type { BookingStatus, EventStatus } from '../../generated/prisma/client';

export type EmailTemplate = 'booking-confirmed' | 'booking-cancelled' | 'event-reminder';

/** Payloads carry ids only; processors reload the row so the DB stays the source of truth. */
export interface EmailJobData {
  template: EmailTemplate;
  bookingId: string;
}

export interface TicketJobData {
  bookingId: string;
}

export interface ReminderJobData {
  bookingId: string;
}

/** Copy of a job that exhausted its retries (or failed unrecoverably). */
export interface DeadLetterJobData {
  sourceQueue: string;
  jobName: string;
  jobId: string | undefined;
  data: unknown;
  failedReason: string;
  attemptsMade: number;
  stack?: string;
  failedAt: string;
}

/** Everything the notification processors need, loaded with one query. */
export interface BookingNotificationView {
  id: string;
  status: BookingStatus;
  quantity: number;
  totalAmount: string;
  ticketCode: string;
  userName: string;
  userEmail: string;
  tierName: string;
  eventTitle: string;
  eventVenue: string;
  eventCity: string;
  eventStartDate: Date;
  eventStatus: EventStatus;
  eventDeleted: boolean;
}   