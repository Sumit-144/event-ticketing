import { Logger } from '@nestjs/common';
import type { EventEmitter2 } from '@nestjs/event-emitter';
import { AuditLogPayload, DomainEvents } from './domain-events';

const logger = new Logger('DomainEvents');

/** Emit after commit; a listener failure is logged, never propagated to the caller. */
export function publishEvent<T>(emitter: EventEmitter2, name: string, payload: T): void {
  try {
    emitter.emit(name, payload);
  } catch (error) {
    logger.error(
      `Listener for '${name}' failed: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

export function publishAudit(emitter: EventEmitter2, payload: AuditLogPayload): void {
  publishEvent(emitter, DomainEvents.AUDIT_LOG, payload);
}