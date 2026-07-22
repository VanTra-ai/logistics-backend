import { Controller, Get, Query } from '@nestjs/common';
import { GeoService } from './geo.service';

@Controller('geo')
export class GeoController {
  constructor(private readonly geoService: GeoService) {}

  @Get('provinces')
  async getProvinces() {
    const data = await this.geoService.getProvinces();
    return { data };
  }

  @Get('wards')
  async getWards(
    @Query('province_code') provinceCode: string,
    @Query('search') search?: string,
  ) {
    const data = await this.geoService.getWards(provinceCode, search);
    return { data };
  }
}
