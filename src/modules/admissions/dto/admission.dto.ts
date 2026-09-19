import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';
import {
  ADMISSION_TYPES,
  DISCHARGE_TYPES,
  type AdmissionType,
  type DischargeType,
} from '../../../shared/domain/enums';

export class AdmitPatientDto {
  @ApiProperty({ description: 'Patient MRN' })
  @IsString()
  @IsNotEmpty()
  patientId!: string;

  @ApiProperty({ description: 'Patient display name' })
  @IsString()
  @IsNotEmpty()
  patientName!: string;

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  wardId?: string;

  @ApiPropertyOptional({ description: 'Bed to allocate on admission' })
  @IsUUID()
  @IsOptional()
  bedId?: string;

  @ApiPropertyOptional({ default: new Date().toISOString() })
  @IsDateString()
  @IsOptional()
  admissionDatetime?: string;

  @ApiPropertyOptional({ enum: ADMISSION_TYPES, default: 'ELECTIVE' })
  @IsIn(ADMISSION_TYPES)
  @IsOptional()
  admissionType?: AdmissionType;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  diagnosis?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  referringProviderId?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  referringProviderName?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  notes?: string;
}

export class UpdateAdmissionDto {
  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  wardId?: string;

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  bedId?: string;

  @ApiPropertyOptional()
  @IsDateString()
  @IsOptional()
  admissionDatetime?: string;

  @ApiPropertyOptional({ enum: ADMISSION_TYPES })
  @IsIn(ADMISSION_TYPES)
  @IsOptional()
  admissionType?: AdmissionType;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  diagnosis?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  referringProviderId?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  referringProviderName?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  notes?: string;
}

export class DischargeDto {
  @ApiPropertyOptional({ enum: DISCHARGE_TYPES, default: 'DISCHARGED_HOME' })
  @IsIn(DISCHARGE_TYPES)
  @IsOptional()
  dischargeType?: DischargeType;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  dischargeSummary?: string;

  @ApiPropertyOptional({ default: new Date().toISOString() })
  @IsDateString()
  @IsOptional()
  dischargeDatetime?: string;
}

export class TransferAdmissionDto {
  @ApiPropertyOptional({ description: 'Destination ward' })
  @IsUUID()
  @IsOptional()
  wardId?: string;

  @ApiPropertyOptional({ description: 'Destination bed' })
  @IsUUID()
  @IsOptional()
  bedId?: string;
}
