import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsIn,
  IsNumber,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateVehicleDto {
  @IsString()
  @IsNotEmpty()
  license_plate!: string;

  @IsString()
  @IsIn(['BIKE', 'VAN', 'TRUCK'])
  vehicle_type!: string;

  @IsNumber()
  @Min(1)
  @Type(() => Number)
  capacity_weight!: number;

  @IsString()
  @IsIn(['ACTIVE', 'MAINTENANCE', 'ON_TRIP'])
  @IsOptional()
  status?: string;

  @IsString()
  @IsOptional()
  hub_id?: string;

  @IsString()
  @IsOptional()
  assigned_shipper_id?: string;

  @IsString()
  @IsOptional()
  notes?: string;
}

export class UpdateVehicleDto {
  @IsString()
  @IsOptional()
  license_plate?: string;

  @IsString()
  @IsIn(['BIKE', 'VAN', 'TRUCK'])
  @IsOptional()
  vehicle_type?: string;

  @IsNumber()
  @Min(1)
  @Type(() => Number)
  @IsOptional()
  capacity_weight?: number;

  @IsString()
  @IsIn(['ACTIVE', 'MAINTENANCE', 'ON_TRIP'])
  @IsOptional()
  status?: string;

  @IsString()
  @IsOptional()
  hub_id?: string;

  // Truyền null để bỏ gán tài xế
  @IsOptional()
  assigned_shipper_id?: string | null;

  @IsString()
  @IsOptional()
  notes?: string;
}
