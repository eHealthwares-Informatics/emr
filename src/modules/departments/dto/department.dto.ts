import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';
import { DEPARTMENT_TYPES } from '../../../shared/domain/enums';
import type { DepartmentType } from '../../../shared/domain/enums';

export class CreateDepartmentDto {
  @ApiProperty({ example: 'RADIOLOGY' })
  @IsString()
  @IsNotEmpty()
  code!: string;

  @ApiProperty({ example: 'Radiology' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiPropertyOptional({ enum: DEPARTMENT_TYPES, default: 'OPD' })
  @IsOptional()
  @IsEnum(DEPARTMENT_TYPES)
  departmentType?: DepartmentType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    description:
      'Identity location (site) id the department belongs to; defaults to the caller\u2019s location',
  })
  @IsOptional()
  @IsString()
  locationId?: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ description: 'Optional parent department id' })
  @IsOptional()
  @IsUUID()
  parentId?: string | null;
}

export class UpdateDepartmentDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  code?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ enum: DEPARTMENT_TYPES })
  @IsOptional()
  @IsEnum(DEPARTMENT_TYPES)
  departmentType?: DepartmentType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    description: 'Identity location (site) id the department belongs to',
  })
  @IsOptional()
  @IsString()
  locationId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ description: 'Optional parent department id' })
  @IsOptional()
  @IsUUID()
  parentId?: string | null;
}
