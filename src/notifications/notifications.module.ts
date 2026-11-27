import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { WsAuthGuard } from '../common/guards/ws-auth.guard';
import { NotificationsGateway } from './notifications.gateway';
import { NotificationsListener } from './notifications.listener';
import { NotificationsService } from './notifications.service';

/**
 * Real-time layer. Imports AuthModule only for JwtService (WsAuthGuard needs it);
 * RedisService and AppConfigService come from their global modules.
 */
@Module({
  imports: [AuthModule],
  providers: [WsAuthGuard, NotificationsGateway, NotificationsService, NotificationsListener],
})
export class NotificationsModule {}