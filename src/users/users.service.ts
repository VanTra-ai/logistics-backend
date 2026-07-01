import {
  Injectable,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './user.entity';
import * as bcrypt from 'bcrypt';

interface DatabaseError extends Error {
  code?: string;
}

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
  ) {}

  async createUser(userData: Partial<User>): Promise<User> {
    // 1. Kiểm tra bắt buộc phải có mật khẩu
    if (!userData.password_hash) {
      throw new BadRequestException('Mật khẩu là bắt buộc!');
    }

    // 2. Băm mật khẩu
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(userData.password_hash, salt);

    // 3. Khởi tạo đối tượng User mới
    const newUser = this.usersRepository.create({
      ...userData,
      password_hash: hashedPassword,
    });

    try {
      // 4. Lưu xuống Database
      const savedUser = await this.usersRepository.save(newUser);

      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { password_hash, ...result } = savedUser;

      return result as User;
    } catch (error: unknown) {
      const dbError = error as DatabaseError;

      if (dbError.code === '23505') {
        throw new ConflictException(
          'Email hoặc Số điện thoại này đã được đăng ký!',
        );
      }
      throw error;
    }
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.usersRepository.findOne({
      where: { email },
    });
  }
}
