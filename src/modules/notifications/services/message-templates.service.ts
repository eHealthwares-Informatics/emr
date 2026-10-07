import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MessageTemplateOrmEntity } from '../entities/message-template.orm-entity';
import {
  CreateMessageTemplateDto,
  UpdateMessageTemplateDto,
} from '../dto/message-template.dto';
import { TenantContext } from '../../../common/tenant-context';
import { ListQueryDto } from '../../../shared/dto/list-query.dto';
import { applySort } from '../../../database/list';

const SORT_ALLOW_LIST = ['code', 'name', 'status', 'createdAt', 'updatedAt'];

@Injectable()
export class MessageTemplatesService {
  constructor(
    @InjectRepository(MessageTemplateOrmEntity)
    private readonly repo: Repository<MessageTemplateOrmEntity>,
  ) {}

  async list(query: ListQueryDto & { status?: string }, tenant: TenantContext) {
    const qb = this.repo
      .createQueryBuilder('template')
      .where('template.deleted_at IS NULL');

    if (tenant.organizationId) {
      qb.andWhere(
        '(template.organization_id = :orgId OR template.organization_id IS NULL)',
        { orgId: tenant.organizationId },
      );
    }

    if (query.search) {
      qb.andWhere(
        '(template.code ILIKE :search OR template.name ILIKE :search)',
        {
          search: `%${query.search}%`,
        },
      );
    }
    if (query.status) {
      qb.andWhere('template.status = :status', { status: query.status });
    }

    const sortBy = SORT_ALLOW_LIST.includes(query.sortBy)
      ? query.sortBy
      : 'code';
    applySort(qb, 'template', sortBy, query.sortOrder);

    const [data, total] = await qb
      .skip(query.offset)
      .take(query.limit)
      .getManyAndCount();
    return { data, total };
  }

  async get(id: string, tenant: TenantContext) {
    return this.findOneScoped(id, tenant);
  }

  async create(dto: CreateMessageTemplateDto, tenant: TenantContext) {
    await this.assertCodeAvailable(dto.code);
    if (dto.contentType === 'limited_text' && !dto.maxCharacters) {
      throw new BadRequestException(
        'maxCharacters is required for limited_text templates',
      );
    }
    const entity = this.repo.create({
      code: dto.code,
      name: dto.name,
      description: dto.description ?? null,
      contentType: dto.contentType,
      content: dto.content,
      maxCharacters: dto.maxCharacters ?? null,
      destinations: dto.destinations,
      channelCodes: dto.channelCodes ?? [],
      heartbeatRetries: dto.heartbeatRetries ?? 3,
      heartbeatIntervalSeconds: dto.heartbeatIntervalSeconds ?? 30,
      heartbeatExpirySeconds: dto.heartbeatExpirySeconds ?? 86400,
      status: dto.status,
      organizationId: tenant.organizationId,
      locationId: tenant.locationId,
    });
    return this.repo.save(entity);
  }

  async update(
    id: string,
    dto: UpdateMessageTemplateDto,
    tenant: TenantContext,
  ) {
    const template = await this.findOneScoped(id, tenant);
    Object.assign(template, dto);
    if (template.contentType === 'limited_text' && !template.maxCharacters) {
      throw new BadRequestException(
        'maxCharacters is required for limited_text templates',
      );
    }
    return this.repo.save(template);
  }

  async remove(id: string, tenant: TenantContext) {
    const template = await this.findOneScoped(id, tenant);
    await this.repo.softRemove(template);
    return { ok: true };
  }

  private async assertCodeAvailable(code: string) {
    const existing = await this.repo.findOne({
      where: { code },
      withDeleted: true,
    });
    if (existing) {
      throw new BadRequestException(
        `Template code "${code}" is already in use`,
      );
    }
  }

  private async findOneScoped(id: string, tenant: TenantContext) {
    const qb = this.repo
      .createQueryBuilder('template')
      .where('template.id = :id', { id })
      .andWhere('template.deleted_at IS NULL');

    if (tenant.organizationId) {
      qb.andWhere(
        '(template.organization_id = :orgId OR template.organization_id IS NULL)',
        { orgId: tenant.organizationId },
      );
    }

    const template = await qb.getOne();
    if (!template) {
      throw new NotFoundException('Message template not found');
    }
    return template;
  }
}
