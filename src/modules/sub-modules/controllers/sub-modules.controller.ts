import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
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
  CreateSubModuleDto,
  UpdateSubModuleDto,
} from '../dto/sub-module.dto';
import { SubModulesService } from '../services/sub-modules.service';

@ApiTags('sub-modules')
@Controller('sub-modules')
export class SubModulesController {
  constructor(private readonly service: SubModulesService) {}

  @Get()
  @ApiOperation({ summary: 'List EMR sub-modules' })
  async list(
    @Query() query: ListQueryDto,
    @CurrentUser() user: RequestUser,
  ) {
    const result = await this.service.list(query, tenantFromUser(user));
    return {
      data: result.data,
      meta: { page: query.page, limit: query.limit, total: result.total },
    };
  }

  @Get('navigation')
  @ApiOperation({
    summary: 'Menu tree of active sub-modules, features and their forms',
  })
  navigation(@CurrentUser() user: RequestUser) {
    return this.service.navigation(tenantFromUser(user));
  }

  @Get('role-options')
  @ApiOperation({ summary: 'Identity roles available for feature access' })
  roleOptions(
    @CurrentUser() user: RequestUser,
    @Headers('authorization') authorization?: string,
  ) {
    const token = authorization?.replace(/^Bearer\s+/i, '');
    return this.service.roleOptions(token, user.organizationId ?? null);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a sub-module with its features' })
  get(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.service.get(id, tenantFromUser(user));
  }

  @Post()
  @ApiOperation({ summary: 'Create a sub-module' })
  create(@Body() dto: CreateSubModuleDto, @CurrentUser() user: RequestUser) {
    return this.service.create(dto, tenantFromUser(user), user);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a sub-module' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateSubModuleDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.service.update(id, dto, tenantFromUser(user));
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Archive a sub-module' })
  remove(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.service.remove(id, tenantFromUser(user));
  }
}
