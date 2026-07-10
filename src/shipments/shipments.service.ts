import {
  IsNotEmpty,
  IsString,
  IsOptional,
  IsArray,
  ArrayNotEmpty,
  IsIn,
  IsNumber,
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
import { TrackingsService } from '../trackings/trackings.service';
import { LocationsService } from '../locations/locations.service';

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

  @IsString()
  @IsOptional()
  @IsIn(['BIKE', 'TRUCK'])
  vehicle_type?: string;

  @IsOptional()
  @IsString()
  destination_hub_id?: string;

  @IsOptional()
  @IsString()
  vehicle_number?: string;

  @IsOptional()
  @IsNumber()
  capacity_weight?: number;
}

export class CreateShipmentDto {
  @IsString()
  @IsNotEmpty({ message: 'Bắt buộc phải chọn tài xế (shipper_id)!' })
  shipper_id!: string;

  @IsString()
  @IsNotEmpty({ message: 'Bắt buộc phải có loại phương tiện (vehicle_type)!' })
  @IsIn(['BIKE', 'TRUCK'])
  vehicle_type!: string;

  @IsString()
  @IsNotEmpty({ message: 'Bắt buộc phải có trạm xuất phát (origin_hub_id)!' })
  origin_hub_id!: string;

  @IsOptional()
  @IsString()
  destination_hub_id?: string;

  @IsOptional()
  @IsString()
  vehicle_number?: string;

  @IsOptional()
  @IsNumber()
  capacity_weight?: number;
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
    private trackingsService: TrackingsService,
    private locationsService: LocationsService,
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

  async findAllShipments(): Promise<Shipment[]> {
    return await this.shipmentsRepository.find({
      relations: {
        origin_hub: true,
        destination_hub: true,
        shipper: true,
        orders: true,
      },
      order: { created_at: 'DESC' },
    });
  }

  async createShipment(data: CreateShipmentDto): Promise<Shipment> {
    const shipper = await this.usersRepository.findOne({
      where: { id: data.shipper_id },
    });
    if (!shipper || shipper.role !== 'SHIPPER') {
      throw new NotFoundException('Không tìm thấy tài xế hợp lệ!');
    }

    // Kiểm tra xem Shipper có đang bận ở chuyến xe nào có status là IN_TRANSIT không
    const activeShipment = await this.shipmentsRepository.findOne({
      where: { shipper: { id: data.shipper_id }, status: 'IN_TRANSIT' },
    });
    if (activeShipment) {
      throw new BadRequestException(
        `Tài xế ${shipper.full_name} đang bận thực hiện chuyến xe ${activeShipment.shipment_code || activeShipment.id} chưa kết thúc!`,
      );
    }

    // Kiểm tra xem Biển kiểm soát xe có đang bận di chuyển không
    if (data.vehicle_number) {
      const activeVehicle = await this.shipmentsRepository.findOne({
        where: {
          vehicle_number: data.vehicle_number.toUpperCase(),
          status: 'IN_TRANSIT',
        },
      });
      if (activeVehicle) {
        throw new BadRequestException(
          `Phương tiện mang biển kiểm soát ${data.vehicle_number.toUpperCase()} đang di chuyển trong chuyến xe ${activeVehicle.shipment_code || activeVehicle.id}!`,
        );
      }
    }

    const originHub = await this.hubsRepository.findOne({
      where: { id: data.origin_hub_id },
    });
    if (!originHub)
      throw new NotFoundException('Không tìm thấy trạm xuất phát!');

    let destinationHub: Hub | undefined = undefined;

    if (data.destination_hub_id) {
      if (data.vehicle_type === 'BIKE') {
        throw new BadRequestException(
          'Xe máy giao hàng (BIKE) không được chọn bưu cục đích đến!',
        );
      }

      const foundHub = await this.hubsRepository.findOne({
        where: { id: data.destination_hub_id },
      });
      if (!foundHub) throw new NotFoundException('Không tìm thấy trạm đích!');

      // Gán giá trị tìm được
      destinationHub = foundHub;
    } else {
      if (data.vehicle_type === 'TRUCK') {
        throw new BadRequestException(
          'Chuyến xe tải luân chuyển (TRUCK) bắt buộc phải có bưu cục đích đến!',
        );
      }
    }

    const shipmentCode = await this.generateShipmentCode();

    const newShipment = this.shipmentsRepository.create({
      shipment_code: shipmentCode,
      shipper,
      origin_hub: originHub,
      destination_hub: destinationHub,
      vehicle_type: data.vehicle_type,
      vehicle_number: data.vehicle_number,
      capacity_weight:
        data.capacity_weight !== undefined
          ? Number(data.capacity_weight)
          : 1000,
      status: 'PENDING',
    });

    return await this.shipmentsRepository.save(newShipment);
  }

