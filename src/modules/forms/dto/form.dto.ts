import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import type {
  FormSchema,
  FormSubmissionStatus,
} from '../../../shared/domain/emr.types';
import { FORM_CATEGORIES } from '../../../shared/domain/enums';
import type { FormCategory } from '../../../shared/domain/enums';

export class CreateFormDefinitionDto {
  @ApiProperty()
  @IsString()
  code!: string;

  @ApiProperty()
  @IsString()
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ enum: FORM_CATEGORIES })
  @IsEnum(FORM_CATEGORIES)
  category!: FormCategory;

  @ApiProperty()
  @IsObject()
  schemaJson!: FormSchema;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  version?: number;
}

export class UpdateFormDefinitionDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ enum: FORM_CATEGORIES })
  @IsOptional()
  @IsEnum(FORM_CATEGORIES)
  category?: FormCategory;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  schemaJson?: FormSchema;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  version?: number;
}

export class PublishFormDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class CreateFormSubmissionDto {
  @ApiProperty()
  @IsString()
  formDefinitionId!: string;

  @ApiProperty()
  @IsString()
  patientId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  visitId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  encounterId?: string;

  @ApiProperty()
  @IsObject()
  dataJson!: Record<string, unknown>;

  @ApiPropertyOptional({ enum: ['DRAFT', 'SUBMITTED'] })
  @IsOptional()
  @IsIn(['DRAFT', 'SUBMITTED'])
  status?: 'DRAFT' | 'SUBMITTED';
}

export class UpdateFormSubmissionDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  dataJson?: Record<string, unknown>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  visitId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  encounterId?: string;

  @ApiPropertyOptional({ enum: ['DRAFT', 'SUBMITTED', 'AMENDED'] })
  @IsOptional()
  @IsIn(['DRAFT', 'SUBMITTED', 'AMENDED'])
  status?: FormSubmissionStatus;
}
