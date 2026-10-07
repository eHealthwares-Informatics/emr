import { Body, Controller, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { NotificationsService } from '../services/notifications.service';
import { SubscribeNotificationsDto } from '../dto/notification.dto';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import type { RequestUser } from '../../../common/decorators/current-user.decorator';
import { tenantFromUser } from '../../../common/tenant-context';

@ApiTags('notification-subscriptions')
@Controller('notification-subscriptions')
export class NotificationSubscriptionsController {
  constructor(private readonly service: NotificationsService) {}

  @Post()
  @ApiOperation({
    summary:
      "Register/heartbeat the current user's notification subscription for their org + location",
  })
  subscribe(
    @Body() dto: SubscribeNotificationsDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.service.subscribe(dto, tenantFromUser(user), user);
  }
}
