import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Ticket } from './ticket.entity';
import { Order } from '../orders/order.entity';
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

    @InjectRepository(Order) // Cần để validate mã đơn hàng nếu có
    private ordersRepository: Repository<Order>,
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

  async resolveTicket(
    ticketId: string,
    data: ResolveTicketDto,
  ): Promise<Ticket> {
    // 1. Tìm ticket trong CSDL
    const ticket = await this.ticketsRepository.findOne({
      where: { id: ticketId },
      relations: { order: true, customer: true }, // Load thêm thông tin để hiển thị đầy đủ sau khi update
    });

    if (!ticket) {
      throw new NotFoundException('Không tìm thấy yêu cầu khiếu nại!');
    }

    // 2. Cập nhật thông tin phản hồi và trạng thái
    ticket.admin_response = data.admin_response;
    ticket.status = data.status || 'RESOLVED'; // Nếu không truyền status lên thì mặc định là RESOLVED

    // 3. Lưu lại vào Database
    return await this.ticketsRepository.save(ticket);
  }
}
