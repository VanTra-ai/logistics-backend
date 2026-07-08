import { IsString, IsNotEmpty, IsUUID } from 'class-validator';

export class CreateIncidentDto {
  @IsUUID()
  @IsNotEmpty()
  orderId!: string;

  @IsUUID()
  @IsNotEmpty()
  shipperId!: string;

  @IsString()
  @IsNotEmpty()
  reason!: string;

  @IsString()
  @IsNotEmpty()
  description!: string;
}
