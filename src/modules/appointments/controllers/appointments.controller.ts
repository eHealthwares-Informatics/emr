import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { AppointmentsService } from '../services/appointments.service';
import {
  CancelAppointmentDto,
  CheckInAppointmentDto,
  CreateAppointmentDto,
  RescheduleAppointmentDto,
  UpdateAppointmentDto,
} from '../dto/appointment.dto';
import { ListQueryDto } from '../../../shared/dto/list-query.dto';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import type { RequestUser } from '../../../common/decorators/current-user.decorator';
import { tenantFromUser } from '../../../common/tenant-context';
import { PdfService } from '../../pdf/pdf.service';

@ApiTags('appointments')
@Controller('appointments')
export class AppointmentsController {
  constructor(
    private readonly service: AppointmentsService,
    private readonly pdf: PdfService,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'List appointments with pagination, date/status filters',
  })
  async list(
    @Query()
    query: ListQueryDto & {
      status?: string;
      date?: string;
      providerId?: string;
      patientId?: string;
      patientName?: string;
      createdAt?: string;
    },
    @CurrentUser() user: RequestUser,
  ) {
    const result = await this.service.list(query, tenantFromUser(user));
    return {
      data: result.data,
      meta: { page: query.page, limit: query.limit, total: result.total },
    };
  }

  @Get(':id/pdf')
  @ApiOperation({ summary: 'Print an appointment slip (PDF)' })
  async print(
    @Param('id') id: string,
    @CurrentUser() user: RequestUser,
    @Res() res: Response,
  ) {
    const appointment = await this.service.get(id, tenantFromUser(user));
    const row = (label: string, value: unknown): string =>
      `<tr><td style="padding:6px 12px;border:1px solid #ddd;background:#f5f7fa;font-weight:600;width:180px">${label}</td><td style="padding:6px 12px;border:1px solid #ddd">${String(value ?? '—')}</td></tr>`;
    const html = `<div style="font-family:Helvetica,Arial,sans-serif;max-width:720px;margin:0 auto">
      <h2 style="margin-bottom:4px">Appointment Slip</h2>
      <p style="margin-top:0;color:#555">${appointment.appointmentNumber}</p>
      <h3>${appointment.patientName || appointment.patientId}</h3>
      <table style="border-collapse:collapse;width:100%;font-size:13px">
        ${row('MRN', appointment.patientId)}
        ${row('Appointment type', appointment.appointmentType)}
        ${row('Date', appointment.date)}
        ${row('Start time', appointment.startTime)}
        ${row('End time', appointment.endTime)}
        ${row('Provider', appointment.providerName)}
        ${row('Priority', appointment.priority)}
        ${row('Status', appointment.status)}
        ${row('Reason', appointment.reason)}
        ${row('Notes', appointment.notes)}
      </table>
    </div>`;
    const buffer = await this.pdf.renderHtml(html);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="appointment-${appointment.appointmentNumber}.pdf"`,
      'Content-Length': String(buffer.length),
    });
    res.send(buffer);
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

  @Post(':id/reschedule')
  @ApiOperation({ summary: 'Reschedule an appointment to a new date/time' })
  reschedule(
    @Param('id') id: string,
    @Body() dto: RescheduleAppointmentDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.service.reschedule(id, dto, tenantFromUser(user));
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
