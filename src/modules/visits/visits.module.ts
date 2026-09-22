import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { VisitOrmEntity } from './entities/visit.orm-entity';
import { VisitCommentOrmEntity } from './entities/visit-comment.orm-entity';
import { VisitsService } from './services/visits.service';
import { VisitsController } from './controllers/visits.controller';

@Module({
  imports: [TypeOrmModule.forFeature([VisitOrmEntity, VisitCommentOrmEntity])],
  controllers: [VisitsController],
  providers: [VisitsService],
  exports: [VisitsService],
})
export class VisitsModule {}
