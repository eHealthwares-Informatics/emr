import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
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
import { FORM_CATEGORIES, REQUEST_TYPES } from '../../../shared/domain/enums';
import type { FormCategory, RequestType } from '../../../shared/domain/enums';
import { ListQueryDto } from '../../../shared/dto/list-query.dto';

/** List filters for the forms table and for request-form lookup. */
export class ListFormDefinitionsQueryDto extends ListQueryDto {
  @ApiPropertyOptional({ enum: FORM_CATEGORIES })
  @IsOptional()
  @IsEnum(FORM_CATEGORIES)
  category?: FormCategory;

  @ApiPropertyOptional({
    enum: REQUEST_TYPES,
    description: 'REQUEST forms only: which request type they capture.',
  })
  @IsOptional()
  @IsEnum(REQUEST_TYPES)
  requestType?: RequestType;

  @ApiPropertyOptional({ enum: ['true', 'false'] })
  @IsOptional()
  @IsIn(['true', 'false'])
  published?: string;
}

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

  @ApiPropertyOptional({
    enum: REQUEST_TYPES,
    description:
      'Required for REQUEST forms: the request type whose items this form captures.',
  })
  @IsOptional()
  @IsEnum(REQUEST_TYPES)
  requestType?: RequestType;

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

  @ApiPropertyOptional({ enum: REQUEST_TYPES })
  @IsOptional()
  @IsEnum(REQUEST_TYPES)
  requestType?: RequestType;

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

  /**
   * Feature-session flow: close the linked encounter (COMPLETED + endedAt)
   * as part of creating this submission. Existing documentation flows leave
   * this unset so their encounter stays active.
   */
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  closeEncounter?: boolean;
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
