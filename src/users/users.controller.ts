import { Controller, Post, Body } from '@nestjs/common';
import { UsersService } from './users.service';
import { User } from './user.entity';

// @Controller('users') quy định rằng mọi API trong file này đều bắt đầu bằng http://localhost:3000/users
@Controller('users')
export class UsersController {
  // Tiêm UsersService vào để Controller có thể gọi hàm createUser
  constructor(private readonly usersService: UsersService) {}

  // @Post('register') tạo ra endpoint: POST http://localhost:3000/users/register
  @Post('register')
  async register(@Body() userData: Partial<User>) {
    // Gọi sang Service để xử lý logic băm mật khẩu và lưu DB
    const newUser = await this.usersService.createUser(userData);

    // Trả về kết quả JSON cho Client
    return {
      message: 'Đăng ký tài khoản thành công!',
      data: newUser,
    };
  }
}
