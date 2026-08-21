import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StaffOrmEntity } from './entities/staff.orm-entity';
import { StaffService } from './services/staff.service';
import { StaffController } from './controllers/staff.controller';

@Module({
  imports: [TypeOrmModule.forFeature([StaffOrmEntity])],
  controllers: [StaffController],
  providers: [StaffService],
  exports: [StaffService],
})
export class StaffModule {}
