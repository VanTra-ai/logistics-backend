import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Query,
  Param,
  Body,
  UseGuards,
  Request,
  Res,
  HttpStatus,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../users/user.entity';
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
  UpdateOrderDto,
  UpdateDimensionsDto,
} from './orders.service';
import { LabelService } from './label.service';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';

import { OrdersExcelService } from './orders-excel.service';

@Controller('orders')
@UseGuards(AuthGuard('jwt'))
export class OrdersController {
  constructor(
    private readonly ordersService: OrdersService,
    private readonly labelService: LabelService,
    private readonly ordersExcelService: OrdersExcelService,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  @Post('import')
  @UseInterceptors(FileInterceptor('file'))
  @Roles('ADMIN', 'HUB_COORDINATOR')
  @UseGuards(RolesGuard)
  async importExcel(
    @UploadedFile()
    file: {
      fieldname: string;
      originalname: string;
      encoding: string;
      mimetype: string;
      buffer: Buffer;
      size: number;
    },
    @Request() req: { user: { role: string; hubId?: string } },
  ) {
    if (!file) {
      return { message: 'Không tìm thấy file tải lên.' };
    }
    const orders = await this.ordersExcelService.importOrders(
      file.buffer,
      req.user,
    );
    return {
      message: `Nhập thành công ${orders.length} đơn hàng!`,
      data: orders,
    };
  }

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
  async getAllOrders(
    @Request() req: { user: { userId: string; role: string; hubId?: string } },
    @Query('page') page = 1,
    @Query('limit') limit = 10,
    @Query('status') status?: string,
    @Query('hubId') hubIdFilter?: string,
    @Query('search') search?: string,
  ) {
    const result = await this.ordersService.findAllOrders(
      Number(page),
      Number(limit),
      req.user,
      status,
      hubIdFilter,
      search,
    );
    return {
      message: 'Lấy danh sách đơn hàng thành công!',
      data: result.data,
      meta: result.meta,
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
  @Roles('ADMIN', 'HUB_COORDINATOR', 'SHIPPER')
  @UseGuards(RolesGuard)
  async updateStatus(
    @Param('id') id: string,
    @Body() updateOrderStatusDto: UpdateOrderStatusDto,
    @Request() req: { user: { userId: string; role: string; hubId?: string } },
  ) {
    const order = await this.ordersService.updateOrderStatus(
      id,
      updateOrderStatusDto,
      req.user,
    );
    return {
      message: 'Cập nhật trạng thái đơn hàng thành công!',
      data: order,
    };
  }

  @Get('statistics')
  @Roles('ADMIN', 'HUB_COORDINATOR', 'SHIPPER')
  @UseGuards(RolesGuard)
  async getStatistics() {
    return await this.ordersService.getStatistics();
  }

  /**
   * GET /orders/:id/label
   * Xuất nhãn vận chuyển PDF khổ A6 cho đơn hàng.
   * Trả về inline PDF để trình duyệt/mobile preview trực tiếp.
   */
  @Get(':id/label')
  @UseGuards(AuthGuard('jwt'))
  async getShippingLabel(
    @Param('id') id: string,
    @Res() res: Response,
  ): Promise<void> {
    const pdfBuffer = await this.labelService.generateShippingLabel(id);

    res.status(HttpStatus.OK);
    res.setHeader('Content-Type', 'application/pdf');
    // inline → browser/WebView hiển thị ngay; attachment → bắt buộc tải xuống
    res.setHeader(
      'Content-Disposition',
      `inline; filename="label-${id.slice(0, 8)}.pdf"`,
    );
    res.setHeader('Content-Length', pdfBuffer.length);
    res.setHeader('Cache-Control', 'no-store');
    res.end(pdfBuffer);
  }

  @Patch(':id/cancel')
  async cancelOrder(
    @Param('id') id: string,
    @Body('reason') reason: string,
    @Request() req: { user: { role: string } },
  ) {
    const role = req.user.role;
    let cancelledBy: 'SHIPPER' | 'ADMIN';
    if (role === 'SHIPPER') {
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
    @Request() req: { user: { role: string; hubId?: string } },
  ) {
    const order = await this.ordersService.assignShipper(
      id,
      assignShipperDto.shipper_id,
      req.user,
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
    @Request() req: { user: { userId: string; role: string } },
  ) {
    // Xác định ai là người quét mã (để ghi log)
    const actor =
      req.user.role === 'ADMIN' ? 'Quản trị viên' : 'Điều phối viên';

    const result = await this.ordersService.scanInOrders(
      scanInDto.tracking_numbers,
      actor,
      req.user.userId,
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
    @Request() req: { user: { userId: string; role: string } },
  ) {
    const actor =
      req.user.role === 'ADMIN' ? 'Quản trị viên' : 'Điều phối viên';

    const result = await this.ordersService.scanOutOrders(
      scanOutDto.tracking_numbers,
      scanOutDto.shipper_id,
      actor,
      req.user.userId,
    );

    return {
      message: 'Xuất kho và bàn giao Shipper thành công!',
      data: result,
    };
  }

  @Patch(':id/complete')
  @Roles('SHIPPER', 'ADMIN') // API này CHO PHÉP ADMIN CẬP NHẬT ĐỂ TEST
  @UseGuards(RolesGuard)
  async completeOrder(
    @Param('id') id: string,
    @Body() completeOrderDto: CompleteOrderDto,
    @Request() req: { user: { userId: string; role: string } },
  ) {
    const order = await this.ordersService.completeOrder(
      id,
      req.user.userId,
      req.user.role,
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

  @Patch(':id/dimensions')
  @Roles('ADMIN', 'HUB_COORDINATOR', 'STATION_STAFF') // Station staff and above can edit weight
  @UseGuards(RolesGuard)
  async updateDimensions(
    @Param('id') id: string,
    @Body() updateDimensionsDto: UpdateDimensionsDto,
    @Request() req: { user: { role: string } },
  ) {
    const actor = req.user.role === 'ADMIN' ? 'Quản trị viên' : 'Nhân viên';
    const order = await this.ordersService.updateDimensions(
      id,
      updateDimensionsDto,
      actor,
    );

    return {
      message: 'Cập nhật thông số đơn hàng thành công!',
      data: order,
    };
  }

  @Patch(':id')
  async updateOrder(
    @Param('id') id: string,
    @Body() updateOrderDto: UpdateOrderDto,
  ) {
    const order = await this.ordersService.updateOrder(id, updateOrderDto);
    return {
      message: 'Cập nhật đơn hàng thành công!',
      data: order,
    };
  }

  @Delete(':id')
  @Roles('ADMIN', 'HUB_COORDINATOR')
  @UseGuards(RolesGuard)
  async deleteOrder(@Param('id') id: string) {
    return await this.ordersService.deleteOrder(id);
  }
}
