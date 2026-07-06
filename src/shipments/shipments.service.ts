import {
  IsNotEmpty,
  IsString,
  IsOptional,
  IsArray,
  ArrayNotEmpty,
  IsIn,
} from 'class-validator';
import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, In } from 'typeorm';
import { Shipment } from './shipment.entity';
import { User } from '../users/user.entity';
import { Hub } from '../hubs/hub.entity';
import { Order } from '../orders/order.entity';

export class AssignOrdersDto {
  @IsArray()
  @ArrayNotEmpty({ message: 'Danh sách mã đơn hàng không được để trống!' })
  order_ids!: string[];
}

export class UpdateShipmentStatusDto {
  @IsString()
  @IsIn(['IN_TRANSIT', 'COMPLETED'], {
    message: 'Trạng thái không hợp lệ (Chỉ nhận IN_TRANSIT hoặc COMPLETED)!',
  })
  status!: string;
}

export class UpdateShipmentDto {
  @IsString()
  @IsOptional()
  shipper_id?: string;

  @IsOptional()
  @IsString()
  destination_hub_id?: string;

  @IsOptional()
  @IsString()
  vehicle_number?: string;
}

export class CreateShipmentDto {
  @IsString()
  @IsNotEmpty({ message: 'Bắt buộc phải chọn tài xế (shipper_id)!' })
  shipper_id!: string;

  @IsString()
  @IsNotEmpty({ message: 'Bắt buộc phải có trạm xuất phát (origin_hub_id)!' })
  origin_hub_id!: string;

  @IsOptional()
  @IsString()
  destination_hub_id?: string;

  @IsOptional()
  @IsString()
  vehicle_number?: string;
}

@Injectable()
export class ShipmentsService {
  constructor(
    @InjectRepository(Shipment)
    private shipmentsRepository: Repository<Shipment>,
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    @InjectRepository(Hub)
    private hubsRepository: Repository<Hub>,
    private dataSource: DataSource,
  ) {}

  private async generateShipmentCode(): Promise<string> {
    const today = new Date();
    const dateStr =
      today.getFullYear().toString().substring(2) +
      (today.getMonth() + 1).toString().padStart(2, '0') +
      today.getDate().toString().padStart(2, '0');

    const count = await this.shipmentsRepository.count();
    const sequence = (count + 1).toString().padStart(4, '0');
    return `CX${dateStr}-${sequence}`;
  }

  async createShipment(data: CreateShipmentDto): Promise<Shipment> {
    const shipper = await this.usersRepository.findOne({
      where: { id: data.shipper_id },
    });
    if (!shipper || shipper.role !== 'SHIPPER') {
      throw new NotFoundException('Không tìm thấy tài xế hợp lệ!');
    }

    const originHub = await this.hubsRepository.findOne({
      where: { id: data.origin_hub_id },
    });
    if (!originHub)
      throw new NotFoundException('Không tìm thấy trạm xuất phát!');

    let destinationHub: Hub | undefined = undefined;

    if (data.destination_hub_id) {
      const foundHub = await this.hubsRepository.findOne({
        where: { id: data.destination_hub_id },
      });
      if (!foundHub) throw new NotFoundException('Không tìm thấy trạm đích!');

      // Gán giá trị tìm được
      destinationHub = foundHub;
    }

    const shipmentCode = await this.generateShipmentCode();

    const newShipment = this.shipmentsRepository.create({
      shipment_code: shipmentCode,
      shipper,
      origin_hub: originHub,
      destination_hub: destinationHub,
      vehicle_number: data.vehicle_number,
      status: 'PENDING',
    });

    return await this.shipmentsRepository.save(newShipment);
  }

