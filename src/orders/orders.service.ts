import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, DataSource, FindOptionsWhere, ILike } from 'typeorm';
import { Order } from './order.entity';
import { HubsService } from '../hubs/hubs.service';
import { Hub } from '../hubs/hub.entity';
import { TrackingsService } from '../trackings/trackings.service';
import { User } from '../users/user.entity';
import { Wallet } from '../wallets/wallet.entity';
import { Transaction } from '../wallets/transaction.entity';
import { Shipment } from '../shipments/shipment.entity';
import { DeliveryAttempt } from '../shipments/delivery-attempt.entity';
import { FinanceService } from '../finance/finance.service';
import { FinanceTariff } from '../finance/finance.entity';
import {
  IsNotEmpty,
  IsString,
  IsOptional,
  IsNumber,
  IsArray,
  ArrayNotEmpty,
  Min,
  Max,
} from 'class-validator';

interface OrderStats {
  status: string;
  count: string | number;
}

export class CreateOrderDto {
  @IsString()
  @IsNotEmpty()
  sender_name!: string;

  @IsString()
  @IsNotEmpty()
  sender_phone!: string;

  @IsString()
  @IsNotEmpty()
  sender_address!: string;

  @IsString()
  @IsNotEmpty()
  receiver_name!: string;

  @IsString()
  @IsNotEmpty()
  receiver_phone!: string;

  @IsString()
  @IsNotEmpty()
  receiver_address!: string;

  @IsString()
  @IsOptional()
  sender_province_code?: string;
  @IsString()
  @IsOptional()
  sender_ward_code?: string;
  @IsString()
  @IsOptional()
  sender_street?: string;

  @IsString()
  @IsOptional()
  receiver_province_code?: string;
  @IsString()
  @IsOptional()
  receiver_ward_code?: string;
  @IsString()
  @IsOptional()
  receiver_street?: string;

  @IsNumber()
  @IsOptional()
  @Min(0)
  @Max(5000, { message: 'Khối lượng tối đa là 5000 kg' })
  weight?: number;

  @IsNumber()
  @IsNotEmpty()
  @Min(0, { message: 'Tiền thu hộ COD không được âm' })
  @Max(500000000, { message: 'Tiền thu hộ COD tối đa là 500,000,000đ' })
  cod_amount!: number;

  @IsNumber()
  @IsOptional()
  @Min(0)
  @Max(500)
  length?: number;

  @IsNumber()
  @IsOptional()
  @Min(0)
  @Max(500)
  width?: number;

  @IsNumber()
  @IsOptional()
  @Min(0)
  @Max(500)
  height?: number;

  @IsString()
  @IsOptional()
  note?: string;

  @IsString()
  @IsNotEmpty()
  pickup_hub_id!: string;

  @IsString()
  @IsOptional()
  shipper_id?: string;
}

export class UpdateOrderDto {
  @IsString()
  @IsOptional()
  sender_name?: string;

  @IsString()
  @IsOptional()
  sender_phone?: string;

  @IsString()
  @IsOptional()
  sender_address?: string;

  @IsString()
  @IsOptional()
  receiver_name?: string;

  @IsString()
  @IsOptional()
  receiver_phone?: string;

  @IsString()
  @IsOptional()
  receiver_address?: string;

  @IsNumber()
  @IsOptional()
  @Min(0.01, { message: 'Khối lượng phải tối thiểu 0.01 kg' })
  @Max(5000, { message: 'Khối lượng tối đa là 5000 kg' })
  weight?: number;

  @IsNumber()
  @IsOptional()
  @Min(0, { message: 'Tiền thu hộ COD không được âm' })
  @Max(500000000, { message: 'Tiền thu hộ COD tối đa là 500,000,000đ' })
  cod_amount?: number;

  @IsNumber()
  @IsOptional()
  @Min(0)
  @Max(500)
  length?: number;

  @IsNumber()
  @IsOptional()
  @Min(0)
  @Max(500)
  width?: number;

  @IsNumber()
  @IsOptional()
  @Min(0)
  @Max(500)
  height?: number;

  @IsString()
  @IsOptional()
  note?: string;

  @IsString()
  @IsOptional()
  pickup_hub_id?: string;
}

export class UpdateOrderStatusDto {
  @IsString()
  @IsNotEmpty()
  status!: string;

  @IsString()
  @IsOptional()
  note?: string;

  @IsNumber()
  @IsOptional()
  lat?: number;

  @IsNumber()
  @IsOptional()
  long?: number;

  @IsString()
  @IsOptional()
  incident_image_url?: string;

  @IsString()
  @IsOptional()
  delivery_image_url?: string;
}

export class AssignShipperDto {
  @IsString()
  @IsNotEmpty()
  shipper_id!: string;
}

export class ScanInDto {
  @IsArray()
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  tracking_numbers!: string[];
}

export class ScanOutDto {
  @IsArray()
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  tracking_numbers!: string[];

  @IsString()
  @IsNotEmpty()
  shipper_id!: string;
}

export class CompleteOrderDto {
  @IsString()
  @IsNotEmpty({ message: 'Bắt buộc phải có ảnh chụp xác nhận giao hàng!' })
  delivery_image_url!: string;

  @IsOptional()
  @IsNumber()
  lat?: number;

  @IsOptional()
  @IsNumber()
  long?: number;

  @IsOptional()
  @IsString()
  note?: string;
}

export class ReturnOrderDto {
  @IsString()
  @IsNotEmpty({
    message: 'Bắt buộc phải nhập lý do hoàn hàng (VD: Khách không nghe máy)!',
  })
  reason!: string;

  @IsOptional()
  @IsNumber()
  lat?: number;

  @IsOptional()
  @IsNumber()
  long?: number;
}

export class RetryOrderDto {
  @IsString()
  @IsNotEmpty({ message: 'Bắt buộc phải ghi chú lý do hẹn lại!' })
  note!: string;

  @IsOptional()
  @IsNumber()
  lat?: number;

  @IsOptional()
  @IsNumber()
  long?: number;
}

export class UpdateDimensionsDto {
  @IsNumber()
  @Min(0.01, { message: 'Cân nặng phải lớn hơn 0' })
  weight!: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  length?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  width?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  height?: number;
}

export class RtsOrderDto {
  @IsOptional()
  @IsString()
  reason?: string;
}

export class RemitOrdersDto {
  @IsArray()
  @ArrayNotEmpty({ message: 'Danh sách đơn hàng không được để trống!' })
  order_ids!: string[]; // Truyền lên một mảng các ID đơn hàng cần chốt tiền
}

import { LocationsService } from '../locations/locations.service';
import { MaterialsService } from '../materials/materials.service';

