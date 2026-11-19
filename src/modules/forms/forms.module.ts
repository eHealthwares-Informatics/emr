import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { PdfModule } from '../pdf/pdf.module';
import { FormDefinitionOrmEntity } from './entities/form-definition.orm-entity';
import { FormSubmissionOrmEntity } from './entities/form-submission.orm-entity';
import { FormAccessOrmEntity } from './entities/form-access.orm-entity';
import { FormShareLinkOrmEntity } from './entities/form-share-link.orm-entity';
import { PatientOtpChallengeOrmEntity } from './entities/patient-otp-challenge.orm-entity';
import { FormDefinitionsService } from './services/form-definitions.service';
import { FormSubmissionsService } from './services/form-submissions.service';
import { FormAccessService } from './services/form-access.service';
import { FormShareLinksService } from './services/form-share-links.service';
import { PatientOtpService } from './services/patient-otp.service';
import { PublicFormsService } from './services/public-forms.service';
import { FormDefinitionsController } from './controllers/form-definitions.controller';
import { FormSubmissionsController } from './controllers/form-submissions.controller';
import { FormAccessController } from './controllers/form-access.controller';
import { FormShareLinksController } from './controllers/form-share-links.controller';
import { PublicFormsController } from './controllers/public-forms.controller';
import { FormNotificationsController } from './controllers/form-notifications.controller';
import { NotificationsModule } from '../notifications/notifications.module';
import { EncountersModule } from '../encounters/encounters.module';
import { IdentityProxyModule } from '../identity-proxy/identity-proxy.module';
import { PatientsModule } from '../patients/patients.module';
import { UploadsModule } from '../uploads/uploads.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      FormDefinitionOrmEntity,
      FormSubmissionOrmEntity,
      FormAccessOrmEntity,
      FormShareLinkOrmEntity,
      PatientOtpChallengeOrmEntity,
    ]),
    JwtModule.register({}),
    PdfModule,
    NotificationsModule,
    EncountersModule,
    IdentityProxyModule,
    PatientsModule,
    UploadsModule,
  ],
  controllers: [
    FormDefinitionsController,
    FormSubmissionsController,
    FormAccessController,
    FormShareLinksController,
    PublicFormsController,
    FormNotificationsController,
  ],
  providers: [
    FormDefinitionsService,
    FormSubmissionsService,
    FormAccessService,
    FormShareLinksService,
    PatientOtpService,
    PublicFormsService,
  ],
  exports: [
    FormDefinitionsService,
    FormSubmissionsService,
    FormAccessService,
    FormShareLinksService,
    PatientOtpService,
    PublicFormsService,
  ],
})
export class FormsModule {}
