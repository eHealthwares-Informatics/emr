import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { RequestUser } from '../../common/decorators/current-user.decorator';
import { PrintsService } from './prints.service';

const FALLBACK_ORG = '00000000-0000-0000-0000-000000000000';

@ApiTags('prints')
@ApiBearerAuth()
@Controller('prints')
export class PrintsController {
  constructor(private readonly prints: PrintsService) {}

  @Get()
  @ApiOperation({ summary: 'List cached prints' })
  list(
    @CurrentUser() user: RequestUser,
    @Query('resourceType') resourceType?: string,
    @Query('resourceId') resourceId?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.prints.list(this.organizationId(user), {
      resourceType,
      resourceId,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    });
  }

  private organizationId(user: RequestUser): string {
    return user.organizationId ?? FALLBACK_ORG;
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a cached print record' })
  get(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.prints.findById(id, this.organizationId(user));
  }

  @Post(':id/upload/cloudinary')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Manually upload a cached print to Cloudinary' })
  uploadCloudinary(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.prints.uploadNow(id, this.organizationId(user), 'cloudinary');
  }

  @Post(':id/upload/s3')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Manually upload a cached print to S3' })
  uploadS3(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.prints.uploadNow(id, this.organizationId(user), 's3');
  }

  @Post(':id/upload')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Manually upload a cached print to both Cloudinary and S3',
  })
  uploadBoth(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.prints.uploadNow(id, this.organizationId(user), 'both');
  }
}
