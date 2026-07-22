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
  ForbiddenException,
  Query,
} from '@nestjs/common';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CreateInternalUserDto } from './dto/create-internal-user.dto';
import { Role } from '../common/enums/role.enum';
import { UsersService } from './users.service';
import { AuthGuard } from '@nestjs/passport';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ChangePasswordDto } from './dto/change-password.dto';

// @Controller('users') quy định rằng mọi API trong file này đều bắt đầu bằng http://localhost:3000/users
@Controller('users')
export class UsersController {
  // Tiêm UsersService vào để Controller có thể gọi hàm createUser
  constructor(private readonly usersService: UsersService) {}

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

  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('SHIPPER')
  @Patch('heartbeat')
  async heartbeat(@Request() req: { user: { userId: string } }) {
    await this.usersService.heartbeat(req.user.userId);
    return { message: 'Heartbeat nhận thành công!' };
  }

  @Get()
  @Roles(Role.ADMIN, Role.HUB_COORDINATOR)
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  async getAllUsers(
    @Request() req: { user: { role: string; hubId?: string } },
    @Query('page') page = 1,
    @Query('limit') limit = 10,
    @Query('status') status?: string,
    @Query('role') role?: string,
    @Query('hubId') hubIdFilter?: string,
    @Query('search') search?: string,
  ) {
    const result = await this.usersService.findAllUsers(
      Number(page),
      Number(limit),
      req.user,
      status,
      role,
      hubIdFilter,
      search,
    );
    return {
      message: 'Lấy danh sách người dùng thành công!',
      data: result.data,
      meta: result.meta,
    };
  }

  @Get('dispatch-shippers')
  @Roles(Role.ADMIN, Role.HUB_COORDINATOR)
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  async getDispatchShippers(
    @Request() req: { user: { hubId: string; role: string } },
    @Query('hubId') queryHubId?: string,
  ) {
    const targetHubId = req.user.role === 'ADMIN' ? queryHubId : req.user.hubId;
    const shippers = await this.usersService.findDispatchShippers(targetHubId);
    return { data: shippers };
  }

  @Patch(':id')
  @Roles(Role.ADMIN)
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  async adminUpdateUser(
    @Param('id') id: string,
    @Request() req: { user: { userId: string } },
    @Body()
    body: {
      fullName?: string;
      phone_number?: string;
      address?: string;
      role?: 'ADMIN' | 'SHIPPER' | 'HUB_COORDINATOR';
      hubId?: string;
      status?: string;
      vehicle_number?: string;
      vehicle_type?: string;
    },
  ) {
    if (
      req.user.userId === id &&
      body.role !== undefined &&
      body.role !== 'ADMIN'
    ) {
      throw new ForbiddenException('Bạn không thể tự hạ quyền của chính mình!');
    }
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
