import {
  Injectable,
  UnauthorizedException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan } from 'typeorm';
import { User } from '../users/user.entity';
import { PasswordResetOtp } from './password-reset-otp.entity';
import { MailService } from '../common/mail.service';

export class LoginDto {
  email!: string;
  password!: string;
}

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    @InjectRepository(PasswordResetOtp)
    private otpRepository: Repository<PasswordResetOtp>,
    private usersService: UsersService,
    private jwtService: JwtService,
    private mailService: MailService,
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

  async requestForgotPasswordOtp(email: string) {
    const user = await this.usersRepository.findOne({ where: { email } });
    if (!user) {
      throw new NotFoundException(
        'Email này chưa được đăng ký trong hệ thống!',
      );
    }

    // 6-digit numeric OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expires_at = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Invalidate prior unused OTPs
    await this.otpRepository.update(
      { email, is_used: false },
      { is_used: true },
    );

    const newOtp = this.otpRepository.create({
      email,
      otp,
      expires_at,
    });
    await this.otpRepository.save(newOtp);

    // Send HTML OTP Email via Nodemailer/SMTP
    await this.mailService.sendOtpEmail(email, otp);

    return {
      message: 'Mã OTP 6 chữ số đã được gửi đến email của bạn!',
      email,
      otp: process.env.NODE_ENV !== 'production' ? otp : undefined,
    };
  }

  async verifyForgotPasswordOtp(email: string, otp: string) {
    const validOtp = await this.otpRepository.findOne({
      where: {
        email,
        otp,
        is_used: false,
        expires_at: MoreThan(new Date()),
      },
    });

    if (!validOtp) {
      throw new BadRequestException('Mã OTP không chính xác hoặc đã hết hạn!');
    }

    return { message: 'Mã OTP hợp lệ!' };
  }

  async resetPasswordWithOtp(dto: {
    email: string;
    otp: string;
    newPassword: string;
  }) {
    const validOtp = await this.otpRepository.findOne({
      where: {
        email: dto.email,
        otp: dto.otp,
        is_used: false,
        expires_at: MoreThan(new Date()),
      },
    });

    if (!validOtp) {
      throw new BadRequestException('Mã OTP không chính xác hoặc đã hết hạn!');
    }

    const user = await this.usersRepository.findOne({
      where: { email: dto.email },
    });
    if (!user) {
      throw new NotFoundException('Người dùng không tồn tại!');
    }

    const hashedPassword = await bcrypt.hash(dto.newPassword, 10);
    await this.usersRepository.update(user.id, {
      password_hash: hashedPassword,
    });

    await this.otpRepository.update(validOtp.id, { is_used: true });

    return { message: 'Đặt lại mật khẩu thành công! Vui lòng đăng nhập lại.' };
  }
}
