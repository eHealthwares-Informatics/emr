import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request as ExpressRequest } from 'express';
import { RequestsService } from '../services/requests.service';
import {
  AddRequestNoteDto,
  CreateRequestDto,
  SyncRequestDto,
  TransitionRequestStatusDto,
  UpdateRequestDto,
} from '../dto/request.dto';
import { ListQueryDto } from '../../../shared/dto/list-query.dto';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import type { RequestUser } from '../../../common/decorators/current-user.decorator';
import { tenantFromUser } from '../../../common/tenant-context';

function extractToken(req: ExpressRequest): string | undefined {
  const header = req.headers?.authorization;
  if (header?.startsWith('Bearer ')) {
    return header.slice('Bearer '.length);
  }
  return undefined;
}

@ApiTags('requests')
@Controller('requests')
export class RequestsController {
  constructor(private readonly service: RequestsService) {}

  @Get()
  @ApiOperation({ summary: 'List clinical requests with filters' })
  async list(
    @Query()
    query: ListQueryDto & {
      status?: string;
      requestType?: string;
      patientId?: string;
      visitId?: string;
      encounterId?: string;
      providerId?: string;
    },
    @CurrentUser() user: RequestUser,
  ) {
    const result = await this.service.list(query, tenantFromUser(user));
    return { data: result.data, meta: { page: query.page, limit: query.limit, total: result.total } };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get request by id with items' })
  get(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.service.get(id, tenantFromUser(user));
  }

  @Get(':id/history')
  @ApiOperation({ summary: 'Get request status history only (lightweight)' })
  getHistory(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.service.getHistory(id, tenantFromUser(user));
  }

  @Post()
  @ApiOperation({ summary: 'Create a request (optionally external-synced to LIS/pharmacy)' })
  create(
    @Body() dto: CreateRequestDto,
    @CurrentUser() user: RequestUser,
    @Req() req: ExpressRequest,
  ) {
    return this.service.create(dto, tenantFromUser(user), user, extractToken(req));
  }

  @Post(':id/transition')
  @ApiOperation({ summary: 'Transition request status' })
  transition(
    @Param('id') id: string,
    @Body() dto: TransitionRequestStatusDto,
    @CurrentUser() user: RequestUser,
    @Req() req: ExpressRequest,
  ) {
    return this.service.transition(id, dto, tenantFromUser(user), user, extractToken(req));
  }

  @Post(':id/note')
  @ApiOperation({ summary: 'Append a free-text note to the request timeline' })
  addNote(
    @Param('id') id: string,
    @Body() dto: AddRequestNoteDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.service.addNote(id, dto.note, tenantFromUser(user), user);
  }

  @Post(':id/sync')
  @ApiOperation({ summary: 'Manually re-sync request to external system' })
  sync(
    @Param('id') id: string,
    @Body() dto: SyncRequestDto,
    @CurrentUser() user: RequestUser,
    @Req() req: ExpressRequest,
  ) {
    return this.service.sync(id, dto, tenantFromUser(user), extractToken(req));
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update an open request' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateRequestDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.service.update(id, dto, tenantFromUser(user));
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Archive a request' })
  async remove(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.service.remove(id, tenantFromUser(user));
  }
}
