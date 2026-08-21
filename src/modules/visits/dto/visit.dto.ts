import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsEnum, IsOptional, IsString } from 'class-validator';
import { VISIT_STATUSES, VISIT_TYPES } from '../../../shared/domain/enums';
import type { VisitStatus, VisitType } from '../../../shared/domain/enums';

export class CreateVisitDto {
  @ApiProperty()
  @IsString()
  patientId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  patientName?: string;

  @ApiProperty({ enum: VISIT_TYPES, default: 'OUTPATIENT' })
  @IsEnum(VISIT_TYPES)
  visitType!: VisitType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  providerId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  providerName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  locationId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  appointmentId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  startDatetime?: string;
}

export class UpdateVisitDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  patientId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  patientName?: string;

  @ApiPropertyOptional({ enum: VISIT_TYPES })
  @IsOptional()
  @IsEnum(VISIT_TYPES)
  visitType?: VisitType;

  @ApiPropertyOptional({ enum: VISIT_STATUSES })
  @IsOptional()
  @IsEnum(VISIT_STATUSES)
  status?: VisitStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  providerId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  providerName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  locationId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  stopDatetime?: string;
}

export class EndVisitDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  stopDatetime?: string;
}
