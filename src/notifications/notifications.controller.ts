import {
  Controller,
  Get,
  Patch,
  Param,
  UseGuards,
  Request,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { NotificationsService } from './notifications.service';

@Controller('notifications')
@UseGuards(AuthGuard('jwt'))
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  async getNotifications(@Request() req: { user: { userId: string } }) {
    const notifications = await this.notificationsService.getUserNotifications(
      req.user.userId,
    );
    return {
      message: 'Lấy thông báo thành công!',
      data: notifications,
    };
  }

  @Patch('mark-all-read')
  async markAllRead(@Request() req: { user: { userId: string } }) {
    await this.notificationsService.markAllRead(req.user.userId);
    return {
      message: 'Đã đánh dấu tất cả thông báo là đã đọc!',
    };
  }

  @Patch(':id/read')
  async markAsRead(
    @Param('id') id: string,
    @Request() req: { user: { userId: string } },
  ) {
    const notification = await this.notificationsService.markAsRead(
      id,
      req.user.userId,
    );
    return {
      message: 'Đã đọc thông báo!',
      data: notification,
    };
  }
}
