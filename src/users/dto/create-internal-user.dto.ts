import {
  IsEmail,
  IsNotEmpty,
  IsEnum,
  IsString,
  MinLength,
  IsOptional,
} from 'class-validator';
import { Role } from '../../common/enums/role.enum';

export class CreateInternalUserDto {
  @IsEmail()
  email!: string;

  @IsString()
  @IsNotEmpty()
  phone_number!: string;

  @IsNotEmpty()
  @MinLength(6)
  password!: string;

  @IsString()
  fullName!: string;

  @IsEnum(Role)
  role!: Role;

  @IsString()
  @IsOptional()
  hubId?: string;
}
