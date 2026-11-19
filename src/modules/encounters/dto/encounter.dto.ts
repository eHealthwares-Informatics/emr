import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsEnum,
  IsObject,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import {
  ENCOUNTER_STATUSES,
  ENCOUNTER_TYPES,
  PHARMACY_SYNC_TARGETS,
  PRIORITIES,
  REQUEST_TYPES,
} from '../../../shared/domain/enums';
import type {
  EncounterStatus,
  EncounterType,
  PharmacySyncTarget,
  Priority,
  RequestType,
} from '../../../shared/domain/enums';
import { RequestItemDto } from '../../requests/dto/request.dto';

export class CreateEncounterDto {
  @ApiProperty()
  @IsString()
  patientId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  visitId?: string;

  @ApiProperty({ enum: ENCOUNTER_TYPES })
  @IsEnum(ENCOUNTER_TYPES)
  encounterType!: EncounterType;

  @ApiPropertyOptional({ enum: ENCOUNTER_STATUSES, default: 'ACTIVE' })
  @IsOptional()
  @IsEnum(ENCOUNTER_STATUSES)
  status?: EncounterStatus;

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
  @IsDateString()
  encounterDatetime?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reason?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

// Body for creating a request directly from an encounter context. patientId /
// patientName / encounterId / visitId are inferred from the encounter.
export class CreateEncounterRequestDto {
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
    description: 'Published REQUEST form the items were captured with.',
  })
  @IsOptional()
  @IsString()
  formDefinitionId?: string;

  @ApiPropertyOptional({ description: 'Raw answers from that form.' })
  @IsOptional()
  @IsObject()
  formData?: Record<string, unknown>;

  @ApiPropertyOptional({ enum: PHARMACY_SYNC_TARGETS })
  @IsOptional()
  @IsEnum(PHARMACY_SYNC_TARGETS)
  pharmacySyncTarget?: PharmacySyncTarget;

  @ApiProperty()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RequestItemDto)
  items!: RequestItemDto[];
}

export class UpdateEncounterDto {
  @ApiPropertyOptional({ enum: ENCOUNTER_STATUSES })
  @IsOptional()
  @IsEnum(ENCOUNTER_STATUSES)
  status?: EncounterStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  endedAt?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  patientId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  visitId?: string;

  @ApiPropertyOptional({ enum: ENCOUNTER_TYPES })
  @IsOptional()
  @IsEnum(ENCOUNTER_TYPES)
  encounterType?: EncounterType;

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
  @IsDateString()
  encounterDatetime?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reason?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}
