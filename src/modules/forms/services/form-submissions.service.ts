import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FormSubmissionOrmEntity } from '../entities/form-submission.orm-entity';
import {
  CreateFormSubmissionDto,
  UpdateFormSubmissionDto,
} from '../dto/form.dto';
import { FormDefinitionsService } from './form-definitions.service';
import { validateFormData } from './schema-validator';
import { TenantContext } from '../../../common/tenant-context';
import type { RequestUser } from '../../../common/decorators/current-user.decorator';
import { ListQueryDto } from '../../../shared/dto/list-query.dto';
import { applySort } from '../../../database/list';
import { generateNumber } from '../../../shared/utils/numbers';

const SORT_ALLOW_LIST = [
  'formName',
  'status',
  'submittedAt',
  'createdAt',
  'updatedAt',
];

@Injectable()
export class FormSubmissionsService {
  constructor(
    @InjectRepository(FormSubmissionOrmEntity)
    private readonly repo: Repository<FormSubmissionOrmEntity>,
    private readonly formDefinitionsService: FormDefinitionsService,
  ) {}

  async list(
    query: ListQueryDto & {
      patientId?: string;
      visitId?: string;
      encounterId?: string;
      formDefinitionId?: string;
      status?: string;
    },
    tenant: TenantContext,
  ) {
    const qb = this.repo
      .createQueryBuilder('submission')
      .where('submission.deleted_at IS NULL');

    if (tenant.organizationId) {
      qb.andWhere(
        '(submission.organization_id = :orgId OR submission.organization_id IS NULL)',
        { orgId: tenant.organizationId },
      );
    }

    if (query.search) {
      qb.andWhere(
        '(submission.form_name ILIKE :search OR submission.patient_id ILIKE :search OR submission.submission_number ILIKE :search)',
        { search: `%${query.search}%` },
      );
    }
    if (query.patientId) {
      qb.andWhere('submission.patient_id = :patientId', {
        patientId: query.patientId,
      });
    }
    if (query.visitId) {
      qb.andWhere('submission.visit_id = :visitId', { visitId: query.visitId });
    }
    if (query.encounterId) {
      qb.andWhere('submission.encounter_id = :encounterId', {
        encounterId: query.encounterId,
      });
    }
    if (query.formDefinitionId) {
      qb.andWhere('submission.form_definition_id = :formDefinitionId', {
        formDefinitionId: query.formDefinitionId,
      });
    }
    if (query.status) {
      qb.andWhere('submission.status = :status', { status: query.status });
    }

    const sortBy = SORT_ALLOW_LIST.includes(query.sortBy)
      ? query.sortBy
      : 'submittedAt';
    applySort(qb, 'submission', sortBy, query.sortOrder);

    const [data, total] = await qb
      .skip(query.offset)
      .take(query.limit)
      .getManyAndCount();
    return { data, total };
  }

  async get(id: string, tenant: TenantContext) {
    return this.findOneScoped(id, tenant);
  }

  /** Full amend chain (original first, then every amendment) for a submission. */
  async getChain(id: string, tenant: TenantContext) {
    // Walk back through amendedFromId links to the original submission.
    let current = await this.findOneScoped(id, tenant);
    const ancestors: FormSubmissionOrmEntity[] = [];
    while (current.amendedFromId) {
      ancestors.push(current);
      current = await this.findOneScoped(current.amendedFromId, tenant);
    }
    const chain: FormSubmissionOrmEntity[] = [current];

    // Breadth-first descendants from the root, so branches and deep chains
    // come back oldest-first.
    const queue = [current.id];
    const seen = new Set<string>([current.id]);
    while (queue.length > 0) {
      const parentId = queue.shift()!;
      const children = await this.findChildrenScoped(parentId, tenant);
      for (const child of children) {
        if (!seen.has(child.id)) {
          seen.add(child.id);
          chain.push(child);
          queue.push(child.id);
        }
      }
    }

    return { data: chain };
  }

  private findChildrenScoped(parentId: string, tenant: TenantContext) {
    const qb = this.repo
      .createQueryBuilder('submission')
      .where('submission.amended_from_id = :parentId', { parentId })
      .andWhere('submission.deleted_at IS NULL');
    if (tenant.organizationId) {
      qb.andWhere(
        '(submission.organization_id = :orgId OR submission.organization_id IS NULL)',
        { orgId: tenant.organizationId },
      );
    }
    return qb.orderBy('submission.created_at', 'ASC').getMany();
  }

