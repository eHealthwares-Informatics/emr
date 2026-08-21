import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { PaymentProviderOrmEntity } from '../entities/payment-provider.orm-entity';
import { CreatePaymentProviderDto, UpdatePaymentProviderDto } from '../dto/payment-provider.dto';
import { TenantContext } from '../../../common/tenant-context';
import { ListQueryDto } from '../../../shared/dto/list-query.dto';
import { applySort } from '../../../database/list';

const SORT_ALLOW_LIST = ['code', 'name', 'type', 'createdAt', 'updatedAt'];

@Injectable()
export class PaymentProvidersService {
  constructor(
    @InjectRepository(PaymentProviderOrmEntity)
    private readonly repo: Repository<PaymentProviderOrmEntity>,
  ) {}

  async list(query: ListQueryDto, tenant: TenantContext) {
    const qb = this.repo
      .createQueryBuilder('provider')
      .where('provider.deleted_at IS NULL');

    if (tenant.organizationId) {
      qb.andWhere(
        '(provider.organization_id = :orgId OR provider.organization_id IS NULL)',
        { orgId: tenant.organizationId },
      );
    }

    if (query.search) {
      qb.andWhere(
        '(provider.code ILIKE :search OR provider.name ILIKE :search OR provider.type ILIKE :search)',
        { search: `%${query.search}%` },
      );
    }

    const sortBy = SORT_ALLOW_LIST.includes(query.sortBy) ? query.sortBy : 'name';
    applySort(qb, 'provider', sortBy, query.sortOrder);

    const [data, total] = await qb
      .skip(query.offset)
      .take(query.limit)
      .getManyAndCount();

    return { data, total };
  }

  async get(id: string, tenant: TenantContext) {
    return this.findOneScoped(id, tenant);
  }

  async create(dto: CreatePaymentProviderDto, tenant: TenantContext) {
    const existing = await this.repo.findOne({
      where: { code: dto.code, deletedAt: IsNull() },
    });
    if (existing) {
      throw new BadRequestException(`Payment provider with code ${dto.code} already exists`);
    }

    const entity = this.repo.create({
      ...dto,
      organizationId: tenant.organizationId,
      locationId: tenant.locationId,
    });
    return this.repo.save(entity);
  }

  async update(id: string, dto: UpdatePaymentProviderDto, tenant: TenantContext) {
    const provider = await this.findOneScoped(id, tenant);

    if (dto.code && dto.code !== provider.code) {
      const existing = await this.repo.findOne({
        where: { code: dto.code, deletedAt: IsNull() },
      });
      if (existing && existing.id !== provider.id) {
        throw new BadRequestException(`Payment provider with code ${dto.code} already exists`);
      }
    }

    Object.assign(provider, dto);
    return this.repo.save(provider);
  }

  async remove(id: string, tenant: TenantContext) {
    const provider = await this.findOneScoped(id, tenant);
    await this.repo.softRemove(provider);
    return { ok: true };
  }

  private async findOneScoped(id: string, tenant: TenantContext) {
    const qb = this.repo
      .createQueryBuilder('provider')
      .where('provider.id = :id', { id })
      .andWhere('provider.deleted_at IS NULL');

    if (tenant.organizationId) {
      qb.andWhere(
        '(provider.organization_id = :orgId OR provider.organization_id IS NULL)',
        { orgId: tenant.organizationId },
      );
    }

    const provider = await qb.getOne();
    if (!provider) {
      throw new NotFoundException('Payment provider not found');
    }
    return provider;
  }
}
