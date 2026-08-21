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
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { PRIORITIES, REQUEST_STATUSES, REQUEST_TYPES } from '../../../shared/domain/enums';
import type { Priority, RequestStatus, RequestType } from '../../../shared/domain/enums';

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
