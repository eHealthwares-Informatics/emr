import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional } from 'class-validator';
import { ListQueryDto } from '../../../shared/dto/list-query.dto';

export class ListNotificationsQueryDto extends ListQueryDto {
  @ApiPropertyOptional({
    description: 'Only return notifications created after this ISO timestamp',
  })
  @IsOptional()
  @IsDateString()
  since?: string;
}

export class SubscribeNotificationsDto {
  @ApiPropertyOptional({
    description:
      'Optional session expiry (ISO timestamp). When omitted the subscription does not expire.',
  })
  @IsOptional()
  @IsDateString()
  expiresAt?: string;
}
