import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ReferralOrmEntity } from './entities/referral.orm-entity';
import { ReferralsService } from './services/referrals.service';
import { ReferralsController } from './controllers/referrals.controller';
import { EncountersModule } from '../encounters/encounters.module';
import { StaffModule } from '../staff/staff.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([ReferralOrmEntity]),
    EncountersModule,
    StaffModule,
  ],
  controllers: [ReferralsController],
  providers: [ReferralsService],
  exports: [ReferralsService],
})
export class ReferralsModule {}
