import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import {
  PHARMACY_SYNC_TARGETS,
  PRIORITIES,
  REQUEST_STATUSES,
  REQUEST_TYPES,
} from '../../../shared/domain/enums';
import type {
  PharmacySyncTarget,
  Priority,
  RequestStatus,
  RequestType,
} from '../../../shared/domain/enums';

/** Kind of catalog reference carried on a request item line. */
export const REQUEST_ITEM_KINDS = [
  'STOCK_ITEM',
  'GENERIC_PRODUCT',
  'GENERIC_DRUG',
  'LOINC_TEST',
] as const;
export type RequestItemKind = (typeof REQUEST_ITEM_KINDS)[number];

export class RequestItemDto {
  @ApiProperty()
  @IsString()
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  code?: string;

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
  frequency?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  route?: string;

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
  @IsNumber()
  @Min(0)
  quantity?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  instructions?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  testDefinitionId?: string;

  @ApiPropertyOptional({
    enum: REQUEST_ITEM_KINDS,
    description:
      'Which catalog the line was picked from (stock item, generic product, NDF/EMDEx generic drug, or LOINC test).',
  })
  @IsOptional()
  @IsEnum(REQUEST_ITEM_KINDS)
  itemKind?: RequestItemKind;

  @ApiPropertyOptional({
    description:
      'Stable cross-system reference for the line, propagated to rxsoft orders and LIS order items.',
  })
  @IsOptional()
  @IsString()
  referenceCode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  sampleType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  specimenNotes?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  modality?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  bodyPart?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  contrast?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  clinicalIndication?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class CreateRequestDto {
  @ApiProperty()
  @IsString()
  patientId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  patientName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  encounterId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  visitId?: string;

  @ApiProperty({ enum: REQUEST_TYPES })
  @IsEnum(REQUEST_TYPES)
  requestType!: RequestType;

  @ApiPropertyOptional({ enum: PRIORITIES, default: 'ROUTINE' })
  @IsOptional()
  @IsEnum(PRIORITIES)
  priority?: Priority;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  orderingProviderId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  orderingProviderName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  diagnosis?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  clinicalNotes?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  requestedAt?: string;

  @ApiPropertyOptional({
    description:
      'Published REQUEST form the items were captured with (provenance/print).',
  })
  @IsOptional()
  @IsString()
  formDefinitionId?: string;

  @ApiPropertyOptional({
    description: 'Raw answers from that form, kept for print and audit.',
  })
  @IsOptional()
  @IsObject()
  formData?: Record<string, unknown>;

  @ApiPropertyOptional({
    enum: PHARMACY_SYNC_TARGETS,
    description:
      'PRESCRIPTION only: send to the pharmacy prescriptions queue (`prescription`) or as a storefront order (`order`). Defaults to EMR_PHARMACY_SYNC_MODE.',
  })
  @IsOptional()
  @IsEnum(PHARMACY_SYNC_TARGETS)
  pharmacySyncTarget?: PharmacySyncTarget;

  @ApiProperty()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RequestItemDto)
  items!: RequestItemDto[];
}

export class UpdateRequestDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  patientId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  patientName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  encounterId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  visitId?: string;

  @ApiPropertyOptional({ enum: PRIORITIES })
  @IsOptional()
  @IsEnum(PRIORITIES)
  priority?: Priority;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  orderingProviderId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  orderingProviderName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  diagnosis?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  clinicalNotes?: string;

  @ApiPropertyOptional({
    description:
      'Published REQUEST form the items were captured with (provenance/print).',
  })
  @IsOptional()
  @IsString()
  formDefinitionId?: string;

  @ApiPropertyOptional({
    description: 'Raw answers from that form, kept for print and audit.',
  })
  @IsOptional()
  @IsObject()
  formData?: Record<string, unknown>;

  @ApiPropertyOptional({
    enum: PHARMACY_SYNC_TARGETS,
    description:
      'PRESCRIPTION only: change where a later (re)send goes — prescriptions queue or pharmacy order.',
  })
  @IsOptional()
  @IsEnum(PHARMACY_SYNC_TARGETS)
  pharmacySyncTarget?: PharmacySyncTarget;

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RequestItemDto)
  items?: RequestItemDto[];
}

export class TransitionRequestStatusDto {
  @ApiProperty({ enum: REQUEST_STATUSES })
  @IsEnum(REQUEST_STATUSES)
  status!: RequestStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reason?: string;
}

export class AddRequestNoteDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  note!: string;
}

export class SyncRequestDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  externalOrderId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  externalReference?: string;
}
