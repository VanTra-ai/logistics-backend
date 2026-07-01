import {
  Controller,
  Post,
  Get,
  Patch,
  Param,
  Body,
  UseGuards,
} from '@nestjs/common';
import {
  OrdersService,
  CreateOrderDto,
  UpdateOrderStatusDto,
} from './orders.service';
import { AuthGuard } from '@nestjs/passport';

@Controller('orders')
@UseGuards(AuthGuard('jwt'))
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post()
  async createOrder(@Body() createOrderDto: CreateOrderDto) {
    const order = await this.ordersService.createOrder(createOrderDto);
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
}
