import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import * as jwt from 'jsonwebtoken';

@WebSocketGateway({ cors: true })
export class NotificationsGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server!: Server;

  // Map userId -> socketId
  private connectedUsers = new Map<string, string>();

  handleConnection(client: Socket) {
    try {
      const token =
        client.handshake.auth?.token || client.handshake.headers?.authorization;
      if (!token) {
        client.disconnect();
        return;
      }

      // Giải mã token (giả sử secret key là process.env.JWT_SECRET hoặc default)
      // Lưu ý: Cần import config hoặc dùng secret tương ứng
      const secret = process.env.JWT_SECRET || 'SECRET_KEY';
      const decoded = jwt.verify(
        String(token).replace('Bearer ', ''),
        secret,
      ) as {
        userId: string;
      };

      if (decoded && decoded.userId) {
        this.connectedUsers.set(decoded.userId, client.id);
      } else {
        client.disconnect();
      }
    } catch {
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    // Xóa user khỏi map khi ngắt kết nối
    for (const [userId, socketId] of this.connectedUsers.entries()) {
      if (socketId === client.id) {
        this.connectedUsers.delete(userId);
        break;
      }
    }
  }

  // Phương thức để gửi notification
  sendNotificationToUser(userId: string, notification: any) {
    const socketId = this.connectedUsers.get(userId);
    if (socketId) {
      this.server.to(socketId).emit('new_notification', notification);
    }
  }
}
