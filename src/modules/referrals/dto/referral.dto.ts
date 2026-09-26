import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';
import {
  REFERRAL_PRIORITIES,
  REFERRAL_STATUSES,
} from '../entities/referral.orm-entity';
import type {
  ReferralPriority,
  ReferralStatus,
} from '../entities/referral.orm-entity';

export class CreateReferralDto {
  @ApiProperty()
  @IsString()
  patientId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  patientName?: string;

  @ApiProperty()
  @IsString()
  encounterId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  visitId?: string;

  @ApiProperty()
  @IsString()
  specialistProviderId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  specialistProviderName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  specialty?: string;

  @ApiProperty({ minLength: 3 })
  @IsString()
  @MinLength(3)
  reason!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({ enum: REFERRAL_PRIORITIES, default: 'ROUTINE' })
  @IsOptional()
  @IsEnum(REFERRAL_PRIORITIES)
  priority?: ReferralPriority;
}

export class DecideReferralDto {
  @ApiProperty({ enum: ['ACCEPTED', 'DECLINED'] })
  @IsEnum(['ACCEPTED', 'DECLINED'] as const)
  decision!: Exclude<ReferralStatus, 'PENDING' | 'COMPLETED'>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reason?: string;
}

export class CompleteReferralDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  outcomeNotes?: string;
}

export class UpdateReferralDto {
  @ApiPropertyOptional({ enum: REFERRAL_STATUSES })
  @IsOptional()
  @IsEnum(REFERRAL_STATUSES)
  status?: ReferralStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({ enum: REFERRAL_PRIORITIES })
  @IsOptional()
  @IsEnum(REFERRAL_PRIORITIES)
  priority?: ReferralPriority;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  decisionReason?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  completedAt?: string;
}
