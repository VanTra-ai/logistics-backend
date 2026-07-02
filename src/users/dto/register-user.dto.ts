import {
  IsEmail,
  IsNotEmpty,
  IsString,
  MinLength,
  IsEnum,
  IsOptional,
} from 'class-validator';
import { Role } from '../../common/enums/role.enum';

export class RegisterUserDto {
  @IsEmail({}, { message: 'Định dạng email không hợp lệ!' })
  @IsNotEmpty()
  email!: string;

  @IsString()
  @IsNotEmpty()
  phone_number!: string;

  @IsString()
  @MinLength(6, { message: 'Mật khẩu phải có ít nhất 6 ký tự!' })
  password_hash!: string;

  @IsString()
  @IsNotEmpty()
  full_name!: string;

  @IsEnum(Role, { message: 'Quyền không hợp lệ!' })
  @IsOptional()
  role?: Role;
}
