import { NestFactory, Reflector } from '@nestjs/core';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ClassSerializerInterceptor, ValidationPipe } from '@nestjs/common';
import * as express from 'express';
import { join } from 'path';
import * as fs from 'fs';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Make sure the uploads folder exists
  const incidentsDir = join(__dirname, '..', 'public', 'uploads', 'incidents');
  if (!fs.existsSync(incidentsDir)) {
    fs.mkdirSync(incidentsDir, { recursive: true });
  }

  const config = new DocumentBuilder()
    .setTitle('Logistics API')
    .setDescription('API cho hệ thống quản lý đơn hàng')
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // Tự động loại bỏ các trường không có trong DTO
      forbidNonWhitelisted: true, // Báo lỗi nếu gửi các trường lạ
      transform: true, // Tự động chuyển đổi kiểu dữ liệu (vd: string sang number)
    }),
  );

  // Áp dụng ClassSerializerInterceptor global để bảo vệ dữ liệu nhạy cảm
  app.useGlobalInterceptors(new ClassSerializerInterceptor(app.get(Reflector)));

  app.enableCors();

  app.use('/public', express.static(join(__dirname, '..', 'public')));

  await app.listen(3333);
}
bootstrap().catch((err) => {
  console.error('Lỗi khi khởi động ứng dụng:', err);
  process.exit(1); // Dừng app nếu có lỗi nghiêm trọng
});
