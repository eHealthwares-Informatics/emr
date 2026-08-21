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
import { FormDefinitionsService } from '../services/form-definitions.service';
import {
  CreateFormDefinitionDto,
  PublishFormDto,
  UpdateFormDefinitionDto,
} from '../dto/form.dto';
import { ListQueryDto } from '../../../shared/dto/list-query.dto';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import type { RequestUser } from '../../../common/decorators/current-user.decorator';
import { tenantFromUser } from '../../../common/tenant-context';

@ApiTags('form-definitions')
@Controller('form-definitions')
export class FormDefinitionsController {
  constructor(private readonly service: FormDefinitionsService) {}

  @Get()
  @ApiOperation({ summary: 'List form definitions' })
  async list(
    @Query() query: ListQueryDto & { category?: string; published?: string },
    @CurrentUser() user: RequestUser,
  ) {
    const result = await this.service.list(query, tenantFromUser(user));
    return { data: result.data, meta: { page: query.page, limit: query.limit, total: result.total } };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get form definition by id' })
  get(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.service.get(id, tenantFromUser(user));
  }

  @Post()
  @ApiOperation({ summary: 'Create a form definition (draft)' })
  create(@Body() dto: CreateFormDefinitionDto, @CurrentUser() user: RequestUser) {
    return this.service.create(dto, tenantFromUser(user), user);
  }

  @Post(':id/publish')
  @ApiOperation({ summary: 'Publish a form definition' })
  publish(@Param('id') id: string, @Body() _dto: PublishFormDto, @CurrentUser() user: RequestUser) {
    return this.service.publish(id, tenantFromUser(user));
  }

  @Post(':id/unpublish')
  @ApiOperation({ summary: 'Unpublish a form definition' })
  unpublish(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.service.unpublish(id, tenantFromUser(user));
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a form definition (bumps version when schema changes)' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateFormDefinitionDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.service.update(id, dto, tenantFromUser(user));
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Archive a form definition' })
  async remove(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.service.remove(id, tenantFromUser(user));
  }
}
