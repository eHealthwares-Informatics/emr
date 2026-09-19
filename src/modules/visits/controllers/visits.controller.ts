import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { VisitsService } from '../services/visits.service';
import { CreateVisitDto, EndVisitDto, UpdateVisitDto } from '../dto/visit.dto';
import { ListQueryDto } from '../../../shared/dto/list-query.dto';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import type { RequestUser } from '../../../common/decorators/current-user.decorator';
import { tenantFromUser } from '../../../common/tenant-context';

@ApiTags('visits')
@Controller('visits')
export class VisitsController {
  constructor(private readonly service: VisitsService) {}

  @Get()
  @ApiOperation({
    summary: 'List visits with pagination and status/provider filters',
  })
  async list(
    @Query()
    query: ListQueryDto & {
      status?: string;
      providerId?: string;
      patientId?: string;
    },
    @CurrentUser() user: RequestUser,
  ) {
    const result = await this.service.list(query, tenantFromUser(user));
    return {
      data: result.data,
      meta: { page: query.page, limit: query.limit, total: result.total },
    };
  }

  @Get('active')
  @ApiOperation({ summary: 'List active (ongoing) visits' })
  async active(@CurrentUser() user: RequestUser) {
    const result = await this.service.active(tenantFromUser(user));
    return {
      data: result.data,
      meta: { page: 1, limit: result.data.length, total: result.total },
    };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get visit by id' })
  get(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.service.get(id, tenantFromUser(user));
  }

  @Post()
  @ApiOperation({ summary: 'Start a new visit' })
  create(@Body() dto: CreateVisitDto, @CurrentUser() user: RequestUser) {
    return this.service.create(dto, tenantFromUser(user), user);
  }

  @Post(':id/end')
  @ApiOperation({ summary: 'End an ongoing visit' })
  end(
    @Param('id') id: string,
    @Body() dto: EndVisitDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.service.end(id, dto, tenantFromUser(user));
  }

  @Post(':id/cancel')
  @ApiOperation({ summary: 'Cancel an ongoing visit' })
  cancel(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.service.cancel(id, tenantFromUser(user));
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a visit' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateVisitDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.service.update(id, dto, tenantFromUser(user));
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Archive a visit' })
  async remove(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.service.remove(id, tenantFromUser(user));
  }
}
