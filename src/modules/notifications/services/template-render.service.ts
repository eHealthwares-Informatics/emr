import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MessageTemplateOrmEntity } from '../entities/message-template.orm-entity';
import { TenantContext } from '../../../common/tenant-context';

export const REQUEST_CREATED_TEMPLATE_CODE = 'request_created';
export const DEFAULT_REQUEST_CREATED_CONTENT =
  'New request {{request_ref}} created';
export const TRUNCATION_SUFFIX = '…';

export type RenderVariables = Record<string, string | null | undefined>;

export interface RenderedMessage {
  title: string;
  content: string;
  template: MessageTemplateOrmEntity | null;
}

/**
 * Resolves active message templates and renders their content.
 *
 * - Only `status = active`, non-deleted templates are ever used.
 * - An org-scoped template wins over a global (organizationId IS NULL) one.
 * - `{{variable}}` placeholders are substituted; unknown placeholders are left
 *   intact so misconfiguration is visible rather than silently dropped.
 * - `limited_text` content is truncated to `maxCharacters` (with an ellipsis)
 *   when it exceeds the limit.
 */
@Injectable()
export class TemplateRenderService {
  constructor(
    @InjectRepository(MessageTemplateOrmEntity)
    private readonly repo: Repository<MessageTemplateOrmEntity>,
  ) {}

  async resolveActiveTemplate(
    code: string,
    tenant: Pick<TenantContext, 'organizationId'>,
  ): Promise<MessageTemplateOrmEntity | null> {
    const qb = this.repo
      .createQueryBuilder('template')
      .where('template.code = :code', { code })
      .andWhere('template.status = :status', { status: 'active' })
      .andWhere('template.deleted_at IS NULL');

    if (tenant.organizationId) {
      qb.andWhere(
        '(template.organization_id = :orgId OR template.organization_id IS NULL)',
        { orgId: tenant.organizationId },
      );
    } else {
      qb.andWhere('template.organization_id IS NULL');
    }

    // Non-null (org-scoped) rows sort before global ones.
    // orderBy() takes TypeORM property paths (camelCase), not column names.
    qb.orderBy('(template.organization_id IS NULL)', 'ASC').addOrderBy(
      'template.updatedAt',
      'DESC',
    );

    return qb.getOne();
  }

  render(
    template: MessageTemplateOrmEntity | null,
    variables: RenderVariables,
  ): RenderedMessage {
    const rawContent = template?.content ?? DEFAULT_REQUEST_CREATED_CONTENT;
    let content = this.substitute(rawContent, variables);

    if (
      template?.contentType === 'limited_text' &&
      template.maxCharacters != null &&
      content.length > template.maxCharacters
    ) {
      content = this.truncate(content, template.maxCharacters);
    }

    return {
      title: template?.name ?? 'New request created',
      content,
      template,
    };
  }

  substitute(template: string, variables: RenderVariables): string {
    return template.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (match, key: string) => {
      if (!(key in variables)) return match;
      const value = variables[key];
      return value == null ? '' : String(value);
    });
  }

  private truncate(content: string, maxCharacters: number): string {
    if (maxCharacters <= TRUNCATION_SUFFIX.length) {
      return content.slice(0, maxCharacters);
    }
    return (
      content.slice(0, maxCharacters - TRUNCATION_SUFFIX.length) +
      TRUNCATION_SUFFIX
    );
  }
}
