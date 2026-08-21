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
import { EncountersService } from '../services/encounters.service';
import {
  CreateEncounterDto,
  CreateEncounterRequestDto,
  UpdateEncounterDto,
} from '../dto/encounter.dto';
import { ListQueryDto } from '../../../shared/dto/list-query.dto';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import type { RequestUser } from '../../../common/decorators/current-user.decorator';
import { tenantFromUser } from '../../../common/tenant-context';

@ApiTags('encounters')
@Controller('encounters')
export class EncountersController {
  constructor(private readonly service: EncountersService) {}

  @Get()
  @ApiOperation({ summary: 'List encounters with patient/visit filters' })
  async list(
    @Query() query: ListQueryDto & { patientId?: string; visitId?: string; encounterType?: string },
    @CurrentUser() user: RequestUser,
  ) {
    const result = await this.service.list(query, tenantFromUser(user));
    return { data: result.data, meta: { page: query.page, limit: query.limit, total: result.total } };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get encounter by id' })
  get(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.service.get(id, tenantFromUser(user));
  }

  @Post()
  @ApiOperation({ summary: 'Create an encounter (optionally linked to a visit)' })
  create(@Body() dto: CreateEncounterDto, @CurrentUser() user: RequestUser) {
    return this.service.create(dto, tenantFromUser(user), user);
  }

  @Post(':id/requests')
  @ApiOperation({ summary: 'Create a request from an encounter context' })
  createRequest(
    @Param('id') id: string,
    @Body() dto: CreateEncounterRequestDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.service.createRequest(id, dto, tenantFromUser(user), user);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update an encounter' })
  update(@Param('id') id: string, @Body() dto: UpdateEncounterDto, @CurrentUser() user: RequestUser) {
    return this.service.update(id, dto, tenantFromUser(user));
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Archive an encounter' })
  async remove(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.service.remove(id, tenantFromUser(user));
  }
}
