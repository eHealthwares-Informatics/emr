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
import { FormSubmissionsService } from '../services/form-submissions.service';
import { FormDefinitionsService } from '../services/form-definitions.service';
import { PdfService } from '../../pdf/pdf.service';
import { submissionPdfHtml } from '../pdf/submission-pdf';
import {
  CreateFormSubmissionDto,
  UpdateFormSubmissionDto,
} from '../dto/form.dto';
import { ListQueryDto } from '../../../shared/dto/list-query.dto';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import type { RequestUser } from '../../../common/decorators/current-user.decorator';
import { tenantFromUser } from '../../../common/tenant-context';

@ApiTags('form-submissions')
@Controller('form-submissions')
export class FormSubmissionsController {
  constructor(
    private readonly service: FormSubmissionsService,
    private readonly formDefinitionsService: FormDefinitionsService,
    private readonly pdfService: PdfService,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'List form submissions (filter by patient/visit/encounter/form)',
  })
  async list(
    @Query()
    query: ListQueryDto & {
      patientId?: string;
      visitId?: string;
      encounterId?: string;
      formDefinitionId?: string;
      status?: string;
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
  @ApiOperation({ summary: 'Get form submission by id' })
  get(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.service.get(id, tenantFromUser(user));
  }

  @Get(':id/chain')
  @ApiOperation({
    summary: 'Get the amend chain (original + all amendments) for a submission',
  })
  getChain(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.service.getChain(id, tenantFromUser(user));
  }

  @Get(':id/pdf')
  @ApiOperation({ summary: 'Render a submission as a PDF document' })
  async pdf(
    @Param('id') id: string,
    @CurrentUser() user: RequestUser,
    @Res() res: Response,
  ) {
    const tenant = tenantFromUser(user);
    const submission = await this.service.get(id, tenant);
    const form = submission.formDefinitionId
      ? await this.formDefinitionsService.get(
          submission.formDefinitionId,
          tenant,
        )
      : null;
    const html = submissionPdfHtml(submission, form);
    const buffer = await this.pdfService.renderHtml(html);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="submission-${submission.submissionNumber}.pdf"`,
      'Content-Length': String(buffer.length),
    });
    res.send(buffer);
  }

  @Post()
  @ApiOperation({
    summary: 'Submit (or draft) a form against a patient/encounter',
  })
  create(
    @Body() dto: CreateFormSubmissionDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.service.create(dto, tenantFromUser(user), user);
  }

  @Post(':id/amend')
  @ApiOperation({
    summary: 'Amend a submitted form (creates a new submission)',
  })
  amend(
    @Param('id') id: string,
    @Body() dto: UpdateFormSubmissionDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.service.amend(id, dto, tenantFromUser(user), user);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a draft submission' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateFormSubmissionDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.service.update(id, dto, tenantFromUser(user));
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Archive a form submission' })
  async remove(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.service.remove(id, tenantFromUser(user));
  }
}