  // Thêm đơn hàng vào chuyến xe (Quét mã)
  async assignOrdersToShipment(shipmentId: string, data: AssignOrdersDto) {
    const shipment = await this.shipmentsRepository.findOne({
      where: { id: shipmentId },
    });
    if (!shipment) throw new NotFoundException('Không tìm thấy chuyến xe!');

    if (shipment.status !== 'PENDING') {
      throw new BadRequestException(
        'Chỉ có thể thêm hàng vào chuyến xe đang chờ (PENDING)!',
      );
    }

    // Khởi tạo Transaction
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Tìm tất cả đơn hàng dựa vào mảng ID gửi lên
      const orders = await queryRunner.manager.find(Order, {
        where: { id: In(data.order_ids) },
      });

      if (orders.length !== data.order_ids.length) {
        throw new BadRequestException(
          'Có mã đơn hàng không tồn tại trong hệ thống!',
        );
      }

      // Kiểm tra và gán chuyến xe
      for (const order of orders) {
        if (order.current_status !== 'AT_HUB') {
          throw new BadRequestException(
            `Đơn hàng ${order.id} không ở trạng thái lưu kho (AT_HUB)!`,
          );
        }
        order.shipment = shipment; // Liên kết đơn hàng vào chuyến xe
      }

      // Lưu toàn bộ đơn hàng bằng Transaction
      await queryRunner.manager.save(orders);

      await queryRunner.commitTransaction(); // Xác nhận thành công

      return {
        message: `Đã xếp ${orders.length} kiện hàng lên xe thành công!`,
        shipment_id: shipment.id,
      };
    } catch (error) {
      await queryRunner.rollbackTransaction(); // Nếu có lỗi, hoàn tác toàn bộ
      throw error;
    } finally {
      await queryRunner.release(); // Giải phóng connection
    }
  }

  // Cập nhật trạng thái chuyến xe (Xe lăn bánh / Xe cập bến)
  async updateShipmentStatus(
    shipmentId: string,
    data: UpdateShipmentStatusDto,
  ) {
    const shipment = await this.shipmentsRepository.findOne({
      where: { id: shipmentId },
      relations: { orders: true, destination_hub: true }, // Nạp kèm danh sách đơn hàng
    });

    if (!shipment) throw new NotFoundException('Không tìm thấy chuyến xe!');

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      shipment.status = data.status;
      await queryRunner.manager.save(shipment);

      // Nếu xe chạy (IN_TRANSIT) -> Chuyển trạng thái các đơn hàng thành "Đang luân chuyển"
      if (data.status === 'IN_TRANSIT') {
        for (const order of shipment.orders) {
          // Nếu có bưu cục đích -> Luân chuyển kho. Nếu không -> Đi giao trực tiếp cho khách.
          order.current_status = shipment.destination_hub
            ? 'IN_TRANSIT'
            : 'DELIVERING';
        }
      }
      // Nếu xe đến nơi (COMPLETED) -> Hạ tải, hàng nhập kho bưu cục đích
      else if (data.status === 'COMPLETED') {
        for (const order of shipment.orders) {
          order.current_status = 'AT_HUB';
          // Gỡ bỏ liên kết chuyến xe vì hàng đã xuống bãi
          order.shipment = null as any;
        }
      }

      // Lưu hàng loạt trạng thái đơn hàng
      if (shipment.orders.length > 0) {
        await queryRunner.manager.save(shipment.orders);
      }

      await queryRunner.commitTransaction();

      return {
        message: `Đã cập nhật trạng thái chuyến xe thành ${data.status}!`,
        shipment: shipment.id,
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async removeOrderFromShipment(shipmentId: string, orderId: string) {
    const shipment = await this.shipmentsRepository.findOne({
      where: { id: shipmentId },
    });
    if (!shipment) throw new NotFoundException('Không tìm thấy chuyến xe!');

    // Chốt chặn an toàn: Xe chạy rồi thì cấm rút hàng
    if (shipment.status !== 'PENDING') {
      throw new BadRequestException(
        'Chỉ có thể gỡ đơn hàng khi chuyến xe chưa lăn bánh (PENDING)!',
      );
    }

    // Tìm đơn hàng bằng query builder / entity manager để có thể truy cập relations
    const order = await this.dataSource.manager.findOne(Order, {
      where: { id: orderId },
      relations: { shipment: true },
    });

    if (!order) throw new NotFoundException('Không tìm thấy đơn hàng!');

    // Kiểm tra xem đơn hàng này có thực sự đang nằm trên chuyến xe này không
    if (!order.shipment || order.shipment.id !== shipmentId) {
      throw new BadRequestException(
        'Đơn hàng này không nằm trên chuyến xe hiện tại!',
      );
    }

    // Gỡ liên kết
    order.shipment = null as any;
    await this.dataSource.manager.save(order);

    return {
      message: `Đã gỡ đơn hàng ${order.id} khỏi chuyến xe an toàn!`,
      shipment_id: shipmentId,
    };
  }

  async updateShipment(id: string, data: UpdateShipmentDto): Promise<Shipment> {
    const shipment = await this.shipmentsRepository.findOne({
      where: { id },
      relations: { shipper: true, destination_hub: true },
    });
    if (!shipment) throw new NotFoundException('Không tìm thấy chuyến xe!');

    if (shipment.status !== 'PENDING') {
      throw new BadRequestException(
        'Chỉ có thể sửa chuyến xe chưa lăn bánh (PENDING)!',
      );
    }

    if (data.shipper_id) {
      const shipper = await this.usersRepository.findOne({
        where: { id: data.shipper_id },
      });
      if (!shipper || shipper.role !== 'SHIPPER') {
        throw new NotFoundException('Không tìm thấy tài xế hợp lệ!');
      }
      shipment.shipper = shipper;
    }

    if (data.vehicle_number !== undefined) {
      shipment.vehicle_number = data.vehicle_number.toUpperCase();
    }

    if (data.destination_hub_id !== undefined) {
      if (data.destination_hub_id === '' || data.destination_hub_id === null) {
        shipment.destination_hub = null as any;
      } else {
        const foundHub = await this.hubsRepository.findOne({
          where: { id: data.destination_hub_id },
        });
        if (!foundHub) throw new NotFoundException('Không tìm thấy trạm đích!');
        shipment.destination_hub = foundHub;
      }
    }

    return await this.shipmentsRepository.save(shipment);
  }

  async deleteShipment(id: string) {
    const shipment = await this.shipmentsRepository.findOne({
      where: { id },
      relations: { orders: true },
    });
    if (!shipment) throw new NotFoundException('Không tìm thấy chuyến xe!');

    if (shipment.status !== 'PENDING') {
      throw new BadRequestException(
        'Chỉ có thể xóa chuyến xe chưa lăn bánh (PENDING)!',
      );
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      if (shipment.orders && shipment.orders.length > 0) {
        for (const order of shipment.orders) {
          order.shipment = null as any;
          await queryRunner.manager.save(order);
        }
      }
      await queryRunner.manager.remove(shipment);
      await queryRunner.commitTransaction();
      return { message: 'Xóa chuyến xe thành công!' };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }
}
