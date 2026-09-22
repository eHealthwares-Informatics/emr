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
import { AdmissionsService } from '../services/admissions.service';
import {
  AdmitFromVisitDto,
  AdmitPatientDto,
  DischargeDto,
  TransferAdmissionDto,
  UpdateAdmissionDto,
} from '../dto/admission.dto';
import { ListQueryDto } from '../../../shared/dto/list-query.dto';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import type { RequestUser } from '../../../common/decorators/current-user.decorator';
import { tenantFromUser } from '../../../common/tenant-context';

@ApiTags('admissions')
@Controller('admissions')
export class AdmissionsController {
  constructor(private readonly service: AdmissionsService) {}

  @Get()
  @ApiOperation({ summary: 'List admissions with status/ward/patient filters' })
  async list(
    @Query()
    query: ListQueryDto & {
      status?: string;
      admissionType?: string;
      wardId?: string;
      patientId?: string;
      bedId?: string;
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
  @ApiOperation({ summary: 'Get admission by id' })
  get(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.service.get(id, tenantFromUser(user));
  }

  @Post()
  @ApiOperation({
    summary: 'Admit a patient (optionally with a bed allocation)',
  })
  admit(@Body() dto: AdmitPatientDto, @CurrentUser() user: RequestUser) {
    return this.service.admit(dto, tenantFromUser(user), user);
  }

  @Post('from-visit/:visitId')
  @ApiOperation({
    summary: 'Convert an ongoing visit into an inpatient admission',
  })
  admitFromVisit(
    @Param('visitId') visitId: string,
    @Body() dto: AdmitFromVisitDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.service.admitFromVisit(visitId, dto, tenantFromUser(user), user);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update an active admission' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateAdmissionDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.service.update(id, dto, tenantFromUser(user));
  }

  @Post(':id/transfer')
  @ApiOperation({ summary: 'Transfer an admission to another ward/bed' })
  transfer(
    @Param('id') id: string,
    @Body() dto: TransferAdmissionDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.service.transfer(id, dto, tenantFromUser(user));
  }

  @Post(':id/discharge')
  @ApiOperation({ summary: 'Discharge an active admission' })
  discharge(
    @Param('id') id: string,
    @Body() dto: DischargeDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.service.discharge(id, dto, tenantFromUser(user));
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Archive an admission' })
  async remove(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.service.remove(id, tenantFromUser(user));
  }
}
