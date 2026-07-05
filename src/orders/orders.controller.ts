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
  ReturnOrderDto,
  RetryOrderDto,
  RtsOrderDto,
  RemitOrdersDto,
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
  @Roles('ADMIN', 'HUB_COORDINATOR') // Tương lai có thể thêm 'HUB_COORDINATOR'
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
  @Roles('ADMIN', 'HUB_COORDINATOR') // Tương lai bạn có thể cấp thêm quyền cho HUB_COORDINATOR
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
  @Roles('ADMIN', 'HUB_COORDINATOR') // Tương lai có thể mở rộng cho HUB_COORDINATOR
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

  @Patch(':id/return')
  @Roles('SHIPPER', 'ADMIN') // Cho phép cả Shipper và Admin thao tác
  @UseGuards(RolesGuard)
  async returnOrder(
    @Param('id') id: string,
    @Body() returnOrderDto: ReturnOrderDto,
    @Request() req: { user: { userId: string; role: string } },
  ) {
    // Truyền userId và role xuống Service để xử lý logic phân quyền
    const order = await this.ordersService.returnOrder(
      id,
      req.user.userId,
      req.user.role,
      returnOrderDto,
    );

    return {
      message: 'Báo cáo hoàn hàng thành công!',
      data: order,
    };
  }

  @Patch(':id/retry')
  @Roles('ADMIN', 'HUB_COORDINATOR') // API dành cho bộ phận vận hành bưu cục
  @UseGuards(RolesGuard)
  async retryDelivery(
    @Param('id') id: string,
    @Body() retryOrderDto: RetryOrderDto,
    @Request() req: { user: { role: string } },
  ) {
    const actor =
      req.user.role === 'ADMIN' ? 'Quản trị viên' : 'Điều phối viên';
    const order = await this.ordersService.retryDelivery(
      id,
      retryOrderDto,
      actor,
    );

    return {
      message: 'Cập nhật lệnh giao lại thành công!',
      data: order,
    };
  }

  @Patch(':id/rts')
  @Roles('ADMIN', 'HUB_COORDINATOR')
  @UseGuards(RolesGuard)
  async returnToSender(
    @Param('id') id: string,
    @Body() rtsOrderDto: RtsOrderDto,
    @Request() req: { user: { role: string } },
  ) {
    const actor =
      req.user.role === 'ADMIN' ? 'Quản trị viên' : 'Điều phối viên';
    const order = await this.ordersService.returnToSender(
      id,
      rtsOrderDto,
      actor,
    );

    return {
      message: 'Đã chốt chuyển hoàn đơn hàng về cho người gửi!',
      data: order,
    };
  }

  @Post('remit')
  @Roles('ADMIN', 'HUB_COORDINATOR') // Chỉ Kế toán hoặc Quản lý bưu cục mới được quyền thu tiền
  @UseGuards(RolesGuard)
  async remitCOD(
    @Body() remitOrdersDto: RemitOrdersDto,
    @Request() req: { user: { role: string } },
  ) {
    const actor = req.user.role === 'ADMIN' ? 'Quản trị viên' : 'Kế toán';
    const result = await this.ordersService.remitCOD(
      remitOrdersDto.order_ids,
      actor,
    );

    return {
      message: 'Nộp tiền COD về bưu cục thành công!',
      data: result,
    };
  }
}
