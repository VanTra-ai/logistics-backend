import {
  Controller,
  Post,
  Body,
  UseGuards,
  Request,
  Get,
  Patch,
  Param,
  Delete,
} from '@nestjs/common';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CreateInternalUserDto } from './dto/create-internal-user.dto';
import { Role } from '../common/enums/role.enum';
import { UsersService } from './users.service';
import { AuthGuard } from '@nestjs/passport';
import { RegisterUserDto } from './dto/register-user.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ChangePasswordDto } from './dto/change-password.dto';

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

  @UseGuards(AuthGuard('jwt')) // Phải đăng nhập mới xem được profile
  @Get('profile')
  async getMe(@Request() req: { user: { userId: string } }) {
    return this.usersService.findOneById(req.user.userId);
  }

  @UseGuards(AuthGuard('jwt'))
  @Patch('profile')
  async updateProfile(
    @Request() req: { user: { userId: string } },
    @Body() updateProfileDto: UpdateProfileDto,
  ) {
    return this.usersService.updateProfile(req.user.userId, updateProfileDto);
  }

  @UseGuards(AuthGuard('jwt'))
  @Patch('change-password')
  async changePassword(
    @Request() req: { user: { userId: string } },
    @Body() changePasswordDto: ChangePasswordDto,
  ) {
    await this.usersService.changePassword(
      req.user.userId,
      changePasswordDto.oldPassword,
      changePasswordDto.newPassword,
    );
    return { message: 'Đổi mật khẩu thành công!' };
  }

  @UseGuards(AuthGuard('jwt'))
  @Patch('location')
  async updateLocation(
    @Request() req: { user: { userId: string } },
    @Body() body: { latitude: number; longitude: number },
  ) {
    await this.usersService.updateLocation(
      req.user.userId,
      body.latitude,
      body.longitude,
    );
    return { message: 'Cập nhật vị trí thành công!' };
  }

  @Get()
  @Roles(Role.ADMIN, Role.HUB_COORDINATOR)
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  async getAllUsers() {
    return await this.usersService.findAllUsers();
  }

  @Patch(':id')
  @Roles(Role.ADMIN)
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  async adminUpdateUser(
    @Param('id') id: string,
    @Body()
    body: {
      fullName?: string;
      phone_number?: string;
      address?: string;
      role?: Role;
      hubId?: string;
      status?: string;
    },
  ) {
    return await this.usersService.adminUpdateUser(id, body);
  }

  @Delete(':id')
  @Roles(Role.ADMIN)
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  async deleteUser(@Param('id') id: string) {
    await this.usersService.deleteUser(id);
    return { message: 'Đã ngừng kích hoạt tài khoản nhân viên thành công!' };
  }
}
