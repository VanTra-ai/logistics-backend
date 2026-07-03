import { IsString, IsOptional, Length } from 'class-validator';

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  fullName?: string;

  @IsOptional()
  @IsString()
  @Length(10, 11, { message: 'Số điện thoại phải từ 10 đến 11 số' })
  phone_number?: string;

  @IsOptional()
  @IsString()
  address?: string;
}
