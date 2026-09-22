import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateVisitCommentDto {
  @ApiPropertyOptional({ description: 'Comment text' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(5000)
  comment!: string;

  @ApiPropertyOptional({ description: 'Display name of the author' })
  @IsString()
  @IsOptional()
  authorName?: string;
}
