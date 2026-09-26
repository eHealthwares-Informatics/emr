import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MedicationOrmEntity } from './entities/medication.orm-entity';
import { MedicationsService } from './services/medications.service';
import { MedicationsController } from './controllers/medications.controller';
import { RequestsModule } from '../requests/requests.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([MedicationOrmEntity]),
    RequestsModule,
  ],
  controllers: [MedicationsController],
  providers: [MedicationsService],
  exports: [MedicationsService],
})
export class MedicationsModule {}
