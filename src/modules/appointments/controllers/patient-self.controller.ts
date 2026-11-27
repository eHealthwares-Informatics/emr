import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  Query,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsISO8601, IsIn, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AppointmentsService } from '../services/appointments.service';
import { PatientIdentityService } from '../../patients/services/patient-identity.service';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import type { RequestUser } from '../../../common/decorators/current-user.decorator';
import { tenantFromUser } from '../../../common/tenant-context';

/**
 * Appointment booking as a patient feature of the app.
 *
 * The patient never supplies a `patientId`: it is resolved from the caller's
 * identity (user id → participant id → phone), so a token pair cannot be used
 * to read or book against someone else's record.
 */
class BookAppointmentDto {
  @ApiProperty({ example: '2026-12-01' })
  @IsISO8601()
  date!: string;

  @ApiProperty({ example: '09:30' })
  @IsString()
  startTime!: string;

  @ApiPropertyOptional({ enum: ['IN_PERSON', 'VIDEO', 'AUDIO'] })
  @IsOptional()
  @IsIn(['IN_PERSON', 'VIDEO', 'AUDIO'])
  modality?: 'IN_PERSON' | 'VIDEO' | 'AUDIO';

  @ApiProperty({ example: 'CONSULTATION' })
  @IsString()
  appointmentType!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reason?: string;

  @ApiPropertyOptional({ example: 'Dr Ada Obi' })
  @IsOptional()
  @IsString()
  providerName?: string;
}

class SetConversationDto {
  @ApiProperty({ example: '6b047d8ff2602eea60a2a8aa' })
  @IsString()
  conversationId!: string;
}

@ApiTags('patient')
@Controller('patient')
export class PatientSelfController {
  constructor(
    private readonly appointments: AppointmentsService,
    private readonly identity: PatientIdentityService,
  ) {}

  @Get('me')
  @ApiOperation({ summary: 'The patient behind the current token' })
  async me(
    @CurrentUser() user: RequestUser,
    @Headers('x-patient-phone') phone?: string,
    @Headers('x-participant-id') participantId?: string,
  ) {
    const patient = await this.resolve(user, phone, participantId);
    return {
      patientId: patient.patientId,
      id: patient.id,
      firstName: patient.firstName,
      lastName: patient.lastName,
      phone: patient.phone,
    };
  }

  @Get('appointments')
  @ApiOperation({ summary: "The caller's own appointments" })
  async list(
    @CurrentUser() user: RequestUser,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Headers('x-patient-phone') phone?: string,
    @Headers('x-participant-id') participantId?: string,
  ) {
    const patient = await this.resolve(user, phone, participantId);
    return this.appointments.list(
      {
        page: page ? Number(page) : 1,
        limit: limit ? Number(limit) : 50,
        patientId: patient.patientId,
        sortBy: 'date',
        sortOrder: 'DESC',
      } as any,
      tenantFromUser(user),
    );
  }

  @Post('appointments')
  @ApiOperation({ summary: 'Book a consultation for the caller' })
  async book(
    @Body() dto: BookAppointmentDto,
    @CurrentUser() user: RequestUser,
    @Headers('x-patient-phone') phone?: string,
    @Headers('x-participant-id') participantId?: string,
  ) {
    const patient = await this.resolve(user, phone, participantId);
    return this.appointments.create(
      {
        patientId: patient.patientId,
        date: dto.date,
        startTime: dto.startTime,
        appointmentType: dto.appointmentType,
        modality: dto.modality,
        reason: dto.reason,
        providerName: dto.providerName,
      } as any,
      tenantFromUser(user),
      user,
    );
  }

  @Post('appointments/:appointmentNumber/conversation')
  @ApiOperation({
    summary: 'Attach the consultation conversation to the caller\'s appointment',
  })
  async setConversation(
    @Param('appointmentNumber') appointmentNumber: string,
    @Body() dto: SetConversationDto,
    @CurrentUser() user: RequestUser,
    @Headers('x-patient-phone') phone?: string,
    @Headers('x-participant-id') participantId?: string,
  ) {
    const patient = await this.resolve(user, phone, participantId);
    return this.appointments.setConversationId(
      appointmentNumber,
      patient.patientId,
      dto.conversationId,
      tenantFromUser(user),
    );
  }

  private resolve(
    user: RequestUser,
    phone?: string,
    participantId?: string,
  ) {
    if (!user?.sub) {
      throw new UnauthorizedException('Sign in to view your appointments');
    }
    return this.identity.resolve(
      { userId: user.sub, phone, participantId },
      tenantFromUser(user),
      user,
    );
  }
}
