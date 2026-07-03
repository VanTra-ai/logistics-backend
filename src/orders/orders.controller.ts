import {
  Controller,
  Post,
  Get,
  Patch,
  Param,
  Body,
  UseGuards,
  Request,
} from '@nestjs/common';
import {
  OrdersService,
  CreateOrderDto,
  UpdateOrderStatusDto,
  AssignShipperDto,
  ScanInDto,
  ScanOutDto,
  CompleteOrderDto,
} from './orders.service';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';

@Controller('orders')
@UseGuards(AuthGuard('jwt'))
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post()
  async createOrder(
    @Body() createOrderDto: CreateOrderDto,
    @Request() req: { user: { userId: string } },
  ) {
    const order = await this.ordersService.createOrder(
      createOrderDto,
      req.user.userId,
    );
    return {
      message: 'Tạo đơn hàng thành công!',
      data: order,
    };
  }

  @Get()
  async getAllOrders() {
    const orders = await this.ordersService.findAllOrders();
    return {
      message: 'Lấy danh sách đơn hàng thành công!',
      data: orders,
    };
  }

  @Get('me')
  async getMyOrders(
    @Request() req: { user: { userId: string; role: string } },
  ) {
    // req.user.userId chính là userId được giải mã từ JWT Token
    const orders = await this.ordersService.findMyOrders(
      req.user.userId,
      req.user.role,
    );

    return {
      message: 'Lấy danh sách đơn hàng cá nhân thành công!',
      data: orders,
    };
  }

  @Patch(':id/status')
  async updateStatus(
    @Param('id') id: string,
    @Body() updateOrderStatusDto: UpdateOrderStatusDto,
  ) {
    const order = await this.ordersService.updateOrderStatus(
      id,
      updateOrderStatusDto,
    );
    return {
      message: 'Cập nhật trạng thái đơn hàng thành công!',
      data: order,
    };
  }

  @Get('statistics')
  @Roles('ADMIN')
  @UseGuards(RolesGuard)
  async getStatistics() {
    return await this.ordersService.getStatistics();
  }

  @Patch(':id/cancel')
  async cancelOrder(
    @Param('id') id: string,
    @Body('reason') reason: string,
    @Request() req: { user: { role: string } },
  ) {
    const role = req.user.role;
    let cancelledBy: 'CUSTOMER' | 'SHIPPER' | 'ADMIN';
    if (role === 'CUSTOMER') {
      cancelledBy = 'CUSTOMER';
    } else if (role === 'SHIPPER') {
      cancelledBy = 'SHIPPER';
    } else {
      cancelledBy = 'ADMIN';
    }

    return await this.ordersService.cancelOrder(id, reason, cancelledBy);
  }

  @Patch(':id/assign')
  @Roles('ADMIN') // Tương lai có thể thêm 'HUB_COORDINATOR'
  @UseGuards(RolesGuard)
  async assignShipper(
    @Param('id') id: string,
    @Body() assignShipperDto: AssignShipperDto,
  ) {
    const order = await this.ordersService.assignShipper(
      id,
      assignShipperDto.shipper_id,
    );
    return {
      message: 'Điều phối Shipper thành công!',
      data: order,
    };
  }

  @Post('scan-in')
  @Roles('ADMIN') // Tương lai bạn có thể cấp thêm quyền cho HUB_COORDINATOR
  @UseGuards(RolesGuard)
  async scanIn(
    @Body() scanInDto: ScanInDto,
    @Request() req: { user: { role: string } },
  ) {
    // Xác định ai là người quét mã (để ghi log)
    const actor =
      req.user.role === 'ADMIN' ? 'Quản trị viên' : 'Điều phối viên';

    const result = await this.ordersService.scanInOrders(
      scanInDto.tracking_numbers,
      actor,
    );

    return {
      message: 'Quét mã nhập kho hoàn tất!',
      data: result,
    };
  }

  @Post('scan-out')
  @Roles('ADMIN') // Tương lai có thể mở rộng cho HUB_COORDINATOR
  @UseGuards(RolesGuard)
  async scanOut(
    @Body() scanOutDto: ScanOutDto,
    @Request() req: { user: { role: string } },
  ) {
    const actor =
      req.user.role === 'ADMIN' ? 'Quản trị viên' : 'Điều phối viên';

    const result = await this.ordersService.scanOutOrders(
      scanOutDto.tracking_numbers,
      scanOutDto.shipper_id,
      actor,
    );

    return {
      message: 'Xuất kho và bàn giao Shipper thành công!',
      data: result,
    };
  }

  @Patch(':id/complete')
  @Roles('SHIPPER') // API này CHỈ DÀNH CHO SHIPPER
  @UseGuards(RolesGuard)
  async completeOrder(
    @Param('id') id: string,
    @Body() completeOrderDto: CompleteOrderDto,
    @Request() req: { user: { userId: string } }, // userId chính là shipperId
  ) {
    const order = await this.ordersService.completeOrder(
      id,
      req.user.userId,
      completeOrderDto,
    );

    return {
      message: 'Hoàn tất giao hàng thành công!',
      data: order,
    };
  }
}
