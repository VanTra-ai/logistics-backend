import {
  Controller,
  Post,
  Get,
  Patch,
  Body,
  Param,
  Request,
  UseGuards,
} from '@nestjs/common';
import {
  TicketsService,
  CreateTicketDto,
  ResolveTicketDto,
} from './tickets.service';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';

@Controller('tickets')
@UseGuards(AuthGuard('jwt'))
export class TicketsController {
  constructor(private readonly ticketsService: TicketsService) {}

  @Get('me')
  @Roles('CUSTOMER')
  @UseGuards(RolesGuard)
  async getMyTickets(@Request() req: { user: { userId: string } }) {
    const tickets = await this.ticketsService.getMyTickets(req.user.userId);

    return {
      message: 'Tra cứu danh sách khiếu nại thành công!',
      data: tickets,
    };
  }

  @Post()
  @Roles('CUSTOMER') // Thường thì khách hàng sẽ là người tạo khiếu nại
  @UseGuards(RolesGuard)
  async createTicket(
    @Body() createTicketDto: CreateTicketDto,
    @Request() req: { user: { userId: string } }, // Dùng userId chuẩn xác
  ) {
    const ticket = await this.ticketsService.createTicket(
      req.user.userId,
      createTicketDto,
    );

    return {
      message: 'Gửi yêu cầu hỗ trợ thành công. Chúng tôi sẽ phản hồi sớm nhất!',
      data: ticket,
    };
  }

  @Patch(':id/resolve')
  @Roles('ADMIN') // CHỈ ADMIN MỚI CÓ QUYỀN PHẢN HỒI
  @UseGuards(RolesGuard)
  async resolveTicket(
    @Param('id') id: string,
    @Body() resolveTicketDto: ResolveTicketDto,
  ) {
    const updatedTicket = await this.ticketsService.resolveTicket(
      id,
      resolveTicketDto,
    );

    return {
      message: 'Gửi phản hồi và xử lý khiếu nại thành công!',
      data: updatedTicket,
    };
  }
}