@Injectable()
export class OrdersService {
  // KHAI BÁO CÁC SERVICE SẼ SỬ DỤNG Ở ĐÂY
  constructor(
    @InjectRepository(Order)
    private ordersRepository: Repository<Order>,
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    @InjectRepository(Wallet)
    private walletsRepository: Repository<Wallet>,
    @InjectRepository(Transaction)
    private transactionsRepository: Repository<Transaction>,
    private hubsService: HubsService,
    private trackingsService: TrackingsService,
    private financeService: FinanceService,
    private locationsService: LocationsService,
    private materialsService: MaterialsService,
    private dataSource: DataSource,
    private eventEmitter: EventEmitter2,
  ) {}

  private generateTrackingNumber(): string {
    const prefix = 'VN';
    const year = new Date().getFullYear().toString();
    const randomChars = Math.random()
      .toString(36)
      .substring(2, 7)
      .toUpperCase();
    return `${prefix}${year}${randomChars}`;
  }

  private calculateShippingFees(
    orderData: {
      weight: number;
      length?: number;
      width?: number;
      height?: number;
      cod_amount?: number;
    },
    tariff: FinanceTariff,
  ) {
    const length = orderData.length || 0;
    const width = orderData.width || 0;
    const height = orderData.height || 0;
    const divisor = Number(tariff.volumetric_divisor) || 5000;
    const bulkWeight = divisor > 0 ? (length * width * height) / divisor : 0;
    const chargeableWeight = Math.max(orderData.weight, bulkWeight);

    // Tính phí vận chuyển (Ước lượng khoảng cách 5km mặc định)
    const distance = 5;
    const extraDistance = Math.max(
      0,
      distance - Number(tariff.base_distance_limit),
    );
    const baseShippingPrice =
      Number(tariff.base_price_distance) +
      extraDistance * Number(tariff.block_price_distance);

    const surplusPrice = Number(tariff.surplus_weight_price) || 5000;
    const shippingFee =
      baseShippingPrice + Math.max(0, chargeableWeight - 2) * surplusPrice;

    const codAmount = orderData.cod_amount || 0;
    const codFee =
      codAmount > 0 ? (codAmount * Number(tariff.cod_fee_percent)) / 100 : 0;

    return { shippingFee, codFee };
  }

  async createOrder(data: CreateOrderDto, userId: string): Promise<Order> {
    const hub = await this.hubsService.findById(data.pickup_hub_id);
    if (!hub) {
      throw new NotFoundException('Bưu cục không tồn tại trong hệ thống!');
    }

    const trackingNumber = this.generateTrackingNumber();

    const tariff = await this.financeService.getTariff(data.pickup_hub_id);

    const length = Number(data.length) || 0;
    const width = Number(data.width) || 0;
    const height = Number(data.height) || 0;
    const divisor = Number(tariff.volumetric_divisor) || 5000;
    const bulkWeight = divisor > 0 ? (length * width * height) / divisor : 0;
    const rawWeight = Number(data.weight) || 0;
    const finalWeight = Math.max(rawWeight, bulkWeight);

    if (finalWeight <= 0) {
      throw new BadRequestException(
        'Vui lòng nhập cân nặng thực tế hoặc kích thước (Dài x Rộng x Cao) của bưu kiện!',
      );
    }

    const { shippingFee, codFee } = this.calculateShippingFees(
      { ...data, weight: finalWeight },
      tariff,
    );

    const newOrder = this.ordersRepository.create({
      tracking_number: trackingNumber,
      current_status: 'PENDING',
      sender_name: data.sender_name,
      sender_phone: data.sender_phone,
      sender_address: data.sender_address,
      sender_province_code: data.sender_province_code,
      sender_ward_code: data.sender_ward_code,
      sender_street: data.sender_street,

      receiver_name: data.receiver_name,
      receiver_phone: data.receiver_phone,
      receiver_address: data.receiver_address,
      receiver_province_code: data.receiver_province_code,
      receiver_ward_code: data.receiver_ward_code,
      receiver_street: data.receiver_street,
      weight: finalWeight,
      length: data.length,
      width: data.width,
      height: data.height,
      cod_amount: data.cod_amount,
      cod_fee: codFee,
      shipping_fee: shippingFee,
      note: data.note,
      pickup_hub: hub,
      customer: { id: userId },
    });

    const savedOrder = await this.ordersRepository.save(newOrder);

    // Tự động ghi lại lịch sử mốc đầu tiên
    await this.eventEmitter.emitAsync('order.status.changed', {
      order: savedOrder,
      status: 'PENDING',
      note: 'Đơn hàng được tạo mới và chờ lấy hàng',
    });

    return savedOrder;
  }

  private validateStatus(current: string, next: string) {
    const matrix: Record<string, string[]> = {
      PENDING: ['ASSIGNED', 'AT_HUB', 'CANCELLED'],
      ASSIGNED: ['PICKING', 'CANCELLED'],
      PICKING: ['PICKED', 'FAILED'],
      PICKED: ['AT_HUB'],
      AT_HUB: ['IN_TRANSIT', 'CANCELLED'],
      IN_TRANSIT: ['DELIVERING', 'AT_HUB', 'FAILED'],
      DELIVERING: ['FINISHED', 'FAILED'],
      FAILED: ['AT_HUB', 'RETURNING'],
      RETURNING: ['RETURNED'],
    };
    if (matrix[current] && !matrix[current].includes(next)) {
      throw new BadRequestException(
        `Không thể chuyển trạng thái từ ${current} sang ${next}`,
      );
    }
  }

  async updateOrderStatus(
    id: string,
    data: UpdateOrderStatusDto,
    currentUser?: { userId: string; role: string; hubId?: string },
  ): Promise<Order> {
    return await this.dataSource.transaction(async (manager) => {
      const order = await manager.findOne(Order, {
        where: { id },
        relations: { shipper: true, shipment: { shipper: true } },
      });

      if (!order) {
        throw new NotFoundException('Không tìm thấy đơn hàng!');
      }

      if (currentUser?.role === 'SHIPPER') {
        const isDirectShipper = order.shipper?.id === currentUser.userId;
        const isShipmentShipper =
          order.shipment?.shipper?.id === currentUser.userId;
        if (!isDirectShipper && !isShipmentShipper) {
          throw new ForbiddenException(
            'Shipper chỉ được cập nhật trạng thái đơn hàng của mình!',
          );
        }
      }

      if (
        order.current_status === 'FINISHED' ||
        order.current_status === 'CANCELLED'
      ) {
        throw new BadRequestException(
          'Không thể thay đổi trạng thái của đơn hàng đã HOÀN THÀNH hoặc đã bị HỦY!',
        );
      }

      if (data.status === 'FINISHED') {
        throw new BadRequestException(
          'Không thể cập nhật trực tiếp trạng thái đơn hàng sang FINISHED thông qua API này. Vui lòng sử dụng tính năng hoàn thành đơn hàng chuyên biệt để chốt tài chính!',
        );
      }

      if (data.status === 'IN_TRANSIT' || data.status === 'DELIVERING') {
        throw new BadRequestException(
          'Trạng thái IN_TRANSIT và DELIVERING không được phép cập nhật thủ công qua API lẻ. Phải được kích hoạt tự động qua Chuyến xe (Shipment).',
        );
      }

      this.validateStatus(order.current_status, data.status);

      order.current_status = data.status;

      if (data.status === 'FINISHED' && data.delivery_image_url) {
        order.delivery_image_url = data.delivery_image_url;
      }

      const updatedOrder = await manager.save(Order, order);

      const trackingNote = data.note
        ? data.note
        : `Trạng thái đơn hàng cập nhật thành ${data.status}`;

      // Tự động ghi lịch sử
      await this.eventEmitter.emitAsync('order.status.changed', {
        manager,
        order: updatedOrder,
        status: data.status,
        note: trackingNote,
        lat: data.lat,
        long: data.long,
        imageUrl: data.incident_image_url,
      });

      return updatedOrder;
    });
  }

