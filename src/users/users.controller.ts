import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CreateInternalUserDto } from './dto/create-internal-user.dto';
import { Role } from '../common/enums/role.enum';
import { UsersService } from './users.service';
import { AuthGuard } from '@nestjs/passport';
import { RegisterUserDto } from './dto/register-user.dto';

// @Controller('users') quy định rằng mọi API trong file này đều bắt đầu bằng http://localhost:3000/users
@Controller('users')
export class UsersController {
  // Tiêm UsersService vào để Controller có thể gọi hàm createUser
  constructor(private readonly usersService: UsersService) {}

  // @Post('register') tạo ra endpoint: POST http://localhost:3000/users/register
  @Post('register')
  async register(@Body() registerDto: RegisterUserDto) {
    const newUser = await this.usersService.createUser(registerDto);
    return {
      message: 'Đăng ký tài khoản thành công!',
      data: newUser,
    };
  }

  @Post('internal')
  @Roles(Role.ADMIN) // Chỉ Admin mới được quyền này
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  async createInternalUser(@Body() createUserDto: CreateInternalUserDto) {
    return await this.usersService.createInternal(createUserDto);
  }
}
