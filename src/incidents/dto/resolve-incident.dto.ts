import { IsString, IsNotEmpty, IsEnum, IsOptional } from 'class-validator';

export enum ResolveAction {
  REDELIVERY = 'REDELIVERY',
  RETURN = 'RETURN',
  COMPENSATION = 'COMPENSATION',
  REJECT = 'REJECT',
}

export class ResolveIncidentDto {
  @IsEnum(ResolveAction)
  @IsNotEmpty()
  action!: ResolveAction;

  @IsString()
  @IsOptional()
  resolution_notes?: string;
}
