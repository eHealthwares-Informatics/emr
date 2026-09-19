import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DepartmentOrmEntity } from './entities/department.orm-entity';
import { DepartmentsService } from './services/departments.service';
import { DepartmentsController } from './controllers/departments.controller';

@Module({
  imports: [TypeOrmModule.forFeature([DepartmentOrmEntity])],
  controllers: [DepartmentsController],
  providers: [DepartmentsService],
  exports: [DepartmentsService],
})
export class DepartmentsModule {}