  async findAllOrders(
    page = 1,
    limit = 10,
    user?: {
      role: string;
      hubId?: string;
    },
    status?: string,
    hubIdFilter?: string,
    search?: string,
  ): Promise<{ data: Order[]; meta: any }> {
    const where: FindOptionsWhere<Order> = {};

    // Role-based scoping
    if (user?.role !== 'ADMIN' && user?.hubId) {
      where.pickup_hub = { id: user.hubId };
    } else if (hubIdFilter && hubIdFilter !== 'ALL') {
      where.pickup_hub = { id: hubIdFilter };
    }

    if (status && status !== 'ALL') {
      if (status.includes(',')) {
        where.current_status = In(status.split(','));
      } else {
        where.current_status = status;
      }
    }

    // Apply search logic using array of where conditions for OR clauses
    let findConditions: FindOptionsWhere<Order> | FindOptionsWhere<Order>[] =
      where;
    if (search) {
      const searchPattern = `%${search}%`;
      findConditions = [
        { ...where, tracking_number: ILike(searchPattern) },
        { ...where, sender_name: ILike(searchPattern) },
        { ...where, receiver_name: ILike(searchPattern) },
        { ...where, receiver_phone: ILike(searchPattern) },
        { ...where, sender_address: ILike(searchPattern) },
        { ...where, receiver_address: ILike(searchPattern) },
      ];
    }

    const [data, totalItems] = await this.ordersRepository.findAndCount({
      where: findConditions,
      order: { created_at: 'DESC' },
      relations: {
        pickup_hub: true,
        location: true,
      },
      skip: (page - 1) * limit,
      take: limit,
    });

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

  async findByTrackingNumber(trackingNumber: string): Promise<Order> {
    const order = await this.ordersRepository.findOne({
      where: { tracking_number: trackingNumber },
      relations: { pickup_hub: true },
    });

    if (!order) {
      throw new NotFoundException('Không tìm thấy đơn hàng với mã này!');
    }
    return order;
  }

  async getStatistics(
    user?: { userId: string; role: string; hubId?: string },
    startDateStr?: string,
    endDateStr?: string,
    hubIdParam?: string,
  ) {
    const kpiGroups = [
      {
        kpi_group: 'Đang thu gom',
        statuses: ['PENDING', 'ASSIGNED', 'PICKING', 'PICKED'],
      },
      {
        kpi_group: 'Đang vận hành',
        statuses: ['AT_HUB', 'IN_TRANSIT', 'DELIVERING'],
      },
      { kpi_group: 'Sự cố & Đang hoàn', statuses: ['FAILED', 'RETURNING'] },
      { kpi_group: 'Thành công', statuses: ['FINISHED'] },
      { kpi_group: 'Đã trả hàng', statuses: ['RETURNED'] },
      { kpi_group: 'Đã hủy', statuses: ['CANCELLED'] },
    ];

    const transformStats = (
      stats: { status: string; count: string | number }[],
    ) => {
      return kpiGroups.map((group) => {
        const details = group.statuses.map((status) => {
          const found = stats.find((s) => s.status === status);
          return {
            status,
            count: found ? parseInt(found.count as string, 10) : 0,
          };
        });
        const total_count = details.reduce((acc, curr) => acc + curr.count, 0);
        return { kpi_group: group.kpi_group, total_count, details };
      });
    };

    let startDate: Date | undefined;
    let endDate: Date | undefined;

    if (startDateStr) {
      startDate = new Date(startDateStr);
      startDate.setHours(0, 0, 0, 0);
    }
    if (endDateStr) {
      endDate = new Date(endDateStr);
      endDate.setHours(23, 59, 59, 999);
    }

    if (user?.role === 'SHIPPER') {
      const query = this.ordersRepository.createQueryBuilder('order');
      // Orders are assigned to shippers via shipment, not directly
      // Join: order -> shipment -> shipper
      query
        .leftJoin('order.shipment', 'shipment')
        .leftJoin('shipment.shipper', 'shipper')
        .where('shipper.id = :userId', { userId: user.userId });

      if (startDate && endDate) {
        query.andWhere('order.updated_at BETWEEN :startDate AND :endDate', {
          startDate,
          endDate,
        });
      } else if (startDate) {
        query.andWhere('order.updated_at >= :startDate', { startDate });
      } else if (endDate) {
        query.andWhere('order.updated_at <= :endDate', { endDate });
      }

      const stats = await query
        .clone()
        .select('order.current_status', 'status')
        .addSelect('COUNT(order.id)', 'count')
        .groupBy('order.current_status')
        .getRawMany<{ status: string; count: string | number }>();

      const prodStats = await query
        .clone()
        .andWhere('order.current_status = :finishedStatus', {
          finishedStatus: 'FINISHED',
        })
        .select('DATE(order.updated_at)', 'date')
        .addSelect('COUNT(order.id)', 'count')
        .groupBy('DATE(order.updated_at)')
        .orderBy('DATE(order.updated_at)', 'ASC')
        .getRawMany<{ date: string | Date; count: string | number }>();

      const productivity = prodStats.map((p) => ({
        date: new Date(p.date).toISOString().split('T')[0],
        count: parseInt(p.count as string, 10),
      }));

      return {
        message: 'Lấy thống kê đơn hàng thành công!',
        data: transformStats(stats),
        productivity,
      };
    }

    const query = this.ordersRepository.createQueryBuilder('order');

    if (user?.role === 'HUB_COORDINATOR') {
      query.leftJoin('order.pickup_hub', 'pickup_hub');
      query.andWhere('pickup_hub.id = :hubId', { hubId: user.hubId });
    } else if (user?.role === 'ADMIN' && hubIdParam && hubIdParam !== 'ALL') {
      query.leftJoin('order.pickup_hub', 'pickup_hub');
      query.andWhere('pickup_hub.id = :hubId', { hubId: hubIdParam });
    }

    if (startDate && endDate) {
      query.andWhere('order.created_at BETWEEN :startDate AND :endDate', {
        startDate,
        endDate,
      });
    } else if (startDate) {
      query.andWhere('order.created_at >= :startDate', { startDate });
    } else if (endDate) {
      query.andWhere('order.created_at <= :endDate', { endDate });
    }

    const stats: OrderStats[] = await query
      .clone()
      .select('order.current_status', 'status')
      .addSelect('COUNT(order.id)', 'count')
      .groupBy('order.current_status')
      .getRawMany();

    const productivity: { date: string; count: number }[] = [];

    return {
      message: 'Lấy thống kê đơn hàng thành công!',
      data: transformStats(stats),
      productivity,
    };
  }

  async cancelOrder(
    id: string,
    reason: string,
    cancelledBy: 'SHIPPER' | 'ADMIN',
    operatorId?: string,
  ): Promise<Order> {
    const order = await this.ordersRepository.findOne({
      where: { id },
      relations: { shipment: true, location: true },
    });

    if (!order) throw new NotFoundException('Không tìm thấy đơn hàng!');

    // Logic nghiệp vụ chặt chẽ:
    // - Shipper chỉ được hủy khi DELIVERING
    // - Admin được hủy bất kỳ khi nào trừ FINISHED hoặc CANCELLED

    if (cancelledBy === 'SHIPPER' && order.current_status !== 'DELIVERING') {
      throw new BadRequestException(
        'Shipper chỉ được hủy đơn khi đang DELIVERING!',
      );
    }

    if (order.shipment && order.shipment.status === 'IN_TRANSIT') {
      throw new BadRequestException(
        'Không thể hủy đơn hàng đang được vận chuyển trên chuyến xe (IN_TRANSIT)!',
      );
    }

    if (
      order.current_status === 'FINISHED' ||
      order.current_status === 'CANCELLED'
    ) {
      throw new BadRequestException(
        'Không thể hủy đơn hàng đã hoàn thành hoặc đã bị hủy!',
      );
    }

    // Cập nhật trạng thái
    order.current_status = 'CANCELLED';

    // Rút hàng khỏi kệ và hoàn vật tư
    await this.locationsService.removeOrderFromLocation(
      order,
      this.dataSource.manager,
    );
    await this.materialsService.rollbackMaterials(
      order.id,
      this.dataSource.manager,
    );

    await this.ordersRepository.save(order);

    // Ghi log vào tracking với note phân loại người hủy
    let actor = 'Hệ thống';
    if (cancelledBy === 'SHIPPER') actor = 'Shipper';
    else if (cancelledBy === 'ADMIN') actor = 'Quản trị viên';

    await this.eventEmitter.emitAsync('order.status.changed', {
      order: order,
      operatorId: operatorId,
      status: 'CANCELLED',
      note: `Đơn hàng đã bị hủy bởi ${actor}. Lý do: ${reason}`,
    });

    return order;
  }

  async findMyOrders(userId: string, role: string): Promise<Order[]> {
    // 1. Nếu là Shipper: Lọc các đơn hàng được giao cho Shipper này
    if (role === 'SHIPPER') {
      return await this.ordersRepository.find({
        where: { shipper: { id: userId } },
        order: { created_at: 'DESC' }, // Sắp xếp đơn mới nhất lên đầu
        relations: { pickup_hub: true, customer: true },
      });
    }

    // 2. Nếu là Customer (hoặc mặc định): Lọc các đơn hàng do người này tạo
    return await this.ordersRepository.find({
      where: { customer: { id: userId } },
      order: { created_at: 'DESC' },
      relations: { pickup_hub: true, shipper: true },
    });
  }

  async assignShipper(
    orderId: string,
    shipperId: string,
    currentUser?: { role: string; hubId?: string },
    operatorId?: string,
  ): Promise<Order> {
    // Trạm 1: Kiểm tra đơn hàng
    const order = await this.ordersRepository.findOne({
      where: { id: orderId },
      relations: { pickup_hub: true },
    });

    if (!order) throw new NotFoundException('Không tìm thấy đơn hàng!');
    if (order.current_status !== 'PENDING') {
      throw new BadRequestException(
        'Chỉ có thể điều phối đơn hàng đang ở trạng thái PENDING!',
      );
    }

    if (currentUser?.role === 'HUB_COORDINATOR') {
      if (!order.pickup_hub || order.pickup_hub.id !== currentUser.hubId) {
        throw new BadRequestException(
          'Điều phối viên chỉ được gán Shipper cho đơn hàng thuộc bưu cục của mình!',
        );
      }
    }

    // Trạm 2: Kiểm tra Shipper
    const shipper = await this.usersRepository.findOne({
      where: { id: shipperId },
      relations: { hub: true },
    });

    if (!shipper)
      throw new NotFoundException('Không tìm thấy nhân viên Shipper!');
    if (shipper.role !== 'SHIPPER') {
      throw new BadRequestException(
        'Người dùng được gán không phải là Shipper!',
      );
    }

    // Trạm 3 (Nâng cao): Kiểm tra tuyến bưu cục (Tránh giao nhầm tuyến)
    // Nếu Shipper thuộc một bưu cục, mà đơn hàng lại ở bưu cục khác -> Chặn!
    if (
      shipper.hub &&
      order.pickup_hub &&
      shipper.hub.id !== order.pickup_hub.id
    ) {
      throw new BadRequestException(
        'Shipper không thuộc bưu cục quản lý đơn hàng này!',
      );
    }

    // Thực thi gán đơn và đổi trạng thái
    order.shipper = shipper;
    order.current_status = 'ASSIGNED'; // Trạng thái chuyển thành "Đã gán Shipper"

    const savedOrder = await this.ordersRepository.save(order);

    // Ghi log hành trình
    await this.eventEmitter.emitAsync('order.status.changed', {
      order: savedOrder,
      operatorId: operatorId,
      status: 'ASSIGNED',
      note: `Đơn hàng đã được phân công cho Shipper: ${shipper.full_name}`,
    });

    return savedOrder;
  }

  async scanInOrders(
    trackingNumbers: string[],
    actorName: string,
    actorUserId?: string,
  ) {
    if (!trackingNumbers || trackingNumbers.length === 0) {
      throw new BadRequestException('Danh sách mã vận đơn trống!');
    }

    return await this.dataSource.transaction(async (manager) => {
      // 1. Tìm tất cả đơn hàng khớp với mảng mã vận đơn (Dùng toán tử In)
      const orders = await manager.find(Order, {
        where: { tracking_number: In(trackingNumbers) },
        relations: { pickup_hub: true },
      });

      if (orders.length === 0) {
        throw new NotFoundException('Không tìm thấy đơn hàng nào hợp lệ!');
      }

      // Kiểm tra chéo bưu cục nếu là HUB_COORDINATOR
      if (actorUserId) {
        const user = await manager.findOne(User, {
          where: { id: actorUserId },
          relations: { hub: true },
        });
        if (user && user.role === 'HUB_COORDINATOR') {
          const coordinatorHubId = user.hub?.id;
          if (!coordinatorHubId) {
            throw new BadRequestException(
              'Điều phối viên chưa được gán bưu cục quản lý!',
            );
          }

          const invalidHubOrder = orders.find(
            (order) =>
              !order.pickup_hub || order.pickup_hub.id !== coordinatorHubId,
          );
          if (invalidHubOrder) {
            throw new BadRequestException(
              `Đơn hàng ${invalidHubOrder.tracking_number} không thuộc quyền quản lý của bưu cục bạn!`,
            );
          }
        }
      }

      // 2. Lọc ra những đơn hàng đủ điều kiện nhập kho
      const validStatuses = ['PENDING', 'PICKING', 'PICKED', 'RETURNING'];
      const validOrders = orders.filter((order) =>
        validStatuses.includes(order.current_status),
      );

      if (validOrders.length === 0) {
        throw new BadRequestException(
          'Các đơn hàng này đã được nhập kho hoặc không hợp lệ!',
        );
      }

      // Map to store original statuses to flag `is_return`
      const originalStatuses = new Map<string, string>();

      // 3. Cập nhật trạng thái đồng loạt sang AT_HUB & cộng thù lao lấy hàng cho Shipper nếu có
      for (const order of validOrders) {
        const prevStatus = order.current_status;
        originalStatuses.set(order.id, prevStatus);
        order.current_status = 'AT_HUB';

        if (
          order.shipper &&
          ['PENDING', 'ASSIGNED', 'PICKING', 'PICKED'].includes(prevStatus)
        ) {
          const pickupShipper = order.shipper;
          const tariff = await this.financeService.getTariff(
            order.pickup_hub?.id,
          );
          const pickupPayout = Number(tariff.shipper_pickup_payout) || 2500;

          let shipperWallet = await manager.findOne(Wallet, {
            where: { user: { id: pickupShipper.id } },
          });
          if (!shipperWallet) {
            shipperWallet = manager.create(Wallet, {
              user: pickupShipper,
              income_balance: 0,
              cod_debt: 0,
            });
          }
          shipperWallet.income_balance =
            Number(shipperWallet.income_balance) + pickupPayout;
          await manager.save(Wallet, shipperWallet);

          const pickupTx = manager.create(Transaction, {
            wallet: shipperWallet,
            order: order,
            amount: pickupPayout,
            type: 'COMMISSION_EARNED',
            description: `Thù lao lấy hàng thành công đơn ${order.tracking_number}`,
          });
          await manager.save(Transaction, pickupTx);
        }
      }

      // Lưu một mảng dữ liệu cùng lúc để tối ưu hiệu năng (Bulk Update)
      await manager.save(Order, validOrders);

      // 4. Ghi log tracking đồng loạt bằng Promise.all
      await Promise.all(
        validOrders.map((order) =>
          this.eventEmitter.emitAsync('order.status.changed', {
            manager,
            order: order,
            operatorId: actorUserId,
            status: 'AT_HUB',
            note: `Đơn hàng đã được nhập bưu cục ${order.pickup_hub?.name || 'Vô danh'} bởi ${actorName}`,
          }),
        ),
      );

      // 5. Trả về thống kê cho Frontend báo cáo
      return {
        total_scanned: trackingNumbers.length,
        success_count: validOrders.length,
        failed_count: trackingNumbers.length - validOrders.length,
        success_trackings: validOrders.map((o) => ({
          tracking_number: o.tracking_number,
          order_id: o.id,
          suggested_zone:
            Number(o.weight) < 5
              ? 'Khu vực A (Dưới 5kg)'
              : 'Khu vực B (Từ 5kg)',
          hub_name: o.pickup_hub?.name || 'Vô danh',
          is_return: originalStatuses.get(o.id) === 'RETURNING',
        })),
      };
    });
  }

  async scanOutOrders(
    trackingNumbers: string[],
    shipperId: string,
    actorName: string,
    actorUserId?: string,
  ) {
    if (!trackingNumbers || trackingNumbers.length === 0) {
      throw new BadRequestException('Danh sách mã vận đơn trống!');
    }

    return await this.dataSource.transaction(async (manager) => {
      // 1. Kiểm tra tính hợp lệ của Shipper nhận bàn giao
      const shipper = await manager.findOne(User, {
        where: { id: shipperId },
      });
      if (!shipper || shipper.role !== 'SHIPPER') {
        throw new BadRequestException(
          'ID Người giao hàng không hợp lệ hoặc không tồn tại!',
        );
      }

      // 2. Lấy danh sách đơn hàng từ CSDL
      const orders = await manager.find(Order, {
        where: { tracking_number: In(trackingNumbers) },
        relations: { pickup_hub: true, location: true },
      });

      if (orders.length === 0) {
        throw new NotFoundException('Không tìm thấy mã vận đơn nào hợp lệ!');
      }

      // Kiểm tra chéo bưu cục nếu là HUB_COORDINATOR
      if (actorUserId) {
        const user = await manager.findOne(User, {
          where: { id: actorUserId },
          relations: { hub: true },
        });
        if (user && user.role === 'HUB_COORDINATOR') {
          const coordinatorHubId = user.hub?.id;
          if (!coordinatorHubId) {
            throw new BadRequestException(
              'Điều phối viên chưa được gán bưu cục quản lý!',
            );
          }

          const invalidHubOrder = orders.find(
            (order) =>
              !order.pickup_hub || order.pickup_hub.id !== coordinatorHubId,
          );
          if (invalidHubOrder) {
            throw new BadRequestException(
              `Đơn hàng ${invalidHubOrder.tracking_number} không thuộc quyền quản lý của bưu cục bạn!`,
            );
          }
        }
      }

      // 3. Lọc các đơn hàng đủ điều kiện xuất kho (Phải đang nằm ở Hub)
      const validOrders = orders.filter(
        (order) => order.current_status === 'AT_HUB',
      );

      if (validOrders.length === 0) {
        throw new BadRequestException(
          'Các đơn hàng này chưa nhập kho hoặc không đủ điều kiện xuất kho!',
        );
      }

      // 4. Cập nhật trạng thái và "sang tên" Shipper giao hàng
      for (const order of validOrders) {
        order.current_status = 'DELIVERING';
        order.dispatched_at = new Date();
        order.shipper = shipper; // Ghi đè Shipper đi lấy hàng bằng Shipper đi giao hàng
        await this.locationsService.removeOrderFromLocation(order, manager);
      }

      // Cập nhật hàng loạt (Bulk Update)
      await manager.save(Order, validOrders);

      // 5. Ghi log hành trình đồng loạt
      await Promise.all(
        validOrders.map((order) =>
          this.eventEmitter.emitAsync('order.status.changed', {
            manager,
            order: order,
            operatorId: actorUserId,
            status: 'DELIVERING',
            note: `Đơn hàng đã xuất kho. Bàn giao cho Shipper: ${shipper.full_name} (${shipper.phone_number}). Thao tác bởi: ${actorName}`,
          }),
        ),
      );

      return {
        total_scanned: trackingNumbers.length,
        success_count: validOrders.length,
        failed_count: trackingNumbers.length - validOrders.length,
        success_trackings: validOrders.map((o) => o.tracking_number),
        assigned_to: shipper.full_name,
      };
    });
  }

  async completeOrder(
    orderId: string,
    shipperId: string,
    role: string,
    data: CompleteOrderDto,
  ): Promise<Order> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 1. Khóa dòng Order này lại để tránh các request status khác can thiệp
      const order = await queryRunner.manager.findOne(Order, {
        where: { id: orderId },
        relations: {
          shipper: true,
          pickup_hub: true,
          shipment: { shipper: true },
        },
      });

      if (!order) throw new NotFoundException('Không tìm thấy đơn hàng!');

      // Chốt chặn 1: Trạng thái
      if (
        order.current_status !== 'DELIVERING' &&
        order.current_status !== 'RETURNING'
      ) {
        throw new BadRequestException(
          'Chỉ có thể hoàn tất đơn hàng đang ở trạng thái DELIVERING hoặc RETURNING!',
        );
      }

      const isDirectShipper = order.shipper?.id === shipperId;
      const isShipmentShipper = order.shipment?.shipper?.id === shipperId;

      // Chốt chặn 2: Bảo mật phân quyền Shipper
      if (role !== 'ADMIN') {
        if (!isDirectShipper && !isShipmentShipper) {
          throw new BadRequestException(
            'Bạn không có quyền thao tác trên đơn hàng của người khác!',
          );
        }
      }

      const actualShipperId =
        order.shipper?.id || order.shipment?.shipper?.id || shipperId;

      // Cập nhật dữ liệu
      if (order.current_status === 'RETURNING') {
        order.current_status = 'RETURNED';
      } else {
        order.current_status = 'FINISHED';
      }
      order.delivery_image_url = data.delivery_image_url;

      // Xử lý logic tiền thu hộ (COD)
      // Chỉ thu COD khi giao hàng thành công cho khách (FINISHED), không thu khi trả hàng (RETURNED)
      if (order.current_status === 'FINISHED' && order.cod_amount > 0) {
        order.cod_status = 'COLLECTED';
      }

      const savedOrder = await queryRunner.manager.save(Order, order);

      // Cập nhật DeliveryAttempt để khóa lịch sử của tài xế này
      if (savedOrder.shipment) {
        const attempt = await queryRunner.manager.findOne(DeliveryAttempt, {
          where: {
            order: { id: savedOrder.id },
            shipment: { id: savedOrder.shipment.id },
          },
        });
        if (attempt) {
          attempt.status =
            savedOrder.current_status === 'RETURNED' ? 'FAILED' : 'FINISHED';
          attempt.proof_image_url = data.delivery_image_url;
          await queryRunner.manager.save(DeliveryAttempt, attempt);
        }
      }

      // Cập nhật ví và giao dịch cho tài xế & bưu cục
      const tariff = await this.financeService.getTariff(
        savedOrder.pickup_hub?.id,
      );

      // 1. Cộng chiết khấu cho Tài xế (Shipper Payout)
      let shipperWallet = await queryRunner.manager.findOne(Wallet, {
        where: { user: { id: actualShipperId } },
      });
      if (!shipperWallet) {
        const user = await queryRunner.manager.findOne(User, {
          where: { id: actualShipperId },
        });
        if (!user)
          throw new NotFoundException('Không tìm thấy tài xế để tạo ví!');
        shipperWallet = queryRunner.manager.create(Wallet, {
          user,
          income_balance: 0,
          cod_debt: 0,
        });
        await queryRunner.manager.save(Wallet, shipperWallet);
      }

      let shipperPayout = 0;
      let payoutDescription = '';

      if (savedOrder.current_status === 'RETURNED') {
        shipperPayout = Number(tariff.shipper_return_payout) || 2500;
        payoutDescription = `Thù lao trả hàng thành công đơn ${savedOrder.tracking_number}`;
      } else {
        const shipperPayoutPercent = Number(tariff.shipper_payout_percent);
        shipperPayout =
          shipperPayoutPercent > 0
            ? (Number(savedOrder.shipping_fee) * shipperPayoutPercent) / 100
            : Number(tariff.shipper_payout_flat);
        payoutDescription = `Chiết khấu giao hàng thành công đơn ${savedOrder.tracking_number}`;
      }

      shipperWallet.income_balance =
        Number(shipperWallet.income_balance) + shipperPayout;

      if (
        savedOrder.current_status === 'FINISHED' &&
        savedOrder.cod_amount > 0
      ) {
        shipperWallet.cod_debt =
          Number(shipperWallet.cod_debt) + Number(savedOrder.cod_amount);
      }
      await queryRunner.manager.save(Wallet, shipperWallet);

      // Lưu nhật ký giao dịch tài xế
      const payoutTx = queryRunner.manager.create(Transaction, {
        wallet: shipperWallet,
        order: savedOrder,
        amount: shipperPayout,
        type: 'COMMISSION_EARNED',
        description: payoutDescription,
      });
      await queryRunner.manager.save(Transaction, payoutTx);

      if (
        savedOrder.current_status === 'FINISHED' &&
        savedOrder.cod_amount > 0
      ) {
        const codLiabilityTx = queryRunner.manager.create(Transaction, {
          wallet: shipperWallet,
          order: savedOrder,
          amount: Number(savedOrder.cod_amount),
          type: 'COD_COLLECTED',
          description: `Công nợ thu hộ COD đơn ${savedOrder.tracking_number} (Tạm giữ)`,
        });
        await queryRunner.manager.save(Transaction, codLiabilityTx);
      }

      // 2. Cộng hoa hồng nhượng quyền cho Bưu cục Đối tác
      if (savedOrder.pickup_hub) {
        const hubCoordinator = await queryRunner.manager.findOne(User, {
          where: {
            hub: { id: savedOrder.pickup_hub.id },
            role: 'HUB_COORDINATOR',
          },
        });
        if (hubCoordinator) {
          let hubWallet = await queryRunner.manager.findOne(Wallet, {
            where: { user: { id: hubCoordinator.id } },
          });
          if (!hubWallet) {
            hubWallet = queryRunner.manager.create(Wallet, {
              user: hubCoordinator,
              income_balance: 0,
              cod_debt: 0,
            });
            await queryRunner.manager.save(Wallet, hubWallet);
          }

          const hubCommission =
            (Number(savedOrder.shipping_fee) *
              Number(tariff.hub_commission_percent)) /
              100 +
            Number(savedOrder.material_fee || 0);
          hubWallet.income_balance =
            Number(hubWallet.income_balance) + hubCommission;
          await queryRunner.manager.save(Wallet, hubWallet);

          const hubTx = queryRunner.manager.create(Transaction, {
            wallet: hubWallet,
            order: savedOrder,
            amount: hubCommission,
            type: 'COMMISSION_EARNED',
            description: `Hoa hồng chia sẻ nhượng quyền bưu cục đơn ${savedOrder.tracking_number}`,
          });
          await queryRunner.manager.save(Transaction, hubTx);
        }
      }

      // Ghi log hành trình chốt hạ (kèm tọa độ GPS cuối cùng)
      await this.trackingsService.addTrackingRecordWithManager(
        queryRunner.manager,
        {
          order: savedOrder,
          status: savedOrder.current_status,
          note: data.note || 'Giao hàng thành công. Khách đã nhận hàng.',
          lat: data.lat,
          long: data.long,
          imageUrl: data.delivery_image_url,
        },
      );

      if (savedOrder.shipment) {
        const shipmentOrders = await queryRunner.manager.find(Order, {
          where: { shipment: { id: savedOrder.shipment.id } },
        });
        const allCompleted = shipmentOrders.every(
          (o) =>
            o.current_status === 'FINISHED' ||
            o.current_status === 'RETURNING' ||
            o.current_status === 'RETURNED_TO_SENDER' ||
            o.current_status === 'CANCELLED',
        );
        if (allCompleted) {
          await queryRunner.manager.update(
            Shipment,
            { id: savedOrder.shipment.id },
            { status: 'COMPLETED' },
          );
        }
      }

      await queryRunner.commitTransaction();
      return savedOrder;
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  async returnOrder(
    orderId: string,
    userId: string,
    role: string,
    data: ReturnOrderDto,
  ): Promise<Order> {
    const order = await this.ordersRepository.findOne({
      where: { id: orderId },
      relations: { shipper: true, shipment: { shipper: true } },
    });

    if (!order) throw new NotFoundException('Không tìm thấy đơn hàng!');

    // 1. Kiểm tra trạng thái hợp lệ
    if (order.current_status !== 'DELIVERING') {
      throw new BadRequestException(
        'Chỉ có thể báo hoàn hàng khi đơn đang ở trạng thái DELIVERING!',
      );
    }

    const isDirectShipper = order.shipper?.id === userId;
    const isShipmentShipper = order.shipment?.shipper?.id === userId;

    // 2. Chốt chặn phân quyền: Nếu là Shipper thì phải là chủ đơn hàng
    if (role === 'SHIPPER' && !isDirectShipper && !isShipmentShipper) {
      throw new BadRequestException(
        'Bạn không có quyền báo hoàn cho đơn hàng của người khác!',
      );
    }

    // 3. Cập nhật trạng thái
    order.current_status = 'RETURNING';

    // (Tùy chọn) Có thể reset cod_status nếu trước đó đang có logic khác,
    // nhưng thường đơn hoàn thì không thu tiền COD.

    const savedOrder = await this.ordersRepository.save(order);

    // Cập nhật DeliveryAttempt thành FAILED (giao thất bại)
    if (savedOrder.shipment) {
      const attempt = await this.dataSource.manager.findOne(DeliveryAttempt, {
        where: {
          order: { id: savedOrder.id },
          shipment: { id: savedOrder.shipment.id },
        },
      });
      if (attempt) {
        attempt.status = 'FAILED';
        attempt.failure_reason = data.reason;
        await this.dataSource.manager.save(DeliveryAttempt, attempt);
      }
    }

    // 4. Ghi log hành trình
    await this.eventEmitter.emitAsync('order.status.changed', {
      order: savedOrder,
      status: 'RETURNING',
      note: `Giao hàng thất bại. Đang chuyển hoàn về bưu cục. Lý do: ${data.reason}`,
      lat: data.lat,
      long: data.long,
    });

    if (savedOrder.shipment) {
      const shipmentOrders = await this.ordersRepository.find({
        where: { shipment: { id: savedOrder.shipment.id } },
      });
      const allCompleted = shipmentOrders.every(
        (o) =>
          o.current_status === 'FINISHED' ||
          o.current_status === 'RETURNING' ||
          o.current_status === 'RETURNED_TO_SENDER' ||
          o.current_status === 'CANCELLED',
      );
      if (allCompleted) {
        await this.dataSource.manager.update(
          Shipment,
          { id: savedOrder.shipment.id },
          { status: 'COMPLETED' },
        );
      }
    }

    return savedOrder;
  }

  // Hàm Xử lý Giao lại (Retry Delivery)
  async retryDelivery(
    orderId: string,
    data: RetryOrderDto,
    actorName: string,
    operatorId?: string,
  ): Promise<Order> {
    const order = await this.ordersRepository.findOne({
      where: { id: orderId },
      relations: { location: true },
    });
    if (!order) throw new NotFoundException('Không tìm thấy đơn hàng!');

    if (order.current_status !== 'FAILED') {
      throw new BadRequestException(
        'Chỉ có thể giao lại đơn hàng đang ở trạng thái sự cố (FAILED)!',
      );
    }

    // Cập nhật trạng thái về AT_HUB để chờ gom nhóm lại
    order.current_status = 'AT_HUB';
    order.shipper = null as any; // Xóa thông tin shipper cũ

    const savedOrder = await this.ordersRepository.save(order);

    await this.eventEmitter.emitAsync('order.status.changed', {
      order: savedOrder,
      operatorId: operatorId,
      status: 'AT_HUB',
      note: `Đơn hàng được yêu cầu giao lại. Thao tác bởi: ${actorName}`,
    });

    return savedOrder;
  }

  // Hàm Xử lý Chuyển hoàn (Return To Sender)
  async returnToSender(
    orderId: string,
    data: RtsOrderDto,
    actorName: string,
    operatorId?: string,
  ): Promise<Order> {
    const order = await this.ordersRepository.findOne({
      where: { id: orderId },
      relations: { location: true },
    });
    if (!order) throw new NotFoundException('Không tìm thấy đơn hàng!');

    if (order.current_status !== 'FAILED') {
      throw new BadRequestException(
        'Chỉ có thể chuyển hoàn đơn hàng đang ở trạng thái sự cố (FAILED)!',
      );
    }

    // Chuyển sang trạng thái chờ chuyển hoàn
    order.current_status = 'RETURN_TO_SENDER';

    const savedOrder = await this.ordersRepository.save(order);

    // Ghi log
    const noteReason = data.reason ? ` Lý do: ${data.reason}` : '';
    await this.eventEmitter.emitAsync('order.status.changed', {
      order: savedOrder,
      operatorId: operatorId,
      status: 'RETURN_TO_SENDER',
      note: `Đơn hàng được yêu cầu chuyển hoàn về cho người gửi.${noteReason} Thao tác bởi: ${actorName}`,
    });

    return savedOrder;
  }

  async remitCOD(orderIds: string[], adminName: string, operatorId?: string) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 1. Tìm các đơn hàng và khóa bi quan
      const orders = await queryRunner.manager.find(Order, {
        where: { id: In(orderIds) },
        relations: { shipper: true },
      });

      if (orders.length === 0) {
        throw new NotFoundException('Không tìm thấy đơn hàng!');
      }

      // 2. Lọc ra các đơn hàng ĐỦ ĐIỀU KIỆN nộp tiền:
      const validOrders = orders.filter(
        (order) =>
          order.current_status === 'FINISHED' &&
          order.cod_amount > 0 &&
          order.cod_status === 'COLLECTED',
      );

      if (validOrders.length === 0) {
        throw new BadRequestException(
          'Các đơn hàng này không có COD hoặc đã được nộp tiền trước đó!',
        );
      }

      let totalAmount = 0;

      // 3. Chuyển trạng thái sang Đã nộp quỹ
      for (const order of validOrders) {
        order.cod_status = 'REMITTED';
        totalAmount += Number(order.cod_amount);

        // Khấu trừ công nợ COD của shipper
        if (order.shipper) {
          const shipperWallet = await queryRunner.manager.findOne(Wallet, {
            where: { user: { id: order.shipper.id } },
          });
          if (shipperWallet) {
            shipperWallet.cod_debt = Math.max(
              0,
              Number(shipperWallet.cod_debt) - Number(order.cod_amount),
            );
            await queryRunner.manager.save(Wallet, shipperWallet);

            // Tạo bản ghi giao dịch đối soát giảm nợ
            const clearLiabilityTx = queryRunner.manager.create(Transaction, {
              wallet: shipperWallet,
              order: order,
              amount: -Number(order.cod_amount),
              type: 'COD_REMITTED',
              description: `Đối soát nộp quỹ COD thành công đơn ${order.tracking_number} cho bưu cục`,
            });
            await queryRunner.manager.save(Transaction, clearLiabilityTx);
          }
        }
        await queryRunner.manager.save(Order, order);
      }

      // 4. Ghi log tracking đồng loạt sử dụng queryRunner.manager
      await Promise.all(
        validOrders.map((order) =>
          this.trackingsService.addTrackingRecordWithManager(
            queryRunner.manager,
            {
              order: order,
              status: 'FINISHED',
              operatorId: operatorId,
              note: `Đã đối soát tiền thu hộ (COD) thành công. Người thu: ${adminName}`,
            },
          ),
        ),
      );

      await queryRunner.commitTransaction();

      return {
        total_orders_remitted: validOrders.length,
        total_money_collected: totalAmount, // Tổng số tiền Admin đã thu vào két
        failed_orders: orderIds.length - validOrders.length,
      };
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  async updateOrder(id: string, data: UpdateOrderDto): Promise<Order> {
    return await this.ordersRepository.manager.transaction(async (manager) => {
      const order = await manager.findOne(Order, {
        where: { id },
        relations: { pickup_hub: true },
      });
      if (!order) throw new NotFoundException('Không tìm thấy đơn hàng!');

      // Chỉ có thể sửa đơn hàng ở trạng thái PENDING hoặc AT_HUB
      if (
        order.current_status !== 'PENDING' &&
        order.current_status !== 'AT_HUB'
      ) {
        throw new BadRequestException(
          'Chỉ có thể chỉnh sửa đơn hàng đang chờ hoặc đang lưu kho!',
        );
      }

      if (data.pickup_hub_id) {
        const hub = await manager.findOne(Hub, {
          where: { id: data.pickup_hub_id },
        });
        if (!hub) throw new NotFoundException('Không tìm thấy bưu cục!');
        order.pickup_hub = hub;
      }

      if (data.sender_name !== undefined) order.sender_name = data.sender_name;
      if (data.sender_phone !== undefined)
        order.sender_phone = data.sender_phone;
      if (data.sender_address !== undefined)
        order.sender_address = data.sender_address;
      if (data.receiver_name !== undefined)
        order.receiver_name = data.receiver_name;
      if (data.receiver_phone !== undefined)
        order.receiver_phone = data.receiver_phone;
      if (data.receiver_address !== undefined)
        order.receiver_address = data.receiver_address;
      if (data.weight !== undefined) order.weight = data.weight;
      if (data.cod_amount !== undefined) order.cod_amount = data.cod_amount;
      if (data.length !== undefined) order.length = data.length;
      if (data.width !== undefined) order.width = data.width;
      if (data.height !== undefined) order.height = data.height;
      if (data.note !== undefined) order.note = data.note!;

      // Recalculate fees
      const tariff = await this.financeService.getTariff(order.pickup_hub?.id);
      const { shippingFee, codFee } = this.calculateShippingFees(order, tariff);
      order.shipping_fee = shippingFee;
      order.cod_fee = codFee;

      return await manager.save(order);
    });
  }

  async deleteOrder(id: string) {
    return await this.ordersRepository.manager.transaction(async (manager) => {
      const order = await manager.findOne(Order, {
        where: { id },
      });
      if (!order) throw new NotFoundException('Không tìm thấy đơn hàng!');

      // Chỉ cho phép xóa đơn hàng chưa bàn giao cho shipper / chưa đi xe
      if (
        order.current_status !== 'PENDING' &&
        order.current_status !== 'AT_HUB'
      ) {
        throw new BadRequestException(
          'Chỉ có thể xóa đơn hàng ở trạng thái đang chờ hoặc đang lưu kho!',
        );
      }

      await manager.softRemove(order);
      return { message: 'Xóa đơn hàng thành công!' };
    });
  }

  async updateDimensions(
    orderId: string,
    data: UpdateDimensionsDto,
    actorName: string,
    operatorId?: string,
  ) {
    return await this.dataSource.transaction(async (manager) => {
      const order = await manager.findOne(Order, { where: { id: orderId } });
      if (!order) {
        throw new NotFoundException('Không tìm thấy đơn hàng!');
      }

      const oldFee = Number(order.shipping_fee) || 0;
      const oldWeight = Number(order.weight) || 0;

      // Tính lại cước
      const tariff = await this.financeService.getTariff(order.pickup_hub?.id);
      const orderDataForFee = {
        weight: data.weight,
        length: data.length !== undefined ? data.length : order.length,
        width: data.width !== undefined ? data.width : order.width,
        height: data.height !== undefined ? data.height : order.height,
        cod_amount: order.cod_amount,
      };

      const { shippingFee: newFee } = this.calculateShippingFees(
        orderDataForFee,
        tariff,
      );

      order.weight = data.weight;
      order.length = orderDataForFee.length;
      order.width = orderDataForFee.width;
      order.height = orderDataForFee.height;
      order.shipping_fee = newFee;

      const savedOrder = await manager.save(Order, order);

      // Nếu cước phí thay đổi, ghi chú vào log (có thể dùng chung order.status.changed hoặc lưu audit)
      if (newFee !== oldFee) {
        const diff = newFee - oldFee;
        await this.eventEmitter.emitAsync('order.status.changed', {
          manager,
          order: savedOrder,
          operatorId: operatorId,
          status: savedOrder.current_status,
          note: `Thay đổi thông số đơn hàng bởi ${actorName}. Cân nặng: ${oldWeight}kg -> ${data.weight}kg. Cước phí thay đổi: ${diff > 0 ? '+' : ''}${diff.toLocaleString('vi-VN')}đ.`,
        });
      }

      return savedOrder;
    });
  }

  async getDeliveryAttempts(orderId: string): Promise<DeliveryAttempt[]> {
    const attempts = await this.dataSource.manager.find(DeliveryAttempt, {
      where: { order: { id: orderId } },
      relations: { shipper: true, shipment: true },
      order: { created_at: 'DESC' },
    });
    return attempts;
  }
}
