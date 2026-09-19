import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { WARD_TYPES, type WardType } from '../../../shared/domain/enums';

export class CreateWardDto {
  @ApiProperty({ description: 'Short unique code, e.g. W3A' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  code!: string;

  @ApiProperty({ description: 'Ward display name' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  name!: string;

  @ApiPropertyOptional({ enum: WARD_TYPES, default: 'GENERAL' })
  @IsIn(WARD_TYPES)
  @IsOptional()
  wardType?: WardType;

  @ApiPropertyOptional({ description: 'Owning EMR department id' })
  @IsString()
  @IsOptional()
  departmentId?: string;

  @ApiPropertyOptional({ description: 'Friendly department type label' })
  @IsString()
  @IsOptional()
  departmentType?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ default: true })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export class UpdateWardDto {
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  @MaxLength(20)
  code?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  @MaxLength(160)
  name?: string;

  @ApiPropertyOptional({ enum: WARD_TYPES })
  @IsIn(WARD_TYPES)
  @IsOptional()
  wardType?: WardType;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  departmentId?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  departmentType?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