  async create(
    dto: CreateFormSubmissionDto,
    tenant: TenantContext,
    user: RequestUser,
  ) {
    const form = await this.formDefinitionsService.get(
      dto.formDefinitionId,
      tenant,
    );

    if (!form.isPublished && form.schemaJson?.fields?.length > 0) {
      throw new BadRequestException('Form is not published yet');
    }

    if (dto.status === 'SUBMITTED') {
      const errors = validateFormData(form.schemaJson, dto.dataJson ?? {});
      if (errors.length > 0) {
        throw new BadRequestException(
          `Form validation failed: ${errors.join('; ')}`,
        );
      }
    }

    const entity = this.repo.create({
      ...dto,
      submissionNumber: generateNumber('SUB'),
      formName: form.name,
      formVersion: form.version,
      status: dto.status ?? 'SUBMITTED',
      submittedAt: dto.status === 'DRAFT' ? null : new Date(),
      submittedById: user.sub,
      submittedByName: user.username ?? null,
      organizationId: tenant.organizationId,
      locationId: tenant.locationId,
    });
    return this.repo.save(entity);
  }

  async update(
    id: string,
    dto: UpdateFormSubmissionDto,
    tenant: TenantContext,
  ) {
    const submission = await this.findOneScoped(id, tenant);
    if (
      submission.status === 'SUBMITTED' &&
      dto.status &&
      dto.status !== 'AMENDED'
    ) {
      throw new BadRequestException('Submitted forms can only be amended');
    }

    if (dto.dataJson) {
      const form = await this.formDefinitionsService.get(
        submission.formDefinitionId,
        tenant,
      );
      const errors = validateFormData(form.schemaJson, dto.dataJson);
      if (errors.length > 0) {
        throw new BadRequestException(
          `Form validation failed: ${errors.join('; ')}`,
        );
      }
      submission.dataJson = dto.dataJson;
    }

    if (dto.visitId !== undefined) submission.visitId = dto.visitId;
    if (dto.encounterId !== undefined) submission.encounterId = dto.encounterId;
    if (dto.status === 'SUBMITTED' && submission.status === 'DRAFT') {
      submission.status = 'SUBMITTED';
      submission.submittedAt = new Date();
    }

    return this.repo.save(submission);
  }

  async amend(
    id: string,
    dto: UpdateFormSubmissionDto,
    tenant: TenantContext,
    user: RequestUser,
  ) {
    const original = await this.findOneScoped(id, tenant);

    const form = await this.formDefinitionsService.get(
      original.formDefinitionId,
      tenant,
    );
    const errors = validateFormData(form.schemaJson, dto.dataJson ?? {});
    if (errors.length > 0) {
      throw new BadRequestException(
        `Form validation failed: ${errors.join('; ')}`,
      );
    }

    const amended = this.repo.create({
      submissionNumber: generateNumber('SUB'),
      formDefinitionId: original.formDefinitionId,
      formName: original.formName,
      formVersion: original.formVersion,
      patientId: original.patientId,
      visitId: dto.visitId ?? original.visitId,
      encounterId: dto.encounterId ?? original.encounterId,
      dataJson: dto.dataJson ?? {},
      status: 'SUBMITTED',
      submittedAt: new Date(),
      submittedById: user.sub,
      submittedByName: user.username ?? null,
      amendedFromId: original.id,
      organizationId: tenant.organizationId,
      locationId: tenant.locationId,
    });
    return this.repo.save(amended);
  }

  async remove(id: string, tenant: TenantContext) {
    const submission = await this.findOneScoped(id, tenant);
    await this.repo.softRemove(submission);
    return { ok: true };
  }

  private async findOneScoped(id: string, tenant: TenantContext) {
    const qb = this.repo
      .createQueryBuilder('submission')
      .where('submission.id = :id', { id })
      .andWhere('submission.deleted_at IS NULL');

    if (tenant.organizationId) {
      qb.andWhere(
        '(submission.organization_id = :orgId OR submission.organization_id IS NULL)',
        { orgId: tenant.organizationId },
      );
    }

    const submission = await qb.getOne();
    if (!submission) {
      throw new NotFoundException('Form submission not found');
    }
    return submission;
  }
}
