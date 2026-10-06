import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayNotEmpty,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import {
  MESSAGE_CONTENT_TYPES,
  MESSAGE_DESTINATIONS,
  MESSAGE_TEMPLATE_STATUSES,
} from '../../../shared/domain/enums';
import type {
  MessageContentType,
  MessageDestination,
  MessageTemplateStatus,
} from '../../../shared/domain/enums';

export class CreateMessageTemplateDto {
  @ApiProperty({ description: 'Unique template code, e.g. request_created' })
  @IsString()
  @MinLength(1)
  @MaxLength(150)
  code!: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ enum: MESSAGE_CONTENT_TYPES, default: 'free_text' })
  @IsIn(MESSAGE_CONTENT_TYPES)
  contentType!: MessageContentType;

  @ApiProperty()
  @IsString()
  content!: string;

  @ApiPropertyOptional({
    description: 'Required/enforced when contentType is limited_text',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  maxCharacters?: number;

  @ApiProperty({ enum: MESSAGE_DESTINATIONS, isArray: true })
  @IsArray()
  @ArrayNotEmpty()
  @IsIn(MESSAGE_DESTINATIONS, { each: true })
  destinations!: MessageDestination[];

  @ApiPropertyOptional({ isArray: true, type: String })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  channelCodes?: string[];

  @ApiPropertyOptional({ default: 3 })
  @IsOptional()
  @IsInt()
  @Min(0)
  heartbeatRetries?: number;

  @ApiPropertyOptional({ default: 30 })
  @IsOptional()
  @IsInt()
  @Min(1)
  heartbeatIntervalSeconds?: number;

  @ApiPropertyOptional({ default: 86400 })
  @IsOptional()
  @IsInt()
  @Min(1)
  heartbeatExpirySeconds?: number;

  @ApiProperty({ enum: MESSAGE_TEMPLATE_STATUSES, default: 'draft' })
  @IsIn(MESSAGE_TEMPLATE_STATUSES)
  status!: MessageTemplateStatus;
}

export class UpdateMessageTemplateDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ enum: MESSAGE_CONTENT_TYPES })
  @IsOptional()
  @IsIn(MESSAGE_CONTENT_TYPES)
  contentType?: MessageContentType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  content?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  maxCharacters?: number | null;

  @ApiPropertyOptional({ enum: MESSAGE_DESTINATIONS, isArray: true })
  @IsOptional()
  @IsArray()
  @IsIn(MESSAGE_DESTINATIONS, { each: true })
  destinations?: MessageDestination[];

  @ApiPropertyOptional({ isArray: true, type: String })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  channelCodes?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  heartbeatRetries?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  heartbeatIntervalSeconds?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  heartbeatExpirySeconds?: number;

  @ApiPropertyOptional({ enum: MESSAGE_TEMPLATE_STATUSES })
  @IsOptional()
  @IsIn(MESSAGE_TEMPLATE_STATUSES)
  status?: MessageTemplateStatus;
}
