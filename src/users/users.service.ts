import {
  Injectable,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './user.entity';
import * as bcrypt from 'bcrypt';
import { CreateInternalUserDto } from './dto/create-internal-user.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
  ) {}

  private async generateEmployeeCode(role: string): Promise<string> {
    let prefix = 'NV';
    if (role === 'SHIPPER') prefix = 'TX';

    const count = await this.usersRepository.count({
      where: { role: role as any },
    });

    const year = new Date().getFullYear().toString().substring(2);
    const sequence = (count + 1).toString().padStart(4, '0');
    return `${prefix}${year}${sequence}`;
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.usersRepository.findOne({
      where: { email },
    });
  }

  async createInternal(dto: CreateInternalUserDto): Promise<User> {
    // Kiểm tra trùng lặp email/sđt trước khi tạo user nội bộ
    const existingUser = await this.usersRepository.findOne({
      where: [{ email: dto.email }, { phone_number: dto.phone_number }],
    });

    if (existingUser) {
      if (existingUser.email === dto.email) {
        throw new ConflictException('Email này đã được đăng ký!');
      }
      if (existingUser.phone_number === dto.phone_number) {
        throw new ConflictException('Số điện thoại này đã được đăng ký!');
      }
    }

    const hashedPassword = await bcrypt.hash(dto.password, 10);

    const employeeCode = await this.generateEmployeeCode(dto.role);

    const newUser = this.usersRepository.create({
      email: dto.email,
      phone_number: dto.phone_number,
      employee_code: employeeCode,
      password_hash: hashedPassword,
      full_name: dto.fullName,
      role: dto.role,
      vehicle_number: dto.vehicle_number,
      vehicle_type: dto.vehicle_type,
      ...(dto.hubId ? { hub: { id: dto.hubId } } : {}),
    });

    const savedUser = await this.usersRepository.save(newUser);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password_hash, ...result } = savedUser;
    return result as User;
  }

  async findOneById(userId: string): Promise<User> {
    const user = await this.usersRepository.findOne({
      where: { id: userId },
      relations: { hub: true },
      select: {
        id: true,
        email: true,
        full_name: true,
        role: true,
        phone_number: true,
        address: true,
        hub: {
          id: true,
          name: true,
          address: true,
        },
      },
    });

    if (!user) {
      throw new NotFoundException('Không tìm thấy người dùng!');
    }

    return user;
  }

  async updateProfile(
    userId: string,
    dto: UpdateProfileDto,
  ): Promise<Partial<User>> {
    // 1. Tìm user hiện tại
    const user = await this.usersRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('Người dùng không tồn tại!');
    }

    // 2. Cập nhật các trường được phép
    if (dto.fullName) {
      user.full_name = dto.fullName; // Map đúng tên cột trong DB
    }

    if (dto.phone_number) {
      // Kiểm tra xem số điện thoại mới có bị trùng với ai khác không
      const existPhone = await this.usersRepository.findOne({
        where: { phone_number: dto.phone_number },
      });

      if (existPhone && existPhone.id !== userId) {
        throw new ConflictException(
          'Số điện thoại này đã được sử dụng bởi tài khoản khác!',
        );
      }
      user.phone_number = dto.phone_number;
    }

    if (dto.address !== undefined) {
      user.address = dto.address;
    }

    // 3. Lưu vào Database
    await this.usersRepository.save(user);

    // 4. Bóc tách loại bỏ dữ liệu nhạy cảm trước khi trả về
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password_hash, refresh_token, ...safeUser } = user;
    return safeUser;
  }

  async changePassword(
    userId: string,
    oldPassword: string,
    newPassword: string,
  ): Promise<void> {
    const user = await this.usersRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('Người dùng không tồn tại!');
    }

    const isPasswordValid = await bcrypt.compare(
      oldPassword,
      user.password_hash,
    );
    if (!isPasswordValid) {
      throw new ConflictException('Mật khẩu cũ không chính xác!');
    }

    user.password_hash = await bcrypt.hash(newPassword, 10);
    await this.usersRepository.save(user);
  }

  async updateLocation(
    userId: string,
    latitude: number,
    longitude: number,
  ): Promise<void> {
    const user = await this.usersRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('Người dùng không tồn tại!');
    }
    user.current_latitude = latitude;
    user.current_longitude = longitude;
    await this.usersRepository.save(user);
  }

  async heartbeat(userId: string): Promise<void> {
    const user = await this.usersRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('Người dùng không tồn tại!');
    }
    user.is_online = true;
    user.last_heartbeat = new Date();
    await this.usersRepository.save(user);
  }

  async findAllUsers(
    page = 1,
    limit = 10,
  ): Promise<{ data: User[]; meta: any }> {
    const [data, totalItems] = await this.usersRepository.findAndCount({
      relations: { hub: true },
      select: {
        id: true,
        employee_code: true,
        email: true,
        full_name: true,
        role: true,
        phone_number: true,
        address: true,
        status: true,
        created_at: true,
        updated_at: true,
        vehicle_number: true,
        vehicle_type: true,
        hub: {
          id: true,
          name: true,
        },
      },
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

  async findDispatchShippers(hubId: string): Promise<any[]> {
    const rawData = await this.usersRepository
      .createQueryBuilder('user')
      .leftJoinAndSelect(
        'shipments',
        'shipment',
        'shipment.shipperId = user.id AND shipment.status IN (:...statuses)',
        { statuses: ['PENDING', 'IN_TRANSIT'] },
      )
      .where('user.role = :role', { role: 'SHIPPER' })
      .andWhere('user.hubId = :hubId', { hubId })
      .select([
        'user.id AS id',
        'user.full_name AS full_name',
        'user.phone_number AS phone_number',
        'user.vehicle_number AS vehicle_number',
        'user.vehicle_type AS vehicle_type',
        'user.is_online AS is_online',
        'shipment.id AS current_shipment_id',
        'shipment.status AS current_shipment_status',
      ])
      .getRawMany();

    return rawData;
  }

  async adminUpdateUser(
    userId: string,
    dto: {
      fullName?: string;
      phone_number?: string;
      address?: string;
      role?: 'ADMIN' | 'SHIPPER' | 'HUB_COORDINATOR';
      hubId?: string;
      status?: string;
      vehicle_number?: string;
      vehicle_type?: string;
    },
  ): Promise<User> {
    const user = await this.usersRepository.findOne({
      where: { id: userId },
      relations: { hub: true },
    });
    if (!user) {
      throw new NotFoundException('Không tìm thấy người dùng!');
    }

    if (dto.fullName) user.full_name = dto.fullName;

    if (dto.phone_number) {
      const existPhone = await this.usersRepository.findOne({
        where: { phone_number: dto.phone_number },
      });
      if (existPhone && existPhone.id !== userId) {
        throw new ConflictException(
          'Số điện thoại này đã được sử dụng bởi tài khoản khác!',
        );
      }
      user.phone_number = dto.phone_number;
    }

    if (dto.address !== undefined) user.address = dto.address;
    if (dto.role) user.role = dto.role;
    if (dto.status) user.status = dto.status;
    if (dto.vehicle_number !== undefined)
      user.vehicle_number = dto.vehicle_number;
    if (dto.vehicle_type !== undefined) user.vehicle_type = dto.vehicle_type;

    if (dto.hubId !== undefined) {
      user.hub = dto.hubId ? ({ id: dto.hubId } as any) : null;
    }

    const savedUser = await this.usersRepository.save(user);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password_hash, refresh_token, ...result } = savedUser;
    return result as User;
  }

  async deleteUser(userId: string): Promise<void> {
    const user = await this.usersRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('Không tìm thấy người dùng!');
    }
    user.status = 'INACTIVE';
    await this.usersRepository.save(user);
  }
}
