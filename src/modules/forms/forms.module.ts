import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PdfModule } from '../pdf/pdf.module';
import { FormDefinitionOrmEntity } from './entities/form-definition.orm-entity';
import { FormSubmissionOrmEntity } from './entities/form-submission.orm-entity';
import { FormAccessOrmEntity } from './entities/form-access.orm-entity';
import { FormDefinitionsService } from './services/form-definitions.service';
import { FormSubmissionsService } from './services/form-submissions.service';
import { FormAccessService } from './services/form-access.service';
import { FormDefinitionsController } from './controllers/form-definitions.controller';
import { FormSubmissionsController } from './controllers/form-submissions.controller';
import { FormAccessController } from './controllers/form-access.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      FormDefinitionOrmEntity,
      FormSubmissionOrmEntity,
      FormAccessOrmEntity,
    ]),
    PdfModule,
  ],
  controllers: [
    FormDefinitionsController,
    FormSubmissionsController,
    FormAccessController,
  ],
  providers: [
    FormDefinitionsService,
    FormSubmissionsService,
    FormAccessService,
  ],
  exports: [FormDefinitionsService, FormSubmissionsService, FormAccessService],
})
export class FormsModule {}
