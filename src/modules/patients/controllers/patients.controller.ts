import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { PatientsService } from '../services/patients.service';
import { CreatePatientDto, UpdatePatientDto } from '../dto/patient.dto';
import { AssignPatientTagsDto } from '../../tags/dto/tag.dto';
import { ListQueryDto } from '../../../shared/dto/list-query.dto';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import type { RequestUser } from '../../../common/decorators/current-user.decorator';
import { tenantFromUser } from '../../../common/tenant-context';

@ApiTags('patients')
@Controller('patients')
export class PatientsController {
  constructor(private readonly service: PatientsService) {}

  @Get()
  @ApiOperation({ summary: 'List patients with pagination and search' })
  async list(
    @Query() query: ListQueryDto & { gender?: string; isActive?: string },
    @CurrentUser() user: RequestUser,
  ) {
    const result = await this.service.list(query, tenantFromUser(user));
    return {
      data: result.data,
      meta: { page: query.page, limit: query.limit, total: result.total },
    };
  }

  @Get('by-mrn/:patientId')
  @ApiOperation({ summary: 'Get patient by MRN (patientId)' })
  getByMrn(
    @Param('patientId') patientId: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.service.getByPatientId(patientId, tenantFromUser(user));
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get patient by id' })
  get(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.service.get(id, tenantFromUser(user));
  }

  @Get(':id/tags')
  @ApiOperation({ summary: "List a patient's tags" })
  getTags(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.service.getTags(id, tenantFromUser(user));
  }

  @Put(':id/tags')
  @ApiOperation({ summary: "Replace a patient's tag set" })
  assignTags(
    @Param('id') id: string,
    @Body() dto: AssignPatientTagsDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.service.assignTags(id, dto.tagIds ?? [], tenantFromUser(user));
  }

  @Post()
  @ApiOperation({ summary: 'Register a new patient' })
  create(@Body() dto: CreatePatientDto, @CurrentUser() user: RequestUser) {
    return this.service.create(dto, tenantFromUser(user), user);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a patient' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdatePatientDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.service.update(id, dto, tenantFromUser(user), user);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Archive a patient' })
  async remove(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.service.remove(id, tenantFromUser(user));
  }
}
