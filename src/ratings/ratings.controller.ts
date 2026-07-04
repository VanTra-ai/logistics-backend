import { Controller, Post, Body, Request, UseGuards } from '@nestjs/common';
import { RatingsService, CreateRatingDto } from './ratings.service';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';

@Controller('ratings')
@UseGuards(AuthGuard('jwt'))
export class RatingsController {
  constructor(private readonly ratingsService: RatingsService) {}

  @Post()
  @Roles('CUSTOMER')
  @UseGuards(RolesGuard)
  async createRating(
    @Body() createRatingDto: CreateRatingDto,
    @Request() req: { user: { userId: string } },
  ) {
    const rating = await this.ratingsService.createRating(
      req.user.userId,
      createRatingDto,
    );

    return {
      message: 'Gửi đánh giá dịch vụ thành công. Cảm ơn phản hồi của bạn!',
      data: rating,
    };
  }
}
