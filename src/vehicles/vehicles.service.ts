import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, ILike, FindOptionsWhere } from 'typeorm';
import { Vehicle } from './vehicle.entity';
import { User } from '../users/user.entity';
import { Hub } from '../hubs/hub.entity';
import { CreateVehicleDto, UpdateVehicleDto } from './dto/vehicle.dto';

@Injectable()
export class VehiclesService {
  constructor(
    @InjectRepository(Vehicle)
    private vehiclesRepository: Repository<Vehicle>,
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    @InjectRepository(Hub)
    private hubsRepository: Repository<Hub>,
  ) {}

  async findAll(
    hub_id?: string,
    status?: string,
    vehicle_type?: string,
    search?: string,
    page: number = 1,
    limit: number = 10,
  ): Promise<{ data: Vehicle[]; meta: any }> {
    const where: FindOptionsWhere<Vehicle> = {};
    if (hub_id) where.hub = { id: hub_id };
    if (status) where.status = status;
    if (vehicle_type) where.vehicle_type = vehicle_type;
    if (search) {
      where.license_plate = ILike(`%${search}%`);
    }

    const [data, totalItems] = await this.vehiclesRepository.findAndCount({
      where: Object.keys(where).length ? where : undefined,
      relations: { hub: true, assigned_shipper: true },
      order: { created_at: 'DESC' },
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

  async findOne(id: string): Promise<Vehicle> {
    const vehicle = await this.vehiclesRepository.findOne({
      where: { id },
      relations: { hub: true, assigned_shipper: true },
    });
    if (!vehicle) throw new NotFoundException('Không tìm thấy phương tiện!');
    return vehicle;
  }

  async create(dto: CreateVehicleDto): Promise<Vehicle> {
    const existing = await this.vehiclesRepository.findOne({
      where: { license_plate: dto.license_plate.toUpperCase() },
    });
    if (existing) {
      throw new BadRequestException(
        `Biển số xe ${dto.license_plate} đã tồn tại trong hệ thống!`,
      );
    }

    let hub: Hub | null = null;
    if (dto.hub_id) {
      hub = await this.hubsRepository.findOne({ where: { id: dto.hub_id } });
      if (!hub) throw new NotFoundException('Không tìm thấy kho!');
    }

    let assignedShipper: User | null = null;
    if (dto.assigned_shipper_id) {
      assignedShipper = await this.usersRepository.findOne({
        where: { id: dto.assigned_shipper_id },
        relations: { hub: true },
      });
      if (!assignedShipper || assignedShipper.role !== 'SHIPPER') {
        throw new NotFoundException('Không tìm thấy tài xế hợp lệ!');
      }
      if (hub && assignedShipper.hub && assignedShipper.hub.id !== hub.id) {
        throw new BadRequestException(
          'Tài xế được chọn không thuộc bưu cục của phương tiện!',
        );
      }
      // Đồng bộ thông tin xe vào bảng User
      await this.syncShipperVehicle(
        assignedShipper,
        dto.license_plate.toUpperCase(),
        dto.vehicle_type,
      );
    }

    const vehicle = this.vehiclesRepository.create({
      license_plate: dto.license_plate.toUpperCase(),
      vehicle_type: dto.vehicle_type,
      capacity_weight: dto.capacity_weight,
      status: dto.status || 'ACTIVE',
      hub,
      assigned_shipper: assignedShipper,
      notes: dto.notes ?? null,
    });

    return this.vehiclesRepository.save(vehicle);
  }

  async update(id: string, dto: UpdateVehicleDto): Promise<Vehicle> {
    const vehicle = await this.findOne(id);

    if (dto.license_plate) {
      vehicle.license_plate = dto.license_plate.toUpperCase();
    }
    if (dto.vehicle_type) vehicle.vehicle_type = dto.vehicle_type;
    if (dto.capacity_weight !== undefined)
      vehicle.capacity_weight = dto.capacity_weight;
    if (dto.status) vehicle.status = dto.status;
    if (dto.notes !== undefined) vehicle.notes = dto.notes ?? null;

    // Cập nhật kho
    if (dto.hub_id !== undefined) {
      if (!dto.hub_id) {
        vehicle.hub = null;
      } else {
        const hub = await this.hubsRepository.findOne({
          where: { id: dto.hub_id },
        });
        if (!hub) throw new NotFoundException('Không tìm thấy kho!');
        vehicle.hub = hub;
      }
    }

    // Cập nhật tài xế mặc định và đồng bộ sang bảng User
    if ('assigned_shipper_id' in dto) {
      if (!dto.assigned_shipper_id) {
        vehicle.assigned_shipper = null;
      } else {
        const shipper = await this.usersRepository.findOne({
          where: { id: dto.assigned_shipper_id },
          relations: { hub: true },
        });
        if (!shipper || shipper.role !== 'SHIPPER') {
          throw new NotFoundException('Không tìm thấy tài xế hợp lệ!');
        }
        if (vehicle.hub && shipper.hub && shipper.hub.id !== vehicle.hub.id) {
          throw new BadRequestException(
            'Tài xế được chọn không thuộc bưu cục của phương tiện!',
          );
        }
        vehicle.assigned_shipper = shipper;
        // Đồng bộ sang bảng User
        await this.syncShipperVehicle(
          shipper,
          vehicle.license_plate,
          vehicle.vehicle_type,
        );
      }
    }

    return this.vehiclesRepository.save(vehicle);
  }

  async remove(id: string): Promise<void> {
    const vehicle = await this.findOne(id);
    if (vehicle.status === 'ON_TRIP') {
      throw new BadRequestException(
        'Không thể xóa xe đang trong chuyến vận hành!',
      );
    }
    await this.vehiclesRepository.remove(vehicle);
  }

  /** Đồng bộ biển số và loại xe vào User (shipper) */
  private async syncShipperVehicle(
    shipper: User,
    licensePlate: string,
    vehicleType: string,
  ): Promise<void> {
    await this.usersRepository.update(shipper.id, {
      vehicle_number: licensePlate,
      vehicle_type: vehicleType,
    });
  }

  /** Được gọi từ ShipmentsService khi xe xuất bến */
  async setOnTrip(licensePlate: string): Promise<void> {
    await this.vehiclesRepository.update(
      { license_plate: licensePlate },
      { status: 'ON_TRIP' },
    );
  }

  /** Được gọi từ ShipmentsService khi chuyến hoàn thành */
  async setActive(licensePlate: string, newHubId?: string): Promise<void> {
    const update: Partial<Vehicle> = { status: 'ACTIVE' };
    if (newHubId) {
      const hub = await this.hubsRepository.findOne({
        where: { id: newHubId },
      });
      if (hub) update.hub = hub;
    }
    await this.vehiclesRepository.update(
      { license_plate: licensePlate },
      update,
    );
  }
}
