import { Body, Controller, Param, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import type { RequestUser } from '../../../common/decorators/current-user.decorator';
import { tenantFromUser } from '../../../common/tenant-context';
import {
  CreateFormShareLinkDto,
  RequestPatientOtpDto,
  VerifyPatientOtpDto,
} from '../dto/share.dto';
import { FormShareLinksService } from '../services/form-share-links.service';
import { PatientOtpService } from '../services/patient-otp.service';

@ApiTags('form-share-links')
@Controller()
export class FormShareLinksController {
  constructor(
    private readonly shareLinks: FormShareLinksService,
    private readonly otp: PatientOtpService,
  ) {}

  @Post('form-definitions/:id/share-links')
  @ApiOperation({ summary: 'Create a public form link (template or instance)' })
  create(
    @Param('id') id: string,
    @Body() dto: CreateFormShareLinkDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.shareLinks.create(id, dto, tenantFromUser(user), user);
  }

  @Post('patient-auth/otp')
  @ApiOperation({ summary: 'Send an OTP to a patient phone number' })
  requestOtp(
    @Body() dto: RequestPatientOtpDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.otp.requestOtp(dto, tenantFromUser(user), user);
  }

  @Post('patient-auth/otp/verify')
  @ApiOperation({ summary: 'Verify a patient OTP' })
  verifyOtp(
    @Body() dto: VerifyPatientOtpDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.otp.verifyOtp(dto, tenantFromUser(user));
  }

  @Post('patient-auth/verify')
  @ApiOperation({
    summary: 'Verify a patient with phone + MRN/date of birth (no OTP)',
  })
  verifyIdentity(
    @Body() dto: RequestPatientOtpDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.otp.verifyIdentity(dto, tenantFromUser(user));
  }
}
