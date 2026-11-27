import { Injectable } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { AuditLogPayload } from '../common/events/domain-events';

/** Prisma Json columns reject a plain null: use JsonNull, or skip the field when undefined. */
function toJson(value: unknown): Prisma.InputJsonValue | typeof Prisma.JsonNull | undefined {
  if (value === undefined) return undefined;
  if (value === null) return Prisma.JsonNull;
  return value as Prisma.InputJsonValue;
}

/** Only layer that touches Prisma for audit rows. */
@Injectable()
export class AuditRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(entry: AuditLogPayload): Promise<void> {
    await this.prisma.auditLog.create({
      data: {
        userId: entry.userId,
        entityType: entry.entityType,
        entityId: entry.entityId,
        action: entry.action,
        before: toJson(entry.before),
        after: toJson(entry.after),
        ipAddress: entry.ipAddress ?? null,
      },
    });
  }
}