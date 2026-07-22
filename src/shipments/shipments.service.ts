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
import { VehiclesService } from '../vehicles/vehicles.service';
import { DeliveryAttempt } from './delivery-attempt.entity';

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
  @IsNotEmpty({ message: 'Bắt buộc phải có loại chuyến xe (type)!' })
  @IsIn(['PICKUP', 'DELIVERY', 'RETURN'])
  type!: string;

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

  // ID xe từ bảng Vehicle master data (optional, ưu tiên khi có)
  @IsOptional()
  @IsString()
  vehicle_id?: string;
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
    private vehiclesService: VehiclesService,
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

  async findMyShipments(userId: string, page = 1, limit = 10, date?: string) {
    const query = this.shipmentsRepository
      .createQueryBuilder('shipment')
      .leftJoinAndSelect('shipment.origin_hub', 'origin_hub')
      .leftJoinAndSelect('shipment.destination_hub', 'destination_hub')
      .leftJoinAndSelect('shipment.orders', 'order')
      .leftJoinAndSelect('order.location', 'location')
      .leftJoin('shipment.shipper', 'shipper')
      .where('shipper.id = :userId', { userId });

    if (date) {
      query.andWhere('DATE(shipment.created_at) = :date', { date });
    }

    const [data, totalItems] = await query
      .orderBy('shipment.created_at', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    const shipmentIds = data.map((s) => s.id);
    if (shipmentIds.length > 0) {
      const attempts = await this.dataSource.manager.find(DeliveryAttempt, {
        where: {
          shipment: { id: In(shipmentIds) },
        },
        relations: { order: true, shipment: true },
      });

      for (const shipment of data) {
        if (shipment.orders) {
          for (const order of shipment.orders) {
            const attempt = attempts.find(
              (a) => a.shipment?.id === shipment.id && a.order?.id === order.id,
            );
            if (attempt) {
              // Attach attempt metadata without overwriting order.current_status
              // (attempt.status uses different vocabulary: IN_TRANSIT, FINISHED, FAILED, REMOVED)
              (order as unknown as Record<string, unknown>)[
                'delivery_attempt'
              ] = attempt;
            }
          }
        }
      }
    }

    return {
      data,
      meta: {
        totalItems,
        itemCount: data.length,
        itemsPerPage: limit,
        totalPages: Math.ceil(totalItems / limit),
        currentPage: page,
      },
    };
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

    // Nếu có vehicle_id, lấy thông tin từ Vehicle master data
    let vehicleRecord: import('../vehicles/vehicle.entity').Vehicle | null =
      null;
    if (data.vehicle_id) {
      try {
        const found = await this.vehiclesService.findOne(data.vehicle_id);
        if (found.status !== 'ACTIVE') {
          throw new BadRequestException(
            `Phương tiện ${found.license_plate} đang ${found.status === 'ON_TRIP' ? 'trong chuyến vận hành khác' : 'bảo trì'}, không thể tạo chuyến xe mới!`,
          );
        }
        // Ghi đè thông tin từ Vehicle master
        data.vehicle_number = found.license_plate;
        data.vehicle_type = found.vehicle_type;
        data.capacity_weight = found.capacity_weight;
        vehicleRecord = found;
      } catch (e) {
        if (e instanceof BadRequestException) throw e;
        // Vehicle not found — bỏ qua
      }
    }

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
      type: data.type || 'DELIVERY',
      vehicle: vehicleRecord,
    });

    return await this.shipmentsRepository.save(newShipment);
  }

  async assignOrdersToShipment(
    shipmentId: string,
    data: AssignOrdersDto,
    operatorId?: string,
  ) {
    const shipment = await this.shipmentsRepository.findOne({
      where: { id: shipmentId },
      relations: { orders: true, shipper: true },
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

      // Kiểm tra và gán chuyến xe theo loại
      const shipmentType = shipment.type || 'DELIVERY';
      const allowedStatuses: Record<string, string[]> = {
        PICKUP: ['PENDING'],
        DELIVERY: ['AT_HUB'],
        RETURN: ['RETURN_TO_SENDER'],
      };
      const typeLabels: Record<string, string> = {
        PICKUP: 'lấy hàng (PENDING)',
        DELIVERY: 'lưu kho (AT_HUB)',
        RETURN: 'chờ hoàn (RETURN_TO_SENDER)',
      };

      for (const order of orders) {
        const allowed = allowedStatuses[shipmentType] || [];
        if (!allowed.includes(order.current_status)) {
          throw new BadRequestException(
            `Đơn hàng ${order.tracking_number || order.id} không hợp lệ! Chuyến xe ${shipmentType} chỉ nhận đơn ở trạng thái: ${typeLabels[shipmentType]}.`,
          );
        }
        order.shipment = shipment;
        // Trạng thái đơn khi được xếp lên xe (chờ xuất bến)
        if (shipmentType === 'PICKUP') {
          order.current_status = 'IN_TRANSIT'; // Sẽ đổi thành PICKING khi xe xuất bến
        } else if (shipmentType === 'RETURN') {
          order.current_status = 'RETURNING'; // Chờ xe chạy
        } else {
          order.current_status = 'IN_TRANSIT'; // Đóng bao, lên tải
        }
      }

      // Lưu toàn bộ đơn hàng bằng Transaction
      await queryRunner.manager.save(orders);

      // Tạo DeliveryAttempt (nỗ lực giao hàng)
      for (const order of orders) {
        const attempt = queryRunner.manager.create(DeliveryAttempt, {
          order,
          shipment,
          shipper: shipment.shipper,
          status: 'PENDING',
        });
        await queryRunner.manager.save(DeliveryAttempt, attempt);
      }

      // Thêm mốc lịch sử hành trình cho từng đơn hàng
      for (const order of orders) {
        await this.trackingsService.addTrackingRecord({
          order,
          operatorId: operatorId,
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
        shipper: true,
      }, // Nạp kèm danh sách đơn hàng và location
    });

    if (!shipment) throw new NotFoundException('Không tìm thấy chuyến xe!');

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      shipment.status = data.status;
      await queryRunner.manager.save(shipment);

      const shipmentType = shipment.type || 'DELIVERY';

      // Nếu xe xuất bến (IN_TRANSIT) -> Đánh dấu xe ON_TRIP trong Vehicle master
      if (data.status === 'IN_TRANSIT' && shipment.vehicle_number) {
        await this.vehiclesService.setOnTrip(shipment.vehicle_number);
      }

      // Nếu xe xuất bến (IN_TRANSIT) -> Cập nhật trạng thái đơn theo loại chuyến
      if (data.status === 'IN_TRANSIT') {
        for (const order of shipment.orders) {
          if (
            order.current_status === 'CANCELLED' ||
            order.current_status === 'FINISHED' ||
            order.current_status === 'RETURNED'
          ) {
            continue;
          }

          // Rút hàng khỏi kệ khi xe bắt đầu chạy
          await this.locationsService.removeOrderFromLocation(
            order,
            queryRunner.manager,
          );

          // Cập nhật DeliveryAttempt
          const attempt = await queryRunner.manager.findOne(DeliveryAttempt, {
            where: { order: { id: order.id }, shipment: { id: shipment.id } },
          });
          if (attempt) {
            attempt.status = 'IN_TRANSIT';
            await queryRunner.manager.save(DeliveryAttempt, attempt);
          }

          // ─── Rẽ nhánh theo loại chuyến xe ───
          if (shipmentType === 'PICKUP') {
            // Xe lấy hàng: Đang trên đường đến shop lấy hàng
            order.current_status = 'PICKING';
          } else if (shipmentType === 'RETURN') {
            // Xe trả hàng: Đang trên đường trả về tay người gửi
            order.current_status = 'RETURNING';
          } else {
            // DELIVERY: Phụ thuộc loại phương tiện
            if (shipment.vehicle_type === 'BIKE') {
              order.current_status = 'DELIVERING'; // Xe máy giao thẳng tới khách
            }
            // TRUCK: giữ nguyên IN_TRANSIT, đang luân chuyển liên bưu cục
          }

          const typeNotes: Record<string, string> = {
            PICKUP: `Chuyến LẤY HÀNG ${shipment.shipment_code} xuất bến. Shipper ${shipment.shipper?.full_name} đang đến lấy hàng.`,
            DELIVERY:
              shipment.vehicle_type === 'TRUCK'
                ? `Chuyến GIAO HÀNG ${shipment.shipment_code} khởi hành từ ${shipment.origin_hub?.name} → ${shipment.destination_hub?.name || 'đích'}.`
                : `Chuyến GIAO HÀNG ${shipment.shipment_code} xuất bến. Shipper ${shipment.shipper?.full_name} bắt đầu giao.`,
            RETURN: `Chuyến HOÀN HÀNG ${shipment.shipment_code} xuất bến. Shipper ${shipment.shipper?.full_name} đang trả hàng về người gửi.`,
          };

          await this.trackingsService.addTrackingRecord({
            order,
            status: order.current_status,
            note:
              typeNotes[shipmentType] ||
              `Chuyến xe ${shipment.shipment_code} xuất bến.`,
          });
        }
      }
      // Nếu xe cập bến (COMPLETED) -> Rẽ nhánh theo loại chuyến + loại phương tiện
      else if (data.status === 'COMPLETED') {
        // Đồng bộ Vehicle master: xe ACTIVE trở lại
        // Xe tải chuyển về hub đích, xe máy giữ nguyên hub gốc
        if (shipment.vehicle_number) {
          const newHubId =
            shipment.vehicle_type === 'TRUCK' && shipment.destination_hub?.id
              ? shipment.destination_hub.id
              : undefined;
          await this.vehiclesService.setActive(
            shipment.vehicle_number,
            newHubId,
          );
        }

        for (const order of shipment.orders) {
          if (
            order.current_status === 'CANCELLED' ||
            order.current_status === 'FINISHED' ||
            order.current_status === 'RETURNED'
          ) {
            continue;
          }

          if (shipmentType === 'PICKUP') {
            // Chuyến LẤY HÀNG hoàn thành: toàn bộ đơn vào kho
            order.current_status = 'AT_HUB';
            order.shipment = null as any;
            await this.trackingsService.addTrackingRecord({
              order,
              status: 'AT_HUB',
              note: `Chuyến LẤY HÀNG ${shipment.shipment_code} hoàn thành. Đơn hàng đã nhập kho ${shipment.origin_hub?.name}.`,
            });
          } else if (shipmentType === 'DELIVERY') {
            if (shipment.vehicle_type === 'TRUCK') {
              // Xe tải GIAO HÀNG đến kho đích -> hạ tải, chờ phân phối tiếp
              order.current_status = 'AT_HUB';
              order.shipment = null as any;
              await this.trackingsService.addTrackingRecord({
                order,
                status: 'AT_HUB',
                note: `Chuyến GIAO HÀNG ${shipment.shipment_code} cập bến. Đơn hàng nhập kho ${shipment.destination_hub?.name || 'bưu cục đích'}.`,
              });
            }
            // BIKE DELIVERY: Không đổi trạng thái đơn.
            // Shipper sẽ tự cập nhật FINISHED / FAILED từng đơn qua app.
          } else if (shipmentType === 'RETURN') {
            if (shipment.vehicle_type === 'TRUCK') {
              // Xe tải HOÀN HÀNG đến kho gốc -> giữ RETURN_TO_SENDER, chờ bưu cục gốc phân phát
              order.current_status = 'RETURN_TO_SENDER';
              order.shipment = null as any;
              await this.trackingsService.addTrackingRecord({
                order,
                status: 'RETURN_TO_SENDER',
                note: `Chuyến HOÀN HÀNG ${shipment.shipment_code} cập bến ${shipment.destination_hub?.name || 'bưu cục gốc'}. Đơn chờ trả về tay người gửi.`,
              });
            }
            // BIKE RETURN: Không đổi trạng thái.
            // Shipper tự cập nhật RETURNED khi trả tận tay người gửi.
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

  async removeOrderFromShipment(
    shipmentId: string,
    orderId: string,
    operatorId?: string,
  ) {
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
    if (order.current_status === 'RETURNING') {
      order.current_status = 'RETURN_TO_SENDER';
    } else {
      order.current_status = 'AT_HUB';
    }
    await this.dataSource.manager.save(order);

    // Cập nhật DeliveryAttempt nếu có
    const attempt = await this.dataSource.manager.findOne(DeliveryAttempt, {
      where: { order: { id: order.id }, shipment: { id: shipment.id } },
    });
    if (
      attempt &&
      attempt.status !== 'FINISHED' &&
      attempt.status !== 'FAILED'
    ) {
      attempt.status = 'REMOVED';
      await this.dataSource.manager.save(DeliveryAttempt, attempt);
    }

    // Ghi nhận mốc hành trình giải phóng đơn hàng
    await this.trackingsService.addTrackingRecord({
      order,
      operatorId: operatorId,
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

          const attempt = await queryRunner.manager.findOne(DeliveryAttempt, {
            where: { order: { id: order.id }, shipment: { id: shipment.id } },
          });
          if (
            attempt &&
            attempt.status !== 'FINISHED' &&
            attempt.status !== 'FAILED'
          ) {
            attempt.status = 'REMOVED';
            await queryRunner.manager.save(DeliveryAttempt, attempt);
          }

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

  async cancelShipment(id: string, operatorId?: string) {
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

          const attempt = await queryRunner.manager.findOne(DeliveryAttempt, {
            where: { order: { id: order.id }, shipment: { id: shipment.id } },
          });
          if (
            attempt &&
            attempt.status !== 'FINISHED' &&
            attempt.status !== 'FAILED'
          ) {
            attempt.status = 'CANCELLED';
            await queryRunner.manager.save(DeliveryAttempt, attempt);
          }

          await this.trackingsService.addTrackingRecord({
            order,
            operatorId: operatorId,
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
