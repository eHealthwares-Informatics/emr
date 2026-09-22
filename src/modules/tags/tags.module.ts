import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TagOrmEntity } from './entities/tag.orm-entity';
import { PatientTagOrmEntity } from './entities/patient-tag.orm-entity';
import { TagsService } from './services/tags.service';
import { TagsController } from './controllers/tags.controller';

@Module({
  imports: [TypeOrmModule.forFeature([TagOrmEntity, PatientTagOrmEntity])],
  controllers: [TagsController],
  providers: [TagsService],
  exports: [TagsService],
})
export class TagsModule {}
