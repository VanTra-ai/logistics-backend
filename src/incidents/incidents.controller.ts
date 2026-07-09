import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  UseInterceptors,
  UploadedFile,
  UseGuards,
  Request,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { IncidentsService } from './incidents.service';
import { CreateIncidentDto } from './dto/create-incident.dto';
import { ResolveIncidentDto } from './dto/resolve-incident.dto';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';

@Controller('incidents')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class IncidentsController {
  constructor(private readonly incidentsService: IncidentsService) {}

  @Post()
  @Roles('SHIPPER', 'HUB_COORDINATOR')
  @UseInterceptors(
    FileInterceptor('proof_image', {
      storage: diskStorage({
        destination: './public/uploads/incidents',
        filename: (req, file, callback) => {
          const uniqueSuffix =
            Date.now() + '-' + Math.round(Math.random() * 1e9);
          const ext = extname(file.originalname);
          const filename = `${uniqueSuffix}${ext}`;
          callback(null, filename);
        },
      }),
    }),
  )
  create(
    @Body() createIncidentDto: CreateIncidentDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    const proof_image_url = file
      ? `/public/uploads/incidents/${file.filename}`
      : undefined;
    return this.incidentsService.create(createIncidentDto, proof_image_url);
  }

  @Get()
  @Roles('ADMIN', 'HUB_COORDINATOR', 'SHIPPER')
  findAll() {
    return this.incidentsService.findAll();
  }

  @Patch(':id/resolve')
  @Roles('ADMIN', 'HUB_COORDINATOR')
  resolve(
    @Param('id') id: string,
    @Body() resolveDto: ResolveIncidentDto,
    @Request() req: { user: { userId: string; role?: string; hubId?: string } },
  ) {
    return this.incidentsService.resolve(id, resolveDto, req.user);
  }
}
