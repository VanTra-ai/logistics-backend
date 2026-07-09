import { Injectable, UnauthorizedException } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../users/user.entity';

export class LoginDto {
  email!: string;
  password!: string;
}

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    private usersService: UsersService,
    private jwtService: JwtService,
  ) {}

  async login(loginDto: LoginDto) {
    // 1. Tìm user và kiểm tra mật khẩu (đoạn này chắc bạn đã viết rồi)
    const user = await this.usersRepository.findOne({
      where: { email: loginDto.email },
      relations: { hub: true },
    });
    if (
      !user ||
      !(await bcrypt.compare(loginDto.password, user.password_hash))
    ) {
      throw new UnauthorizedException('Email hoặc mật khẩu không chính xác!');
    }

    // 2. Tạo Payload cho JWT
    const payload = { 
      email: user.email, 
      sub: user.id, 
      role: user.role,
      hubId: user.hub?.id || null,
    };

    // 3. Tạo Access Token (sống ngắn) và Refresh Token (sống dài)
    const access_token = this.jwtService.sign(payload);
    const refresh_token = this.jwtService.sign(payload, { expiresIn: '7d' });

    // 4. Lưu refresh_token mới vào Database
    await this.usersRepository.update(user.id, {
      refresh_token: refresh_token,
    });

    // 5. Trả kết quả về cho Frontend / Mobile
    return {
      access_token,
      refresh_token,
      user: {
        id: user.id,
        email: user.email,
        full_name: user.full_name,
        role: user.role,
        hub: user.hub,
      },
    };
  }

  async logout(userId: string): Promise<void> {
    await this.usersRepository.update(userId, { refresh_token: null });
  }

  async refreshToken(refreshToken: string) {
    try {
      // 1. Ép kiểu rõ ràng cho payload để ESLint không báo lỗi "any"
      const payload = await this.jwtService.verifyAsync<{ sub: string }>(
        refreshToken,
      );

      // 2. Tìm user trong CSDL
      const user = await this.usersRepository.findOne({
        where: { id: payload.sub },
        relations: { hub: true },
      });

      // 3. Kiểm tra tính hợp lệ
      if (!user || user.refresh_token !== refreshToken) {
        throw new UnauthorizedException(
          'Refresh token không hợp lệ hoặc đã bị thu hồi!',
        );
      }

      // 4. Tạo cặp Token mới
      const newPayload = { 
        email: user.email, 
        sub: user.id, 
        role: user.role,
        hubId: user.hub?.id || null,
      };
      const new_access_token = this.jwtService.sign(newPayload);
      const new_refresh_token = this.jwtService.sign(newPayload, {
        expiresIn: '7d',
      });

      // 5. Cập nhật refresh_token mới vào Database
      await this.usersRepository.update(user.id, {
        refresh_token: new_refresh_token,
      });

      // 6. Trả về cho Client
      return {
        access_token: new_access_token,
        refresh_token: new_refresh_token,
      };
    } catch {
      // Bỏ chữ (error) đi vì chúng ta không sử dụng biến này bên trong
      throw new UnauthorizedException(
        'Refresh token đã hết hạn hoặc không hợp lệ, vui lòng đăng nhập lại!',
      );
    }
  }
}
