import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { AuditLogPayload, DomainEvents } from '../common/events/domain-events';
import { AuditRepository } from './audit.repository';

/**
 * Persists audit rows for every 'audit.log' domain event (D27).
 * Never throws: the business write already committed, so an audit failure is logged only.
 */
@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly repo: AuditRepository) {}

  @OnEvent(DomainEvents.AUDIT_LOG, { async: true })
  async handleAuditLog(payload: AuditLogPayload): Promise<void> {
    try {
      await this.repo.create(payload);
    } catch (error) {
      this.logger.error(
        `Failed to write audit row (${payload.entityType} ${payload.entityId} ${payload.action}): ` +
          `${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}