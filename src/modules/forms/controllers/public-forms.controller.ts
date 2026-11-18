import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../../../common/decorators/public.decorator';
import {
  PublicSubmitFormDto,
  RequestPatientOtpDto,
  VerifyPatientOtpDto,
} from '../dto/share.dto';
import { PublicFormsService } from '../services/public-forms.service';
import { FormShareLinksService } from '../services/form-share-links.service';
import {
  assertUpload,
  MAX_UPLOAD_BYTES,
} from '../../uploads/uploads.controller';
import { UploadsService, type UploadedFileInput } from '../../uploads/uploads.service';

@ApiTags('public-forms')
@Controller('public/forms')
export class PublicFormsController {
  constructor(
    private readonly service: PublicFormsService,
    private readonly shareLinks: FormShareLinksService,
    private readonly uploads: UploadsService,
  ) {}

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

  @Public()
  @Post(':token/uploads')
  @ApiOperation({ summary: 'Upload a file for a public form' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: MAX_UPLOAD_BYTES } }),
  )
  async upload(
    @Param('token') token: string,
    @UploadedFile() file: UploadedFileInput,
  ) {
    const link = await this.shareLinks.resolve(token);
    return this.uploads.store(assertUpload(file), link.organizationId);
  }
}
