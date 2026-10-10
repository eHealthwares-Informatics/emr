import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FormDefinitionOrmEntity } from '../forms/entities/form-definition.orm-entity';
import { FormAccessOrmEntity } from '../forms/entities/form-access.orm-entity';
import { MessageTemplateOrmEntity } from '../notifications/entities/message-template.orm-entity';
import {
  starterFormAccess,
  starterFormDefinitions,
  toFormAccessEntity,
  toFormEntity,
} from './seed-data/forms';
import { starterMessageTemplates } from './seed-data/message-templates';

@Injectable()
export class SeedService implements OnApplicationBootstrap {
  private readonly logger = new Logger(SeedService.name);

  constructor(
    private readonly config: ConfigService,
    @InjectRepository(FormDefinitionOrmEntity)
    private readonly formRepo: Repository<FormDefinitionOrmEntity>,
    @InjectRepository(FormAccessOrmEntity)
    private readonly accessRepo: Repository<FormAccessOrmEntity>,
    @InjectRepository(MessageTemplateOrmEntity)
    private readonly messageTemplateRepo: Repository<MessageTemplateOrmEntity>,
  ) {}

  async onApplicationBootstrap() {
    const enabled = this.config.get<string>('SEED_ON_START', 'true') === 'true';
    if (!enabled) {
      this.logger.log('Seeding skipped (SEED_ON_START is not true)');
      return;
    }
    // Starter forms + message templates (idempotent upsert).
    await this.run();
  }

  async run(): Promise<void> {
    await this.seedFormDefinitions();
    await this.seedFormAccess();
    await this.seedMessageTemplates();
    this.logger.log('Seed complete');
  }

  private async seedFormDefinitions(): Promise<void> {
    let created = 0;
    let updated = 0;

    for (const seed of starterFormDefinitions) {
      const existing = await this.formRepo.findOne({
        where: { code: seed.code as string },
      });

      if (existing) {
        if (
          existing.name !== seed.name ||
          existing.schemaJson !== seed.schemaJson ||
          existing.isPublished !== seed.isPublished
        ) {
          existing.name = seed.name as string;
          existing.description = seed.description ?? existing.description;
          existing.schemaJson =
            seed.schemaJson as FormDefinitionOrmEntity['schemaJson'];
          existing.isPublished = seed.isPublished ?? existing.isPublished;
          existing.publishedVersion =
            seed.publishedVersion ?? existing.publishedVersion;
          existing.isActive = seed.isActive ?? existing.isActive;
          await this.formRepo.save(existing);
          updated += 1;
        }
        continue;
      }

      const entity = toFormEntity(seed, null);
      await this.formRepo.save(entity);
      created += 1;
    }

    this.logger.log(`Form definitions: ${created} created, ${updated} updated`);
  }

  private async seedFormAccess(): Promise<void> {
    let created = 0;

    for (const seed of starterFormAccess) {
      const where: Record<string, string | null> = {};
      if (seed.userId) where.userId = seed.userId;
      if (seed.roleCode) where.roleCode = seed.roleCode;
      where.formCode = seed.formCode ?? null;

      const existing = await this.accessRepo.findOne({ where });
      if (existing) {
        continue;
      }

      await this.accessRepo.save(toFormAccessEntity(seed, null));
      created += 1;
    }

    this.logger.log(`Form access: ${created} created`);
  }

  private async seedMessageTemplates(): Promise<void> {
    let created = 0;
    let updated = 0;

    for (const seed of starterMessageTemplates) {
      const existing = await this.messageTemplateRepo.findOne({
        where: { code: seed.code },
        withDeleted: true,
      });

      if (existing) {
        existing.name = seed.name;
        existing.description = seed.description;
        existing.contentType = seed.contentType;
        existing.content = seed.content;
        existing.maxCharacters = seed.maxCharacters;
        existing.destinations = seed.destinations;
        existing.channelCodes = seed.channelCodes;
        existing.heartbeatRetries = seed.heartbeatRetries;
        existing.heartbeatIntervalSeconds = seed.heartbeatIntervalSeconds;
        existing.heartbeatExpirySeconds = seed.heartbeatExpirySeconds;
        existing.status = seed.status;
        existing.deletedAt = null;
        await this.messageTemplateRepo.save(existing);
        updated += 1;
        continue;
      }

      await this.messageTemplateRepo.save(
        this.messageTemplateRepo.create(seed),
      );
      created += 1;
    }

    this.logger.log(
      `Message templates: ${created} created, ${updated} updated`,
    );
  }
}
