import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BedOrmEntity } from './entities/bed.orm-entity';
import { BedsService } from './services/beds.service';
import { BedsController } from './controllers/beds.controller';

@Module({
  imports: [TypeOrmModule.forFeature([BedOrmEntity])],
  controllers: [BedsController],
  providers: [BedsService],
  exports: [BedsService],
})
export class BedsModule {}
