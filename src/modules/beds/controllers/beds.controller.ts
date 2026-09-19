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
import { BedsService } from '../services/beds.service';
import { CreateBedDto, UpdateBedDto } from '../dto/bed.dto';
import { ListQueryDto } from '../../../shared/dto/list-query.dto';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import type { RequestUser } from '../../../common/decorators/current-user.decorator';
import { tenantFromUser } from '../../../common/tenant-context';
import { BED_STATUSES, type BedStatus } from '../../../shared/domain/enums';

@ApiTags('beds')
@Controller('beds')
export class BedsController {
  constructor(private readonly service: BedsService) {}

  @Get()
  @ApiOperation({ summary: 'List beds with ward/status filters' })
  async list(
    @Query()
    query: ListQueryDto & {
      wardId?: string;
      status?: string;
      bedType?: string;
    },
    @CurrentUser() user: RequestUser,
  ) {
    const result = await this.service.list(query, tenantFromUser(user));
    return {
      data: result.data,
      meta: { page: query.page, limit: query.limit, total: result.total },
    };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get bed by id' })
  get(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.service.get(id, tenantFromUser(user));
  }

  @Post()
  @ApiOperation({ summary: 'Create a bed in a ward' })
  create(@Body() dto: CreateBedDto, @CurrentUser() user: RequestUser) {
    return this.service.create(dto, tenantFromUser(user));
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a bed' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateBedDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.service.update(id, dto, tenantFromUser(user));
  }

  @Patch(':id/status')
  @ApiOperation({
    summary: 'Set bed status directly (maintenance/out-of-service)',
  })
  setStatus(
    @Param('id') id: string,
    @Body() dto: { status: BedStatus },
    @CurrentUser() user: RequestUser,
  ) {
    return this.service.setStatus(id, dto.status, tenantFromUser(user));
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Archive a bed' })
  async remove(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.service.remove(id, tenantFromUser(user));
  }
}

export { BED_STATUSES };
