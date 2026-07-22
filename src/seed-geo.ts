import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

import * as xlsx from 'xlsx';
import { DataSource } from 'typeorm';
import { VietnamProvince, VietnamWard } from './geo/geo.entity';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const dataSource = app.get(DataSource);
  const provinceRepo = dataSource.getRepository(VietnamProvince);
  const wardRepo = dataSource.getRepository(VietnamWard);

  console.log('Reading Excel file...');
  const workbook = xlsx.readFile('Danh sách cấp xã ___20_07_2026.xls');
  const sheetName = workbook.SheetNames[0];
  const data: Record<string, string | number>[] = xlsx.utils.sheet_to_json(
    workbook.Sheets[sheetName],
  );

  console.log(`Found ${data.length} records. Processing...`);

  const provincesMap = new Map<string, string>();
  const wardsToInsert: Array<{
    code: string;
    name: string;
    province_code: string;
  }> = [];

  for (const row of data) {
    const wardCode = String(row['Mã']);
    const wardName = String(row['Tên']);
    const provinceCode = String(row['Mã TP']);
    const provinceName = String(row['Tỉnh / Thành Phố']);

    if (
      !wardCode ||
      !wardName ||
      !provinceCode ||
      !provinceName ||
      wardCode === 'undefined'
    )
      continue;

    provincesMap.set(provinceCode, provinceName);

    wardsToInsert.push({
      code: wardCode,
      name: wardName,
      province_code: provinceCode,
    });
  }

  console.log(`Found ${provincesMap.size} provinces.`);

  // Insert Provinces
  const provincesToInsert = Array.from(provincesMap.entries()).map(
    ([code, name]) => ({
      code,
      name,
    }),
  );

  await provinceRepo.save(provincesToInsert);
  console.log('Provinces seeded successfully.');

  // Insert Wards in chunks to avoid memory/query size issues
  console.log('Seeding Wards...');
  const chunkSize = 1000;
  for (let i = 0; i < wardsToInsert.length; i += chunkSize) {
    const chunk = wardsToInsert.slice(i, i + chunkSize);
    await wardRepo.save(chunk);
    console.log(`Seeded ${i + chunk.length}/${wardsToInsert.length} wards.`);
  }

  console.log('Seed completed successfully!');
  await app.close();
}

bootstrap().catch(console.error);
