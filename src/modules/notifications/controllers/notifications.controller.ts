import { Controller, Get, Param, Patch, Put, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { NotificationsService } from '../services/notifications.service';
import { ListNotificationsQueryDto } from '../dto/notification.dto';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import type { RequestUser } from '../../../common/decorators/current-user.decorator';
import { tenantFromUser } from '../../../common/tenant-context';

@ApiTags('notifications')
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly service: NotificationsService) {}

  @Get()
  @ApiOperation({
    summary:
      'List in-app notifications for the current user (poll with ?since=)',
  })
  async list(
    @Query() query: ListNotificationsQueryDto,
    @CurrentUser() user: RequestUser,
  ) {
    const result = await this.service.list(query, tenantFromUser(user), user);
    return {
      data: result.data,
      meta: { page: query.page, limit: query.limit, total: result.total },
    };
  }

  @Get('unread-count')
  @ApiOperation({
    summary: 'Count unread in-app notifications for the current user',
  })
  unreadCount(@CurrentUser() user: RequestUser) {
    return this.service.unreadCount(tenantFromUser(user), user);
  }

  @Patch('read-all')
  @ApiOperation({
    summary: 'Mark all of the current user notifications as read',
  })
  readAll(@CurrentUser() user: RequestUser) {
    return this.service.markAllRead(tenantFromUser(user), user);
  }

  @Put(':id/read')
  @ApiOperation({ summary: 'Mark a single notification as read' })
  markRead(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.service.markRead(id, tenantFromUser(user), user);
  }
}
