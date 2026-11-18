import {
  BadRequestException,
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { RequestUser } from '../../common/decorators/current-user.decorator';
import { tenantFromUser } from '../../common/tenant-context';
import { UploadsService, type UploadedFileInput } from './uploads.service';

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

const ALLOWED_MIME = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain',
  'text/csv',
  'application/dicom',
  'application/zip',
  'application/octet-stream',
]);

export function assertUpload(file?: UploadedFileInput): UploadedFileInput {
  if (!file) {
    throw new BadRequestException('No file received');
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new BadRequestException('File exceeds the 10 MB limit');
  }
  if (!ALLOWED_MIME.has(file.mimetype)) {
    throw new BadRequestException(`Unsupported file type: ${file.mimetype}`);
  }
  return file;
}

@ApiTags('uploads')
@Controller('uploads')
export class UploadsController {
  constructor(private readonly uploads: UploadsService) {}

  @Post()
  @ApiOperation({ summary: 'Upload a file to Cloudinary and S3' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: MAX_UPLOAD_BYTES } }),
  )
  upload(
    @UploadedFile() file: UploadedFileInput,
    @CurrentUser() user: RequestUser,
  ) {
    return this.uploads.store(
      assertUpload(file),
      tenantFromUser(user).organizationId,
    );
  }
}
