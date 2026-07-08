import {
  IsString,
  IsNotEmpty,
  IsEnum,
  IsOptional,
  IsUUID,
} from 'class-validator';

export enum ResolveAction {
  REDELIVERY = 'REDELIVERY',
  RETURN = 'RETURN',
  COMPENSATION = 'COMPENSATION',
}

export class ResolveIncidentDto {
  @IsEnum(ResolveAction)
  @IsNotEmpty()
  action!: ResolveAction;

  @IsString()
  @IsOptional()
  resolution_notes?: string;

  @IsUUID()
  @IsNotEmpty()
  resolvedById!: string; // The ID of the admin/user who resolves it
}
