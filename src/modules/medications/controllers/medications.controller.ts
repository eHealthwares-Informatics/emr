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
import { MedicationsService } from '../services/medications.service';
import {
  AdministerMedicationDto,
  CreateMedicationDto,
} from '../dto/medication.dto';
import { ListQueryDto } from '../../../shared/dto/list-query.dto';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import type { RequestUser } from '../../../common/decorators/current-user.decorator';
import { tenantFromUser } from '../../../common/tenant-context';

@ApiTags('medications')
@Controller('medications')
export class MedicationsController {
  constructor(private readonly service: MedicationsService) {}

  @Get()
  @ApiOperation({
    summary:
      'List medications (status/patient/request/encounter/administered filters)',
  })
  async list(
    @Query()
    query: ListQueryDto & {
      status?: string;
      patientId?: string;
      requestId?: string;
      encounterId?: string;
      administered?: string;
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
  @ApiOperation({ summary: 'Get medication by id' })
  get(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.service.get(id, tenantFromUser(user));
  }

  @Post()
  @ApiOperation({
    summary: 'Create a medication from a PRESCRIPTION request item (nurse flow)',
  })
  create(@Body() dto: CreateMedicationDto, @CurrentUser() user: RequestUser) {
    return this.service.create(dto, tenantFromUser(user), user);
  }

  @Post(':id/administer')
  @ApiOperation({
    summary:
      'Record administration and complete the originating prescription request',
  })
  administer(
    @Param('id') id: string,
    @Body() dto: AdministerMedicationDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.service.administer(id, dto, tenantFromUser(user), user);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a medication record' })
  update(
    @Param('id') id: string,
    @Body() dto: Record<string, unknown>,
    @CurrentUser() user: RequestUser,
  ) {
    return this.service.update(id, dto, tenantFromUser(user));
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Archive a medication record' })
  remove(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.service.remove(id, tenantFromUser(user));
  }
}
