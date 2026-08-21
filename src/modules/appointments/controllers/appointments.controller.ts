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
import { AppointmentsService } from '../services/appointments.service';
import {
  CancelAppointmentDto,
  CheckInAppointmentDto,
  CreateAppointmentDto,
  UpdateAppointmentDto,
} from '../dto/appointment.dto';
import { ListQueryDto } from '../../../shared/dto/list-query.dto';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import type { RequestUser } from '../../../common/decorators/current-user.decorator';
import { tenantFromUser } from '../../../common/tenant-context';

@ApiTags('appointments')
@Controller('appointments')
export class AppointmentsController {
  constructor(private readonly service: AppointmentsService) {}

  @Get()
  @ApiOperation({ summary: 'List appointments with pagination, date/status filters' })
  async list(
    @Query() query: ListQueryDto & { status?: string; date?: string; providerId?: string; patientId?: string },
    @CurrentUser() user: RequestUser,
  ) {
    const result = await this.service.list(query, tenantFromUser(user));
    return { data: result.data, meta: { page: query.page, limit: query.limit, total: result.total } };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get appointment by id' })
  get(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.service.get(id, tenantFromUser(user));
  }

  @Post()
  @ApiOperation({ summary: 'Schedule an appointment' })
  create(@Body() dto: CreateAppointmentDto, @CurrentUser() user: RequestUser) {
    return this.service.create(dto, tenantFromUser(user), user);
  }

  @Post(':id/check-in')
  @ApiOperation({ summary: 'Check in appointment and start a visit' })
  checkIn(
    @Param('id') id: string,
    @Body() dto: CheckInAppointmentDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.service.checkIn(id, dto, tenantFromUser(user), user);
  }

  @Post(':id/cancel')
  @ApiOperation({ summary: 'Cancel an appointment' })
  cancel(
    @Param('id') id: string,
    @Body() dto: CancelAppointmentDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.service.cancel(id, dto, tenantFromUser(user));
  }

  @Post(':id/no-show')
  @ApiOperation({ summary: 'Mark appointment as no-show' })
  noShow(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.service.transition(id, 'NO_SHOW', tenantFromUser(user));
  }

  @Post(':id/complete')
  @ApiOperation({ summary: 'Complete an in-progress appointment' })
  complete(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.service.transition(id, 'COMPLETED', tenantFromUser(user));
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update an appointment' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateAppointmentDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.service.update(id, dto, tenantFromUser(user));
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Archive an appointment' })
  async remove(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.service.remove(id, tenantFromUser(user));
  }
}
