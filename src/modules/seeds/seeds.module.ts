import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FormDefinitionOrmEntity } from '../forms/entities/form-definition.orm-entity';
import { FormAccessOrmEntity } from '../forms/entities/form-access.orm-entity';
import { SeedService } from './seed.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([FormDefinitionOrmEntity, FormAccessOrmEntity]),
  ],
  providers: [SeedService],
  exports: [SeedService],
})
export class SeedsModule {}
