import { Logger, UseGuards } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  WsException,
} from '@nestjs/websockets';
import { isUUID } from 'class-validator';
import type { Namespace, Socket } from 'socket.io';
import { WsAuthGuard } from '../common/guards/ws-auth.guard';
import { WS_EVENTS, eventRoom, userRoom } from './notifications.constants';

/**
 * socket.io gateway on the /notifications namespace (D29).
 * Guards and the global ValidationPipe do NOT run on the connection event, so the gateway
 * authenticates in handleConnection itself and validates message bodies by hand.
 */
@WebSocketGateway({ namespace: 'notifications' })
export class NotificationsGateway implements OnGatewayConnection {
  private readonly logger = new Logger(NotificationsGateway.name);

  /** With a namespace set, this is the Namespace instance: server.to(room).emit(...) works. */
  @WebSocketServer()
  server!: Namespace;

  constructor(private readonly wsAuth: WsAuthGuard) {}

  /** Verify the handshake JWT, cache the user on the socket, join the personal room. */
  async handleConnection(client: Socket): Promise<void> {
    try {
      const user = await this.wsAuth.authenticate(client);
      client.data.user = user;
      await client.join(userRoom(user.id));
      this.logger.log(`Socket ${client.id} connected as user ${user.id}`);
    } catch (error) {
      const reason = error instanceof WsException ? error.getError() : null;
      const message = typeof reason === 'string' ? reason : 'Authentication failed';
      if (!(error instanceof WsException)) {
        // Not an auth problem (for example Redis down, fails closed): worth a log line.
        this.logger.error(
          `Socket auth error: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
      client.emit(WS_EVENTS.AUTH_ERROR, { message });
      client.disconnect(true);
    }
  }

  /** Seat counts are public data, so there is no DB check on the event id (D29). */
  @UseGuards(WsAuthGuard)
  @SubscribeMessage('join_event')
  async joinEvent(@ConnectedSocket() client: Socket, @MessageBody() body: unknown) {
    const eventId = this.parseEventId(body);
    await client.join(eventRoom(eventId));
    return { event: 'joined', data: { eventId } };
  }

  @UseGuards(WsAuthGuard)
  @SubscribeMessage('leave_event')
  async leaveEvent(@ConnectedSocket() client: Socket, @MessageBody() body: unknown) {
    const eventId = this.parseEventId(body);
    await client.leave(eventRoom(eventId));
    return { event: 'left', data: { eventId } };
  }

  private parseEventId(body: unknown): string {
    const eventId = (body as { eventId?: unknown } | null)?.eventId;
    if (typeof eventId !== 'string' || !isUUID(eventId)) {
      throw new WsException('eventId must be a UUID');
    }
    return eventId;
  }
}