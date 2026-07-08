import { IsString, IsNotEmpty, IsUUID, IsOptional } from 'class-validator';

export class CreateIncidentDto {
  @IsUUID()
  @IsNotEmpty()
  orderId!: string;

  @IsUUID()
  @IsOptional()
  shipperId?: string;

  @IsString()
  @IsNotEmpty()
  reason!: string;

  @IsString()
  @IsNotEmpty()
  description!: string;
}
