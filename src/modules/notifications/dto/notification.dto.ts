import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsString, IsUUID } from 'class-validator';
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

  /**
   * Accepted for client compatibility (web/mobile may echo JWT tenant ids).
   * The service always resolves org/location from the JWT via `tenantFromUser`;
   * body values are ignored so clients cannot claim another tenant.
   */
  @ApiPropertyOptional({
    description:
      'Optional org id (ignored — tenant comes from the JWT). Accepted so whitelist validation does not reject clients that echo it.',
  })
  @IsOptional()
  @IsUUID()
  organizationId?: string;

  @ApiPropertyOptional({
    description:
      'Optional location id (ignored — tenant comes from the JWT). Accepted so whitelist validation does not reject clients that echo it.',
  })
  @IsOptional()
  @IsString()
  locationId?: string;
}
