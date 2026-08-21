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
import { StaffService } from '../services/staff.service';
import { CreateStaffDto, UpdateStaffDto } from '../dto/staff.dto';
import { ListQueryDto } from '../../../shared/dto/list-query.dto';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import type { RequestUser } from '../../../common/decorators/current-user.decorator';
import { tenantFromUser } from '../../../common/tenant-context';

@ApiTags('staff')
@Controller('staff')
export class StaffController {
  constructor(private readonly service: StaffService) {}

  @Get()
  @ApiOperation({ summary: 'List staff with search and role/category/department filters' })
  async list(
    @Query()
    query: ListQueryDto & {
      roleType?: string;
      category?: string;
      department?: string;
      isActive?: string;
    },
    @CurrentUser() user: RequestUser,
  ) {
    const result = await this.service.list(query, tenantFromUser(user));
    return { data: result.data, meta: { page: query.page, limit: query.limit, total: result.total } };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get staff member by id' })
  get(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.service.get(id, tenantFromUser(user));
  }

  @Post()
  @ApiOperation({ summary: 'Register a staff member (optionally linked to an identity user)' })
  create(@Body() dto: CreateStaffDto, @CurrentUser() user: RequestUser) {
    return this.service.create(dto, tenantFromUser(user));
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a staff member' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateStaffDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.service.update(id, dto, tenantFromUser(user));
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Archive a staff member' })
  async remove(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.service.remove(id, tenantFromUser(user));
  }
}
