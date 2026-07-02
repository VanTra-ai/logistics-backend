import { Injectable, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './user.entity';
import * as bcrypt from 'bcrypt';
import { CreateInternalUserDto } from './dto/create-internal-user.dto';
import { RegisterUserDto } from './dto/register-user.dto';
import { Role } from '../common/enums/role.enum';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
  ) {}

  async createUser(userData: RegisterUserDto): Promise<User> {
    const existingUser = await this.usersRepository.findOne({
      where: [
        { email: userData.email },
        { phone_number: userData.phone_number },
      ],
    });

    if (existingUser) {
      if (existingUser.email === userData.email) {
        throw new ConflictException('Email này đã được sử dụng!');
      }
      if (existingUser.phone_number === userData.phone_number) {
        throw new ConflictException('Số điện thoại này đã được sử dụng!');
      }
    }

    const hashedPassword = await bcrypt.hash(userData.password_hash, 10);

    const newUser = this.usersRepository.create({
      ...userData,
      password_hash: hashedPassword,
      role: userData.role || Role.CUSTOMER,
    });

    const savedUser = await this.usersRepository.save(newUser);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password_hash, ...result } = savedUser;
    return result as User;
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

    const newUser = this.usersRepository.create({
      email: dto.email,
      phone_number: dto.phone_number,
      password_hash: hashedPassword,
      full_name: dto.fullName,
      role: dto.role,
      ...(dto.hubId ? { hub: { id: dto.hubId } } : {}),
    });

    const savedUser = await this.usersRepository.save(newUser);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password_hash, ...result } = savedUser;
    return result as User;
  }
}
