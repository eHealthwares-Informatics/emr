import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppointmentOrmEntity } from './entities/appointment.orm-entity';
import { AppointmentsService } from './services/appointments.service';
import { AppointmentsController } from './controllers/appointments.controller';
import { VisitsModule } from '../visits/visits.module';

@Module({
  imports: [TypeOrmModule.forFeature([AppointmentOrmEntity]), VisitsModule],
  controllers: [AppointmentsController],
  providers: [AppointmentsService],
  exports: [AppointmentsService],
})
export class AppointmentsModule {}
