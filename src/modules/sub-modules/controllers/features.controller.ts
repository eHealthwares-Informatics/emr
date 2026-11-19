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
import { ListQueryDto } from '../../../shared/dto/list-query.dto';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import type { RequestUser } from '../../../common/decorators/current-user.decorator';
import { tenantFromUser } from '../../../common/tenant-context';
import {
  CreateFeatureDto,
  StartFeatureSessionDto,
  UpdateFeatureDto,
} from '../dto/feature.dto';
import { FeatureSessionsService } from '../services/feature-sessions.service';
import { FeaturesService } from '../services/features.service';

@ApiTags('features')
@Controller('features')
export class FeaturesController {
  constructor(
    private readonly service: FeaturesService,
    private readonly sessions: FeatureSessionsService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List features (optionally by sub-module)' })
  async list(
    @Query() query: ListQueryDto & { subModuleId?: string; isActive?: string },
    @CurrentUser() user: RequestUser,
  ) {
    const result = await this.service.list(query, tenantFromUser(user));
    return {
      data: result.data,
      meta: { page: query.page, limit: query.limit, total: result.total },
    };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a feature with its form and sub-module' })
  get(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.service.get(id, tenantFromUser(user));
  }

  @Post()
  @ApiOperation({ summary: 'Create a feature (form + configuration)' })
  create(@Body() dto: CreateFeatureDto, @CurrentUser() user: RequestUser) {
    return this.service.create(dto, tenantFromUser(user), user);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a feature' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateFeatureDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.service.update(id, dto, tenantFromUser(user));
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Archive a feature' })
  remove(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.service.remove(id, tenantFromUser(user));
  }

  @Post(':id/sessions')
  @ApiOperation({
    summary:
      'Start a same-day session: ensure appointment, visit/admission and encounter',
  })
  startSession(
    @Param('id') id: string,
    @Body() dto: StartFeatureSessionDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.sessions.start(
      id,
      dto.patientId,
      tenantFromUser(user),
      user,
    );
  }
}
