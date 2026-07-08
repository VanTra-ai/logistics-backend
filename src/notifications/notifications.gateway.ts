import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import * as jwt from 'jsonwebtoken';
import { ConfigService } from '@nestjs/config';

@WebSocketGateway({ cors: true })
export class NotificationsGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server!: Server;

  constructor(private configService: ConfigService) {}

  handleConnection(client: Socket) {
    try {
      const token =
        client.handshake.auth?.token || client.handshake.headers?.authorization;
      if (!token) {
        client.disconnect();
        return;
      }

      const secret =
        this.configService.get<string>('JWT_SECRET') || 'SECRET_KEY';
      const decoded = jwt.verify(
        String(token).replace('Bearer ', ''),
        secret,
      ) as {
        userId: string;
      };

      if (decoded && decoded.userId) {
        void client.join(decoded.userId); // Join room by userId for multi-device support
      } else {
        client.disconnect();
      }
    } catch {
      client.disconnect();
    }
  }

  handleDisconnect() {
    // Socket.io automatically handles room leave on disconnect. No manual action needed.
  }

  sendNotificationToUser(userId: string, notification: any) {
    this.server.to(userId).emit('new_notification', notification);
  }
}
