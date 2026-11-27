import type { EmailTemplate } from './queue.types';

export const QUEUES = {
  EMAIL: 'email',
  TICKET: 'ticket',
  REMINDER: 'reminder',
  DEAD_LETTER: 'dead-letter',
} as const;

export const JOB_NAMES = {
  SEND_EMAIL: 'send-email',
  GENERATE_TICKET: 'generate-ticket',
  SEND_REMINDER: 'send-reminder',
  DEAD_LETTER: 'dead-letter-entry',
} as const;

/** Reminder fires this long before the event starts (D25). */
export const REMINDER_LEAD_MS = 24 * 60 * 60 * 1000;

/**
 * Deterministic job ids (D24). BullMQ forbids ':' in custom ids, so hyphens only.
 * Same id while the first job still exists = duplicate add is ignored.
 */
export const jobIds = {
  email: (template: EmailTemplate, bookingId: string) => `email-${template}-${bookingId}`,
  ticket: (bookingId: string) => `ticket-${bookingId}`,
  reminder: (bookingId: string) => `reminder-${bookingId}`,
};