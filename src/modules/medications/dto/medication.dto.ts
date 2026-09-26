import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsMongoId,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { MEDICATION_STATUSES } from '../entities/medication.orm-entity';
import type { MedicationStatus } from '../entities/medication.orm-entity';

export class CreateMedicationDto {
  @ApiProperty({ description: 'The PRESCRIPTION request to source from' })
  @IsString()
  requestId!: string;

  @ApiProperty({ description: 'The prescription item index to convert' })
  @IsInt()
  @Min(0)
  itemIndex!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  dose?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  doseUnit?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  route?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  frequency?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  duration?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  durationUnit?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  quantity?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  instructions?: string;
}

export class AdministerMedicationDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  administeredAt?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({
    enum: ['ADMINISTERED', 'PARTIALLY_ADMINISTERED'],
    default: 'ADMINISTERED',
  })
  @IsOptional()
  @IsEnum(['ADMINISTERED', 'PARTIALLY_ADMINISTERED'] as const)
  outcome?: 'ADMINISTERED' | 'PARTIALLY_ADMINISTERED';
}

export class UpdateMedicationDto {
  @ApiPropertyOptional({ enum: MEDICATION_STATUSES })
  @IsOptional()
  @IsEnum(MEDICATION_STATUSES)
  status?: MedicationStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  dose?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  doseUnit?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  route?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  frequency?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  instructions?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  administrationNotes?: string;
}
