import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
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

  await app.listen(3000);
}
bootstrap().catch((err) => {
  console.error('Lỗi khi khởi động ứng dụng:', err);
  process.exit(1); // Dừng app nếu có lỗi nghiêm trọng
});
