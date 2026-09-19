import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, Repository } from 'typeorm';
import { ListQueryDto } from '../../../shared/dto/list-query.dto';
import { FormAccessOrmEntity } from '../entities/form-access.orm-entity';
import { FormDefinitionsService } from './form-definitions.service';
import { TenantContext } from '../../../common/tenant-context';
import type { RequestUser } from '../../../common/decorators/current-user.decorator';

@Injectable()
export class FormAccessService {
  constructor(
    @InjectRepository(FormAccessOrmEntity)
    private readonly accessRepo: Repository<FormAccessOrmEntity>,
    private readonly formDefinitionsService: FormDefinitionsService,
  ) {}

  /**
   * Returns the published form definitions the current user may access.
   *
   * Rules:
   * - super_admin always sees every published form.
   * - A user with no matching form_access rows defaults to all published
   *   forms, so an empty table never locks users out.
   * - Matching rows are resolved by user id or role code. `isAllowed=true`
   *   grants a form (or all forms when `formCode` is null); `isAllowed=false`
   *   removes a specific form from the result.
   */
  async getAvailableForms(user: RequestUser, tenant: TenantContext) {
    const query = new ListQueryDto();
    query.page = 1;
    query.limit = 1000;
    Object.assign(query, { published: 'true' });
    const published = await this.formDefinitionsService.list(query, tenant);

    if (user.roles?.includes('super_admin')) {
      return { data: published.data };
    }

    const roleCodes = user.roles ?? [];
    const rows = await this.accessRepo.find({
      where: [
        { userId: user.sub, deletedAt: IsNull() },
        ...(roleCodes.length > 0
          ? [{ roleCode: In(roleCodes), deletedAt: IsNull() }]
          : []),
      ],
    });

    // No config for this user -> allow everything (backward compatible).
    if (rows.length === 0) {
      return { data: published.data };
    }

    const allows = rows.filter((row) => row.isAllowed);
    const denies = rows.filter((row) => !row.isAllowed);

    const wildcardAllow = allows.some((row) => !row.formCode);
    const allowedCodes = new Set<string>(
      wildcardAllow
        ? published.data.map((form) => form.code)
        : allows
            .filter((row) => row.formCode)
            .map((row) => row.formCode as string),
    );

    for (const deny of denies) {
      if (deny.formCode) {
        allowedCodes.delete(deny.formCode);
      }
    }

    return {
      data: published.data.filter((form) => allowedCodes.has(form.code)),
    };
  }
}
