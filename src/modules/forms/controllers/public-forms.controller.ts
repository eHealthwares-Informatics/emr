import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../../../common/decorators/public.decorator';
import {
  PublicSubmitFormDto,
  RequestPatientOtpDto,
  VerifyPatientOtpDto,
} from '../dto/share.dto';
import { PublicFormsService } from '../services/public-forms.service';

@ApiTags('public-forms')
@Controller('public/forms')
export class PublicFormsController {
  constructor(private readonly service: PublicFormsService) {}

  @Public()
  @Get(':token')
  @ApiOperation({ summary: 'Load a public form link and its current values' })
  get(@Param('token') token: string) {
    return this.service.get(token);
  }

  @Public()
  @Post(':token/submissions')
  @ApiOperation({ summary: 'Submit or amend a public form' })
  submit(@Param('token') token: string, @Body() dto: PublicSubmitFormDto) {
    return this.service.submit(token, dto);
  }

  @Public()
  @Post(':token/otp')
  @ApiOperation({ summary: 'Send an OTP for a public form' })
  requestOtp(
    @Param('token') token: string,
    @Body() dto: RequestPatientOtpDto,
  ) {
    return this.service.requestOtp(token, dto);
  }

  @Public()
  @Post(':token/otp/verify')
  @ApiOperation({ summary: 'Verify an OTP for a public form' })
  verifyOtp(
    @Param('token') token: string,
    @Body() dto: VerifyPatientOtpDto,
  ) {
    return this.service.verifyOtp(token, dto);
  }

  @Public()
  @Post(':token/verify')
  @ApiOperation({ summary: 'Verify a patient by phone + MRN/DOB' })
  verifyIdentity(
    @Param('token') token: string,
    @Body() dto: RequestPatientOtpDto,
  ) {
    return this.service.verifyIdentity(token, dto);
  }
}
