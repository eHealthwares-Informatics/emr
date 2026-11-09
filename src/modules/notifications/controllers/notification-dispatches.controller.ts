import { Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import type { RequestUser } from '../../../common/decorators/current-user.decorator';
import { tenantFromUser } from '../../../common/tenant-context';
import { NotificationDispatchService } from '../services/notification-dispatch.service';

/**
 * EMR sender-app notification ledger.
 *
 * Every event EMR hands to the conversation engine is recorded here; the list
 * shows what was sent, and `POST :id/retrigger` replays the stored payload.
 */
@ApiTags('notifications')
@Controller('notifications/dispatches')
export class NotificationDispatchesController {
  constructor(private readonly service: NotificationDispatchService) {}

  @Get()
  @ApiOperation({
    summary:
      'List notification dispatches emitted by EMR (sender-app ledger)',
  })
  async list(
    @Query('eventKey') eventKey: string | undefined,
    @Query('status') status: string | undefined,
    @Query('source') source: string | undefined,
    @Query('relatedEntityId') relatedEntityId: string | undefined,
    @Query('search') search: string | undefined,
    @Query('page') page: string | undefined,
    @Query('limit') limit: string | undefined,
    @Query('sortBy') sortBy: string | undefined,
    @Query('sortOrder') sortOrder: 'asc' | 'desc' | undefined,
    @CurrentUser() user: RequestUser,
  ) {
    const result = await this.service.list(
      {
        eventKey,
        status,
        source,
        relatedEntityId,
        search,
        page: page ? Number(page) : undefined,
        limit: limit ? Number(limit) : undefined,
        sortBy,
        sortOrder,
      },
      tenantFromUser(user),
      user,
    );
    return {
      data: result.data,
      meta: {
        page: Number(page ?? 1),
        limit: Number(limit ?? 25),
        total: result.total,
      },
    };
  }

  @Post(':id/retrigger')
  @ApiOperation({ summary: 'Re-send a recorded notification dispatch' })
  retrigger(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.service.retrigger(id, tenantFromUser(user), user);
  }
}
