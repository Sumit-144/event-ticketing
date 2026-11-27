import { Module } from '@nestjs/common';
import { AuditRepository } from './audit.repository';
import { AuditService } from './audit.service';

/** Listen-only module: nothing imports it, it just needs to be registered in AppModule. */
@Module({
  providers: [AuditRepository, AuditService],
})
export class AuditModule {}