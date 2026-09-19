import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsDateString,
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
} from 'class-validator';
import {
  STAFF_CATEGORIES,
  STAFF_ROLE_TYPES,
} from '../../../shared/domain/enums';
import type {
  StaffCategory,
  StaffRoleType,
} from '../../../shared/domain/enums';

export class CreateStaffDto {
  @ApiPropertyOptional({ description: 'Auto-generated as STF-xxx if omitted' })
  @IsOptional()
  @IsString()
  staffNumber?: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  firstName!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  lastName!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  otherNames?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  hireDate?: string;

  @ApiProperty({ enum: STAFF_ROLE_TYPES })
  @IsEnum(STAFF_ROLE_TYPES)
  roleType!: StaffRoleType;

  @ApiPropertyOptional({ enum: STAFF_CATEGORIES })
  @IsOptional()
  @IsEnum(STAFF_CATEGORIES)
  category?: StaffCategory;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  department?: string;

  @ApiPropertyOptional({ description: 'EMR department id (departments table)' })
  @IsOptional()
  @IsString()
  departmentId?: string;

  @ApiPropertyOptional({ description: 'Location id in the identity service' })
  @IsOptional()
  @IsString()
  identityLocationId?: string;

  @ApiPropertyOptional({
    description: 'Linked identity-service user id (login)',
  })
  @IsOptional()
  @IsString()
  userId?: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  otherDetails?: Record<string, unknown>;
}

export class UpdateStaffDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  firstName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  lastName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  otherNames?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  hireDate?: string;

  @ApiPropertyOptional({ enum: STAFF_ROLE_TYPES })
  @IsOptional()
  @IsEnum(STAFF_ROLE_TYPES)
  roleType?: StaffRoleType;

  @ApiPropertyOptional({ enum: STAFF_CATEGORIES })
  @IsOptional()
  @IsEnum(STAFF_CATEGORIES)
  category?: StaffCategory;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  department?: string;

  @ApiPropertyOptional({ description: 'EMR department id (departments table)' })
  @IsOptional()
  @IsString()
  departmentId?: string;

  @ApiPropertyOptional({ description: 'Location id in the identity service' })
  @IsOptional()
  @IsString()
  identityLocationId?: string;

  @ApiPropertyOptional({
    description: 'Linked identity-service user id (login)',
  })
  @IsOptional()
  @IsString()
  userId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  otherDetails?: Record<string, unknown>;
}
