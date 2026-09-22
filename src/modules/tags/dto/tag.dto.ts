import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

const HEX_COLOR = /^#(?:[0-9A-Fa-f]{3}|[0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})$/;

export class CreateTagDto {
  @ApiPropertyOptional({ description: 'Tag name (unique per organization)' })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name!: string;

  @ApiPropertyOptional({ description: 'Hex color for chips (e.g. #e64980)' })
  @IsOptional()
  @Matches(HEX_COLOR, { message: 'color must be a hex value like #e64980' })
  color?: string;
}

export class UpdateTagDto {
  @ApiPropertyOptional({ description: 'Tag name (unique per organization)' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional({ description: 'Hex color for chips (e.g. #e64980)' })
  @IsOptional()
  @Matches(HEX_COLOR, { message: 'color must be a hex value like #e64980' })
  color?: string;
}

export class AssignPatientTagsDto {
  @ApiPropertyOptional({
    description: 'Full set of tag ids for the patient (replaces the current set)',
  })
  @IsArray()
  @IsUUID('4', { each: true })
  tagIds!: string[];
}
