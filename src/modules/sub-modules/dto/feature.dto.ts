import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';
import { ENCOUNTER_TYPES } from '../../../shared/domain/enums';
import type { EncounterType } from '../../../shared/domain/enums';

export class CreateFeatureDto {
  @ApiProperty()
  @IsUUID()
  subModuleId!: string;

  @ApiProperty()
  @IsUUID()
  formDefinitionId!: string;

  @ApiPropertyOptional({ enum: ENCOUNTER_TYPES, default: 'CONSULTATION' })
  @IsOptional()
  @IsEnum(ENCOUNTER_TYPES)
  encounterType?: EncounterType;

  @ApiPropertyOptional({ type: [String], description: 'Identity role codes' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  roleCodes?: string[];

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateFeatureDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  formDefinitionId?: string;

  @ApiPropertyOptional({ enum: ENCOUNTER_TYPES })
  @IsOptional()
  @IsEnum(ENCOUNTER_TYPES)
  encounterType?: EncounterType;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  roleCodes?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class StartFeatureSessionDto {
  @ApiProperty({ description: 'Patient MRN' })
  @IsString()
  patientId!: string;
}
