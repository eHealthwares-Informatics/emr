import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class CreateFormShareLinkDto {
  @ApiPropertyOptional({ enum: ['template', 'instance'] })
  @IsOptional()
  @IsIn(['template', 'instance'])
  mode?: 'template' | 'instance';

  @ApiPropertyOptional({ description: 'Patient MRN for a patient-bound link' })
  @IsOptional()
  @IsString()
  patientId?: string;

  @ApiPropertyOptional({ description: 'Existing submission to reopen' })
  @IsOptional()
  @IsString()
  submissionId?: string;

  @ApiPropertyOptional({ default: 48 })
  @IsOptional()
  @IsInt()
  @Min(1)
  expiresInHours?: number;
}

export class RequestPatientOtpDto {
  @ApiProperty()
  @IsString()
  phone!: string;

  @ApiPropertyOptional({ description: 'Patient MRN (when phone is ambiguous)' })
  @IsOptional()
  @IsString()
  mrn?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  dateOfBirth?: string;
}

export class VerifyPatientOtpDto {
  @ApiProperty()
  @IsString()
  challengeId!: string;

  @ApiProperty()
  @IsString()
  code!: string;
}

export class PublicSubmitFormDto {
  @ApiProperty()
  @IsObject()
  dataJson!: Record<string, unknown>;

  @ApiPropertyOptional({
    description: 'Short-lived proof returned by the OTP verification step',
  })
  @IsOptional()
  @IsString()
  patientProof?: string;
}

export class ShareFormLinkDto {
  @ApiProperty()
  @IsString()
  formDefinitionId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  submissionId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  patientId?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  channels?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  email?: string;
}

export class DispatchFormNotificationDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  submissionId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  formDefinitionId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  eventKey?: string;

  @ApiPropertyOptional({ enum: ['a4_print', 'pos_print'] })
  @IsOptional()
  @IsIn(['a4_print', 'pos_print'])
  printFormat?: 'a4_print' | 'pos_print';

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  recipients?: { phone?: string | null; email?: string | null };

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  context?: Record<string, unknown>;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  channels?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  subject?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  message?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  html?: string;
}
