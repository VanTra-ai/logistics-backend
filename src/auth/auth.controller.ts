import {
  Controller,
  Post,
  Body,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('login')
  async login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }

  @UseGuards(AuthGuard('jwt'))
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(@Request() req: { user: { userId: string } }) {
    await this.authService.logout(req.user.userId);
    return {
      message: 'Đăng xuất thành công!',
    };
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(@Body() refreshTokenDto: RefreshTokenDto) {
    return this.authService.refreshToken(refreshTokenDto.refresh_token);
  }

  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  async forgotPassword(@Body() body: { email: string }) {
    return await this.authService.requestForgotPasswordOtp(body.email);
  }

  @Post('verify-otp')
  @HttpCode(HttpStatus.OK)
  async verifyOtp(@Body() body: { email: string; otp: string }) {
    return await this.authService.verifyForgotPasswordOtp(body.email, body.otp);
  }

  @Post('reset-password-otp')
  @HttpCode(HttpStatus.OK)
  async resetPasswordOtp(
    @Body() body: { email: string; otp: string; newPassword: string },
  ) {
    return await this.authService.resetPasswordWithOtp(body);
  }
}