  async assignOrdersToShipment(shipmentId: string, data: AssignOrdersDto) {
    const shipment = await this.shipmentsRepository.findOne({
      where: { id: shipmentId },
      relations: { orders: true },
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

      // Kiểm soát tải trọng của xe
      const currentWeight = (shipment.orders || []).reduce(
        (sum, o) => sum + Number(o.weight || 0),
        0,
      );
      const incomingWeight = orders.reduce(
        (sum, o) => sum + Number(o.weight || 0),
        0,
      );
      const limitWeight = Number(shipment.capacity_weight || 1000);

      if (currentWeight + incomingWeight > limitWeight) {
        throw new BadRequestException(
          `Vượt quá tải trọng tối đa của xe (Tổng hàng: ${(currentWeight + incomingWeight).toFixed(2)}kg > Tải trọng: ${limitWeight}kg)!`,
        );
      }

      // Kiểm tra và gán chuyến xe
      for (const order of orders) {
        if (order.current_status !== 'AT_HUB') {
          throw new BadRequestException(
            `Đơn hàng ${order.tracking_number || order.id} không ở trạng thái lưu kho (AT_HUB)!`,
          );
        }
        order.shipment = shipment; // Liên kết đơn hàng vào chuyến xe
        order.current_status = 'IN_TRANSIT'; // Đã đóng bao / Lên tải
      }

      // Lưu toàn bộ đơn hàng bằng Transaction
      await queryRunner.manager.save(orders);

      // Thêm mốc lịch sử hành trình cho từng đơn hàng
      for (const order of orders) {
        await this.trackingsService.addTrackingRecord({
          order,
          status: 'IN_TRANSIT',
          note: `Đơn hàng đã được xếp vào chuyến xe ${shipment.shipment_code || shipment.id} chuẩn bị lăn bánh.`,
        });
      }

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
      relations: {
        orders: { location: true },
        destination_hub: true,
        origin_hub: true,
      }, // Nạp kèm danh sách đơn hàng và location
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
          // Bỏ qua các đơn hàng đã hủy / chuyển hoàn để tránh lỗi hồi sinh đơn
          if (
            order.current_status === 'CANCELLED' ||
            order.current_status === 'RETURNED_TO_SENDER'
          ) {
            continue;
          }

          // Rút hàng khỏi kệ (pick-out) khi xe bắt đầu chạy
          await this.locationsService.removeOrderFromLocation(
            order,
            queryRunner.manager,
          );

          // Trạng thái đơn hàng dựa trên loại xe
          if (shipment.vehicle_type === 'BIKE') {
            order.current_status = 'DELIVERING';
          }
          // Nếu là TRUCK, giữ nguyên IN_TRANSIT

          // Xóa dòng removeOrderFromLocation bị trùng lặp

          // Ghi nhận mốc luân chuyển hành trình
          await this.trackingsService.addTrackingRecord({
            order,
            status: order.current_status,
            note:
              shipment.vehicle_type === 'TRUCK'
                ? `Chuyến xe luân chuyển ${shipment.shipment_code} đã khởi hành từ ${shipment.origin_hub?.name || 'bưu cục gửi'} đi bưu cục ${shipment.destination_hub?.name || 'đích'}.`
                : `Chuyến xe giao hàng trực tiếp ${shipment.shipment_code} đã lăn bánh đi giao tới người nhận.`,
          });
        }
      }
      // Nếu xe đến nơi (COMPLETED) -> Hạ tải, hàng nhập kho bưu cục đích
      else if (data.status === 'COMPLETED') {
        for (const order of shipment.orders) {
          // Bỏ qua các đơn hàng đã hủy / chuyển hoàn để tránh lỗi hồi sinh đơn
          if (
            order.current_status === 'CANCELLED' ||
            order.current_status === 'RETURNED_TO_SENDER'
          ) {
            continue;
          }

          if (shipment.vehicle_type === 'TRUCK') {
            order.current_status = 'AT_HUB';
            // Gỡ bỏ liên kết chuyến xe vì hàng đã xuống bãi
            order.shipment = null as any;

            // Ghi nhận mốc hạ tải hành trình
            await this.trackingsService.addTrackingRecord({
              order,
              status: 'AT_HUB',
              note: `Chuyến xe luân chuyển ${shipment.shipment_code} đã hoàn thành cập bến. Đơn hàng đã hạ tải nhập kho bưu cục ${shipment.destination_hub?.name || 'đích'}.`,
            });
          }
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

    // Gỡ liên kết và trả về kho
    order.shipment = null as any;
    order.current_status = 'AT_HUB';
    await this.dataSource.manager.save(order);

    // Ghi nhận mốc hành trình giải phóng đơn hàng
    await this.trackingsService.addTrackingRecord({
      order,
      status: 'AT_HUB',
      note: `Đơn hàng được gỡ khỏi chuyến xe gom nhóm ${shipment.shipment_code || shipment.id} và đưa về trạng thái lưu kho bãi.`,
    });

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

      const activeShipment = await this.shipmentsRepository.findOne({
        where: { shipper: { id: data.shipper_id }, status: 'IN_TRANSIT' },
      });
      if (activeShipment && activeShipment.id !== id) {
        throw new BadRequestException(
          `Tài xế ${shipper.full_name} đang bận thực hiện chuyến xe ${activeShipment.shipment_code || activeShipment.id} chưa kết thúc!`,
        );
      }
      shipment.shipper = shipper;
    }

    if (data.vehicle_number !== undefined) {
      const vNum = data.vehicle_number.toUpperCase();
      if (vNum) {
        const activeVehicle = await this.shipmentsRepository.findOne({
          where: { vehicle_number: vNum, status: 'IN_TRANSIT' },
        });
        if (activeVehicle && activeVehicle.id !== id) {
          throw new BadRequestException(
            `Phương tiện mang biển kiểm soát ${vNum} đang di chuyển trong chuyến xe ${activeVehicle.shipment_code || activeVehicle.id}!`,
          );
        }
      }
      shipment.vehicle_number = vNum;
    }

    if (data.capacity_weight !== undefined) {
      shipment.capacity_weight = Number(data.capacity_weight);
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

          // Ghi nhận mốc hành trình giải phóng đồng loạt
          await this.trackingsService.addTrackingRecord({
            order,
            status: 'AT_HUB',
            note: `Hủy gom nhóm chuyến xe ${shipment.shipment_code || shipment.id}. Đơn hàng được giải phóng quay lại kho bãi.`,
          });
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

  async cancelShipment(id: string) {
    const shipment = await this.shipmentsRepository.findOne({
      where: { id },
      relations: { orders: true },
    });
    if (!shipment) throw new NotFoundException('Không tìm thấy chuyến xe!');

    if (shipment.status !== 'PENDING') {
      throw new BadRequestException(
        'Chỉ có thể hủy chuyến xe chưa lăn bánh (PENDING)!',
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

          await this.trackingsService.addTrackingRecord({
            order,
            status: 'AT_HUB',
            note: `Hủy chuyến xe ${shipment.shipment_code || shipment.id} do sự cố. Đơn hàng được giải phóng quay lại kho bãi.`,
          });
        }
      }

      shipment.status = 'CANCELLED';
      await queryRunner.manager.save(shipment);

      await queryRunner.commitTransaction();
      return { message: 'Hủy chuyến xe thành công!' };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }
}
