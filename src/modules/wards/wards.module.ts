import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WardOrmEntity } from './entities/ward.orm-entity';
import { WardsService } from './services/wards.service';
import { WardsController } from './controllers/wards.controller';

@Module({
  imports: [TypeOrmModule.forFeature([WardOrmEntity])],
  controllers: [WardsController],
  providers: [WardsService],
  exports: [WardsService],
})
export class WardsModule {}
