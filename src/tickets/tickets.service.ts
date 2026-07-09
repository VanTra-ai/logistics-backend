import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Ticket } from './ticket.entity';
import { TicketComment } from './ticket-comment.entity';
import { Order } from '../orders/order.entity';
import { NotificationsGateway } from '../notifications/notifications.gateway';
import {
  IsNotEmpty,
  IsString,
  IsOptional,
  IsArray,
  IsIn,
} from 'class-validator';

export class CreateTicketDto {
  @IsOptional()
  @IsString()
  order_id?: string;

  @IsString()
  @IsNotEmpty({
    message: 'Vui lòng phân loại sự cố (VD: Hàng vỡ, Thái độ shipper...)!',
  })
  issue_type!: string;

  @IsString()
  @IsNotEmpty({ message: 'Vui lòng cung cấp chi tiết mô tả sự cố!' })
  description!: string;

  // Sử dụng @IsString({ each: true }) để kiểm tra từng phần tử trong mảng
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  evidence_images?: string[];
}

export class ResolveTicketDto {
  @IsString()
  @IsNotEmpty({
    message: 'Nội dung phản hồi cho khách hàng không được để trống!',
  })
  admin_response!: string;

  @IsOptional()
  @IsString()
  @IsIn(['RESOLVED', 'CLOSED', 'REJECTED'], {
    message: 'Trạng thái chuyển đổi phải là RESOLVED, CLOSED hoặc REJECTED!',
  })
  status?: string;
}

@Injectable()
export class TicketsService {
  constructor(
    @InjectRepository(Ticket)
    private ticketsRepository: Repository<Ticket>,

    @InjectRepository(TicketComment)
    private ticketCommentsRepository: Repository<TicketComment>,

    @InjectRepository(Order) // Cần để validate mã đơn hàng nếu có
    private ordersRepository: Repository<Order>,

    private readonly notificationsGateway: NotificationsGateway,
  ) {}

  async createTicket(userId: string, data: CreateTicketDto): Promise<Ticket> {
    // 1. Sửa lỗi định dạng: Khai báo rõ kiểu dữ liệu thay vì gán bằng null
    let order: Order | undefined = undefined;

    // 2. Kiểm tra đơn hàng nếu có
    if (data.order_id) {
      const foundOrder = await this.ordersRepository.findOne({
        where: { id: data.order_id },
      });

      if (!foundOrder) {
        throw new NotFoundException(
          'Không tìm thấy đơn hàng liên quan đến khiếu nại này!',
        );
      }
      // Gán kết quả tìm được vào biến order
      order = foundOrder;
    }

    // 3. Tạo bản ghi
    const newTicket = this.ticketsRepository.create({
      customer: { id: userId },
      order: order, // TypeORM hoàn toàn vui vẻ với undefined hoặc Order
      issue_type: data.issue_type,
      description: data.description,
      evidence_images: data.evidence_images || [],
      status: 'OPEN',
    });

    // 4. Lưu vào CSDL
    return await this.ticketsRepository.save(newTicket);
  }

  async getMyTickets(userId: string): Promise<Ticket[]> {
    return await this.ticketsRepository.find({
      where: { customer: { id: userId } },
      relations: { order: true }, // Join bảng để frontend hiển thị được mã đơn hàng
      order: { created_at: 'DESC' }, // Sắp xếp khiếu nại mới nhất lên đầu
    });
  }

  async getAllTickets(currentUser: {
    role?: string;
    hubId?: string;
  }): Promise<Ticket[]> {
    if (currentUser.role === 'HUB_COORDINATOR') {
      return await this.ticketsRepository.find({
        where: { order: { pickup_hub: { id: currentUser.hubId } } },
        relations: { order: { pickup_hub: true }, customer: true },
        order: { created_at: 'DESC' },
      });
    }

    return await this.ticketsRepository.find({
      relations: { order: { pickup_hub: true }, customer: true },
      order: { created_at: 'DESC' },
    });
  }

  async resolveTicket(
    ticketId: string,
    data: ResolveTicketDto,
    currentUser: { userId: string; role?: string; hubId?: string },
  ): Promise<Ticket> {
    // 1. Tìm ticket trong CSDL
    const ticket = await this.ticketsRepository.findOne({
      where: { id: ticketId },
      relations: {
        order: {
          pickup_hub: true,
        },
        customer: true,
      }, // Load thêm thông tin để hiển thị đầy đủ sau khi update
    });

    if (!ticket) {
      throw new NotFoundException('Không tìm thấy yêu cầu khiếu nại!');
    }

    if (
      currentUser?.role === 'HUB_COORDINATOR' &&
      ticket.order?.pickup_hub?.id !== currentUser?.hubId
    ) {
      throw new ForbiddenException(
        'Bạn chỉ có quyền giải quyết khiếu nại cho đơn hàng thuộc bưu cục của mình!',
      );
    }

    // 2. Cập nhật thông tin phản hồi và trạng thái
    ticket.admin_response = data.admin_response;
    ticket.status = data.status || 'RESOLVED'; // Nếu không truyền status lên thì mặc định là RESOLVED

    // 3. Lưu lại vào Database
    const savedTicket = await this.ticketsRepository.save(ticket);

    // 4. Bắn Notification cho khách hàng
    if (ticket.customer) {
      this.notificationsGateway.sendNotificationToUser(ticket.customer.id, {
        title: 'Khiếu nại của bạn đã được phản hồi',
        message: `Quản trị viên đã phản hồi khiếu nại liên quan đến đơn hàng ${ticket.order?.tracking_number || ''}`,
        ticketId: ticket.id,
      });
    }

    return savedTicket;
  }

  async addComment(
    ticketId: string,
    userId: string,
    message: string,
    isStaff: boolean,
    attachments?: string[],
  ): Promise<TicketComment> {
    const ticket = await this.ticketsRepository.findOne({
      where: { id: ticketId },
    });
    if (!ticket) throw new NotFoundException('Không tìm thấy khiếu nại!');

    const comment = this.ticketCommentsRepository.create({
      ticket: { id: ticketId },
      user: { id: userId },
      message,
      is_staff: isStaff,
      attachments: attachments || [],
    });

    return await this.ticketCommentsRepository.save(comment);
  }

  async getComments(ticketId: string): Promise<TicketComment[]> {
    return await this.ticketCommentsRepository.find({
      where: { ticket: { id: ticketId } },
      relations: { user: true },
      order: { created_at: 'ASC' },
    });
  }
}
