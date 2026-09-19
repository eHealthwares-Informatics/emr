import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import {
  BED_STATUSES,
  BED_TYPES,
  type BedStatus,
  type BedType,
} from '../../../shared/domain/enums';

export class CreateBedDto {
  @ApiProperty({ description: 'Short bed code, e.g. B-101' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  code!: string;

  @ApiProperty({ description: 'Ward the bed belongs to' })
  @IsUUID()
  wardId!: string;

  @ApiPropertyOptional({ enum: BED_TYPES, default: 'STANDARD' })
  @IsIn(BED_TYPES)
  @IsOptional()
  bedType?: BedType;

  @ApiPropertyOptional({ enum: BED_STATUSES, default: 'AVAILABLE' })
  @IsIn(BED_STATUSES)
  @IsOptional()
  status?: BedStatus;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  notes?: string;
}

export class UpdateBedDto {
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  @MaxLength(20)
  code?: string;

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  wardId?: string;

  @ApiPropertyOptional({ enum: BED_TYPES })
  @IsIn(BED_TYPES)
  @IsOptional()
  bedType?: BedType;

  @ApiPropertyOptional({ enum: BED_STATUSES })
  @IsIn(BED_STATUSES)
  @IsOptional()
  status?: BedStatus;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  notes?: string;
}
