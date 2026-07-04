import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Rating } from './rating.entity';
import { Order } from '../orders/order.entity';
import {
  IsNotEmpty,
  IsString,
  IsOptional,
  IsInt,
  Min,
  Max,
} from 'class-validator';

export class CreateRatingDto {
  @IsString()
  @IsNotEmpty({ message: 'Bắt buộc phải cung cấp mã đơn hàng cần đánh giá!' })
  order_id!: string;

  @IsInt({ message: 'Số sao phải là một số nguyên!' })
  @Min(1, { message: 'Số sao đánh giá thấp nhất là 1!' })
  @Max(5, { message: 'Số sao đánh giá cao nhất là 5!' })
  stars!: number;

  @IsOptional()
  @IsString()
  comment?: string;
}

@Injectable()
export class RatingsService {
  constructor(
    @InjectRepository(Rating)
    private ratingsRepository: Repository<Rating>,

    @InjectRepository(Order)
    private ordersRepository: Repository<Order>,
  ) {}

  async createRating(userId: string, data: CreateRatingDto): Promise<Rating> {
    // 1. Tìm đơn hàng và gọi ra thông tin khách hàng lẫn shipper phụ trách
    const order = await this.ordersRepository.findOne({
      where: { id: data.order_id },
      relations: { shipper: true, customer: true },
    });

    if (!order) {
      throw new NotFoundException('Không tìm thấy đơn hàng hợp lệ!');
    }

    // Chốt chặn 1: Chỉ đơn hàng FINISHED mới được đánh giá
    if (order.current_status !== 'FINISHED') {
      throw new BadRequestException(
        'Chỉ có thể đánh giá những đơn hàng giao thành công (FINISHED)!',
      );
    }

    // Chốt chặn 2: Kiểm tra quyền sở hữu đơn hàng của khách hàng
    if (!order.customer || order.customer.id !== userId) {
      throw new BadRequestException(
        'Bạn không có quyền đánh giá đơn hàng của người khác!',
      );
    }

    // Chốt chặn 3: Kiểm tra xem đơn hàng này đã từng được đánh giá chưa
    const existingRating = await this.ratingsRepository.findOne({
      where: { order: { id: data.order_id } },
    });
    if (existingRating) {
      throw new BadRequestException(
        'Đơn hàng này đã được gửi đánh giá trước đó!',
      );
    }

    if (!order.shipper) {
      throw new BadRequestException(
        'Đơn hàng này không có shipper phụ trách để hệ thống ghi nhận đánh giá!',
      );
    }

    // 2. Tạo bản ghi đánh giá mới
    const newRating = this.ratingsRepository.create({
      order: order,
      shipper: order.shipper, // Tự động lấy shipper phụ trách đơn hàng
      stars: data.stars,
      comment: data.comment || '',
    });

    return await this.ratingsRepository.save(newRating);
  }
}
