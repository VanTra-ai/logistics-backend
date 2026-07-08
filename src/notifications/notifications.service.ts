import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Notification } from './notification.entity';
import { User } from '../users/user.entity';
import { NotificationsGateway } from './notifications.gateway';

@Injectable()
export class NotificationsService {
  constructor(
    @InjectRepository(Notification)
    private readonly notificationRepository: Repository<Notification>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly notificationsGateway: NotificationsGateway,
  ) {}

  async createNotification(
    userId: string,
    title: string,
    message: string,
    type?: string,
  ) {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) return;

    const notification = this.notificationRepository.create({
      user,
      title,
      message,
      type,
    });

    const savedNotification =
      await this.notificationRepository.save(notification);

    // Bắn socket tới client
    this.notificationsGateway.sendNotificationToUser(userId, savedNotification);

    return savedNotification;
  }

  async getUserNotifications(userId: string) {
    return await this.notificationRepository.find({
      where: { user: { id: userId } },
      order: { createdAt: 'DESC' },
    });
  }

  async markAsRead(notificationId: string, userId: string) {
    const notification = await this.notificationRepository.findOne({
      where: { id: notificationId, user: { id: userId } },
    });

    if (notification) {
      notification.isRead = true;
      return await this.notificationRepository.save(notification);
    }

    return null;
  }

  async markAllRead(userId: string) {
    await this.notificationRepository.update(
      { user: { id: userId }, isRead: false },
      { isRead: true },
    );
  }
}
