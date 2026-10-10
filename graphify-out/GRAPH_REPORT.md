# Graph Report - emr  (2026-10-07)

## Corpus Check
- 177 files · ~57,831 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1624 nodes · 4490 edges · 69 communities (67 shown, 2 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 4 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `519a190e`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- admissions.controller.ts
- notifications.module.ts
- RequestsService
- AuthProxyService
- VisitsService
- PatientsService
- appointments.controller.ts
- requests.service.ts
- app.module.ts
- departments.service.ts
- payment-providers.service.ts
- IdentityProxyService
- EmrBaseEntity
- ReferralsService
- staff.service.ts
- tenant-context.ts
- TenantContext
- ListQueryDto
- devDependencies
- compilerOptions
- AuditLogService
- FormDefinitionOrmEntity
- tags.service.ts
- repo-mock.ts
- CurrentUser
- request.dto.ts
- RequestUser
- dependencies
- enums.ts
- DashboardService
- emr.types.ts
- CreateMedicationDto
- CreateMessageTemplateDto
- list.ts
- CreateWardDto
- request-logging.interceptor.ts
- FormDefinitionsController
- FormSubmissionsController
- form.dto.ts
- MedicationsController
- ReferralsController
- BedsController
- EncountersController
- scripts
- tenantFromUser
- MessageTemplatesController
- StaffController
- TagsController
- WardsController
- encounters.service.ts
- FormSubmissionsService
- tags.module.ts
- FormSubmissionOrmEntity
- EMR — Use Cases
- jest
- CreateBedDto
- permissions.guard.ts
- MessageTemplateOrmEntity
- EMR Implementation — Findings
- RolesGuard
- SeedService
- VisitCommentOrmEntity
- nest-cli.json
- package.json
- EMR Implementation — Progress Log
- EMR Implementation — Task Plan
- tsconfig.build.json

## God Nodes (most connected - your core abstractions)
1. `RequestUser` - 195 edges
2. `TenantContext` - 183 edges
3. `CurrentUser` - 150 edges
4. `tenantFromUser()` - 147 edges
5. `ListQueryDto` - 82 edges
6. `EmrBaseEntity` - 54 edges
7. `applySort()` - 36 edges
8. `RequestOrmEntity` - 26 edges
9. `RequestsService` - 24 edges
10. `VisitsService` - 24 edges

## Surprising Connections (you probably didn't know these)
- `bootstrap()` --indirect_call--> `AppModule`  [INFERRED]
  src/main.ts → src/app.module.ts
- `AdmissionOrmEntity` --references--> `AdmissionType`  [EXTRACTED]
  src/modules/admissions/entities/admission.orm-entity.ts → src/shared/domain/enums.ts
- `AdmissionOrmEntity` --references--> `DischargeType`  [EXTRACTED]
  src/modules/admissions/entities/admission.orm-entity.ts → src/shared/domain/enums.ts
- `AppointmentOrmEntity` --inherits--> `EmrBaseEntity`  [EXTRACTED]
  src/modules/appointments/entities/appointment.orm-entity.ts → src/modules/emr-base.entity.ts
- `CreateBedDto` --references--> `BedStatus`  [EXTRACTED]
  src/modules/beds/dto/bed.dto.ts → src/shared/domain/enums.ts

## Import Cycles
- None detected.

## Communities (69 total, 2 thin omitted)

### Community 0 - "admissions.controller.ts"
Cohesion: 0.07
Nodes (34): AdmissionsController, ApiOperation, ApiTags, Body, Controller, Delete, Get, Param (+26 more)

### Community 1 - "notifications.module.ts"
Cohesion: 0.06
Nodes (38): NotificationSubscriptionsController, ApiOperation, ApiTags, Body, Controller, Post, NotificationsController, ApiTags (+30 more)

### Community 2 - "RequestsService"
Cohesion: 0.09
Nodes (34): IsNumber, Req, extractToken(), RequestsController, ApiOperation, ApiTags, Body, Controller (+26 more)

### Community 3 - "AuthProxyService"
Cohesion: 0.07
Nodes (33): Headers, HttpCode, Public(), AuthProxyController, ProxyAuthResponseDto, ProxyLoginDto, ProxyMeResponseDto, ProxyModuleDto (+25 more)

### Community 4 - "VisitsService"
Cohesion: 0.08
Nodes (32): ApiOperation, ApiTags, Body, Controller, Delete, Get, Param, Patch (+24 more)

### Community 5 - "PatientsService"
Cohesion: 0.07
Nodes (27): EncountersService, Injectable, InjectRepository, PatientsController, ApiOperation, ApiTags, Body, Controller (+19 more)

### Community 6 - "appointments.controller.ts"
Cohesion: 0.08
Nodes (32): CancelAppointmentDto, CheckInAppointmentDto, CreateAppointmentDto, RescheduleAppointmentDto, ApiProperty, ApiPropertyOptional, IsDateString, IsEnum (+24 more)

### Community 7 - "requests.service.ts"
Cohesion: 0.10
Nodes (27): RequestItemOrmEntity, Column, Entity, JoinColumn, ManyToOne, RequestOrmEntity, Column, Entity (+19 more)

### Community 8 - "app.module.ts"
Cohesion: 0.07
Nodes (32): AuditModule, Module, JwtAuthGuard, Injectable, AdmissionsModule, Module, AppointmentsModule, Module (+24 more)

### Community 9 - "departments.service.ts"
Cohesion: 0.09
Nodes (27): DepartmentsController, ApiTags, Controller, DepartmentsModule, Module, CreateDepartmentDto, ApiProperty, ApiPropertyOptional (+19 more)

### Community 10 - "payment-providers.service.ts"
Cohesion: 0.09
Nodes (26): PaymentProvidersController, ApiTags, Body, Controller, Post, CreatePaymentProviderDto, ApiProperty, ApiPropertyOptional (+18 more)

### Community 11 - "IdentityProxyService"
Cohesion: 0.08
Nodes (18): IdentityProxyModule, Module, CachedEntry, IdentityLocation, IdentityOrganization, IdentityProxyService, IdentityUser, Injectable (+10 more)

### Community 12 - "EmrBaseEntity"
Cohesion: 0.09
Nodes (29): AdmissionOrmEntity, Column, Entity, Index, ManyToOne, DashboardModule, Module, TODAY_APPOINTMENT_SORT (+21 more)

### Community 13 - "ReferralsService"
Cohesion: 0.11
Nodes (22): CompleteReferralDto, CreateReferralDto, DecideReferralDto, ApiProperty, ApiPropertyOptional, IsDateString, IsEnum, IsOptional (+14 more)

### Community 14 - "staff.service.ts"
Cohesion: 0.12
Nodes (22): CreateStaffDto, ApiProperty, ApiPropertyOptional, IsBoolean, IsDateString, IsEmail, IsEnum, IsNotEmpty (+14 more)

### Community 15 - "tenant-context.ts"
Cohesion: 0.16
Nodes (12): FormAccessController, ApiTags, Controller, FormAccessService, Injectable, InjectRepository, FormDefinitionsService, SORT_ALLOW_LIST (+4 more)

### Community 16 - "TenantContext"
Cohesion: 0.11
Nodes (5): TenantContext, MedicationsService, Injectable, MessageTemplatesService, Injectable

### Community 17 - "ListQueryDto"
Cohesion: 0.12
Nodes (14): Max, applySort(), dslFilterValue(), SORT_ALLOW_LIST, SORT_ALLOW_LIST, SORT_ALLOW_LIST, ListQueryDto, ApiPropertyOptional (+6 more)

### Community 18 - "devDependencies"
Cohesion: 0.07
Nodes (29): devDependencies, eslint, eslint-config-prettier, @eslint/eslintrc, @eslint/js, eslint-plugin-prettier, globals, jest (+21 more)

### Community 19 - "compilerOptions"
Cohesion: 0.07
Nodes (28): compilerOptions, allowSyntheticDefaultImports, baseUrl, declaration, emitDecoratorMetadata, esModuleInterop, experimentalDecorators, forceConsistentCasingInFileNames (+20 more)

### Community 20 - "AuditLogService"
Cohesion: 0.10
Nodes (16): AuditLogOrmEntity, Column, CreateDateColumn, DeleteDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn, AuditLogEntry (+8 more)

### Community 21 - "FormDefinitionOrmEntity"
Cohesion: 0.11
Nodes (20): FormAccessOrmEntity, Column, Entity, Index, FormDefinitionOrmEntity, Column, Entity, Index (+12 more)

### Community 22 - "tags.service.ts"
Cohesion: 0.15
Nodes (14): Matches, AssignPatientTagsDto, CreateTagDto, ApiPropertyOptional, IsArray, IsOptional, IsString, IsUUID (+6 more)

### Community 23 - "repo-mock.ts"
Cohesion: 0.25
Nodes (9): published, validSchema, schema, listQuery(), QueryBuilderMock, repoMock(), RepositoryMock, tenant (+1 more)

### Community 24 - "CurrentUser"
Cohesion: 0.11
Nodes (16): CurrentUser, ApiBearerAuth, ApiOperation, Get, ApiOperation, Get, Param, Patch (+8 more)

### Community 25 - "request.dto.ts"
Cohesion: 0.15
Nodes (22): CreateEncounterDto, CreateEncounterRequestDto, ApiProperty, ApiPropertyOptional, IsArray, IsDateString, IsEnum, IsOptional (+14 more)

### Community 26 - "RequestUser"
Cohesion: 0.22
Nodes (13): RequestUser, AppointmentsController, ApiOperation, ApiTags, Body, Controller, Delete, Get (+5 more)

### Community 27 - "dependencies"
Cohesion: 0.09
Nodes (22): dependencies, axios, class-transformer, class-validator, dotenv, html-to-pdfmake, js-yaml, jsdom (+14 more)

### Community 28 - "enums.ts"
Cohesion: 0.13
Nodes (18): BedOrmEntity, Column, Entity, InjectRepository, ADMISSION_STATUSES, ADMISSION_TYPES, APPOINTMENT_STATUSES, APPOINTMENT_TYPES (+10 more)

### Community 29 - "DashboardService"
Cohesion: 0.15
Nodes (9): DashboardController, ApiOperation, ApiQuery, ApiTags, Controller, Get, Query, DashboardService (+1 more)

### Community 30 - "emr.types.ts"
Cohesion: 0.12
Nodes (18): CONTAINER_TYPES, FIELD_TYPES, NESTING_RULES, validateFormData(), validateFormSchema(), Appointment, BaseEntityType, ClinicalRequest (+10 more)

### Community 31 - "CreateMedicationDto"
Cohesion: 0.14
Nodes (18): AdministerMedicationDto, CreateMedicationDto, ApiProperty, ApiPropertyOptional, IsDateString, IsEnum, IsInt, IsOptional (+10 more)

### Community 32 - "CreateMessageTemplateDto"
Cohesion: 0.19
Nodes (18): ArrayNotEmpty, CreateMessageTemplateDto, ApiProperty, ApiPropertyOptional, IsArray, IsIn, IsInt, IsOptional (+10 more)

### Community 33 - "list.ts"
Cohesion: 0.19
Nodes (13): addDays(), applyFilter(), applyFilters(), applyTimestampFilter(), FilterQuery, ListResult, paginate(), paramName() (+5 more)

### Community 34 - "CreateWardDto"
Cohesion: 0.16
Nodes (16): CreateWardDto, ApiProperty, ApiPropertyOptional, IsBoolean, IsIn, IsNotEmpty, IsOptional, IsString (+8 more)

### Community 35 - "request-logging.interceptor.ts"
Cohesion: 0.15
Nodes (13): Catch, AppModule, Module, GlobalExceptionFilter, PG_ERROR_CODES, maskSensitive(), RequestLoggingInterceptor, SafeBody (+5 more)

### Community 36 - "FormDefinitionsController"
Cohesion: 0.21
Nodes (11): FormDefinitionsController, ApiOperation, ApiTags, Body, Controller, Delete, Get, Param (+3 more)

### Community 37 - "FormSubmissionsController"
Cohesion: 0.21
Nodes (11): FormSubmissionsController, ApiOperation, ApiTags, Body, Controller, Delete, Get, Param (+3 more)

### Community 38 - "form.dto.ts"
Cohesion: 0.27
Nodes (17): CreateFormDefinitionDto, CreateFormSubmissionDto, PublishFormDto, ApiProperty, ApiPropertyOptional, IsEnum, IsIn, IsInt (+9 more)

### Community 39 - "MedicationsController"
Cohesion: 0.19
Nodes (11): MedicationsController, ApiOperation, ApiTags, Body, Controller, Delete, Get, Param (+3 more)

### Community 40 - "ReferralsController"
Cohesion: 0.22
Nodes (11): ReferralsController, ApiOperation, ApiTags, Body, Controller, Delete, Get, Param (+3 more)

### Community 41 - "BedsController"
Cohesion: 0.21
Nodes (11): BedsController, ApiOperation, ApiTags, Body, Controller, Delete, Get, Param (+3 more)

### Community 42 - "EncountersController"
Cohesion: 0.21
Nodes (11): EncountersController, ApiOperation, ApiTags, Body, Controller, Delete, Get, Param (+3 more)

### Community 43 - "scripts"
Cohesion: 0.12
Nodes (16): scripts, build, format, lint, migration:revert, migration:run, seed, start (+8 more)

### Community 44 - "tenantFromUser"
Cohesion: 0.19
Nodes (10): tenantFromUser(), ApiOperation, ApiQuery, Body, Delete, Get, Param, Patch (+2 more)

### Community 45 - "MessageTemplatesController"
Cohesion: 0.19
Nodes (11): MessageTemplatesController, ApiOperation, ApiTags, Body, Controller, Delete, Get, Param (+3 more)

### Community 46 - "StaffController"
Cohesion: 0.19
Nodes (11): StaffController, ApiOperation, ApiTags, Body, Controller, Delete, Get, Param (+3 more)

### Community 47 - "TagsController"
Cohesion: 0.19
Nodes (11): TagsController, ApiOperation, ApiTags, Body, Controller, Delete, Get, Param (+3 more)

### Community 48 - "WardsController"
Cohesion: 0.19
Nodes (11): ApiOperation, ApiTags, Body, Controller, Delete, Get, Param, Patch (+3 more)

### Community 49 - "encounters.service.ts"
Cohesion: 0.19
Nodes (5): SORT_ALLOW_LIST, SORT_ALLOW_LIST, SORT_ALLOW_LIST, TagSummary, generateNumber()

### Community 50 - "FormSubmissionsService"
Cohesion: 0.27
Nodes (3): Res, FormSubmissionsService, Injectable

### Community 51 - "tags.module.ts"
Cohesion: 0.19
Nodes (9): PatientTagOrmEntity, Column, Entity, Index, TagOrmEntity, Column, Entity, Index (+1 more)

### Community 52 - "FormSubmissionOrmEntity"
Cohesion: 0.24
Nodes (9): FormSubmissionOrmEntity, Column, Entity, Index, escapeHtml(), renderValue(), submissionPdfHtml(), InjectRepository (+1 more)

### Community 53 - "EMR — Use Cases"
Cohesion: 0.17
Nodes (11): 1. Patients, 2. Staff, 3. Appointments, 4. Visits, 5. Encounters, 6. Documentation (dynamic forms), 7. Clinical Requests, 8. Audit trail (+3 more)

### Community 54 - "jest"
Cohesion: 0.18
Nodes (11): jest, collectCoverageFrom, coverageDirectory, moduleFileExtensions, moduleNameMapper, rootDir, testEnvironment, testRegex (+3 more)

### Community 55 - "CreateBedDto"
Cohesion: 0.27
Nodes (10): CreateBedDto, ApiProperty, ApiPropertyOptional, IsIn, IsNotEmpty, IsOptional, IsString, IsUUID (+2 more)

### Community 56 - "permissions.guard.ts"
Cohesion: 0.24
Nodes (4): PermissionsGuard, Injectable, UserWithPermissions, permissionMatches()

### Community 57 - "MessageTemplateOrmEntity"
Cohesion: 0.25
Nodes (7): MessageTemplateOrmEntity, Column, Entity, Index, InjectRepository, RenderedMessage, RenderVariables

### Community 58 - "EMR Implementation — Findings"
Cohesion: 0.25
Nodes (7): EMR Implementation — Findings, Frontend (rxsoft-admin-3), Image attachments, LIS integration contract, Pharmacy integration contract, rxsoft-backend layout essentials (source of truth for emr/), rxsoft-identity status

### Community 59 - "RolesGuard"
Cohesion: 0.25
Nodes (3): RolesGuard, Injectable, UserWithRoles

### Community 61 - "VisitCommentOrmEntity"
Cohesion: 0.29
Nodes (5): Column, Entity, Index, VisitCommentOrmEntity, InjectRepository

### Community 62 - "nest-cli.json"
Cohesion: 0.33
Nodes (5): collection, compilerOptions, deleteOutDir, $schema, sourceRoot

### Community 63 - "package.json"
Cohesion: 0.33
Nodes (5): description, license, name, private, version

### Community 64 - "EMR Implementation — Progress Log"
Cohesion: 0.33
Nodes (5): Blockers, EMR Implementation — Progress Log, Session 1, Session 2, Session 3

### Community 65 - "EMR Implementation — Task Plan"
Cohesion: 0.33
Nodes (5): Decisions, EMR Implementation — Task Plan, Errors Encountered, Goal, Phases

## Knowledge Gaps
- **198 isolated node(s):** `$schema`, `collection`, `sourceRoot`, `deleteOutDir`, `name` (+193 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **2 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `RequestUser` connect `RequestUser` to `admissions.controller.ts`, `notifications.module.ts`, `RequestsService`, `VisitsService`, `PatientsService`, `appointments.controller.ts`, `requests.service.ts`, `departments.service.ts`, `payment-providers.service.ts`, `IdentityProxyService`, `ReferralsService`, `staff.service.ts`, `tenant-context.ts`, `TenantContext`, `ListQueryDto`, `AuditLogService`, `tags.service.ts`, `CurrentUser`, `request.dto.ts`, `DashboardService`, `list.ts`, `FormDefinitionsController`, `FormSubmissionsController`, `MedicationsController`, `ReferralsController`, `BedsController`, `EncountersController`, `tenantFromUser`, `MessageTemplatesController`, `StaffController`, `TagsController`, `WardsController`, `encounters.service.ts`, `FormSubmissionsService`?**
  _High betweenness centrality (0.207) - this node is a cross-community bridge._
- **Why does `TenantContext` connect `TenantContext` to `admissions.controller.ts`, `notifications.module.ts`, `RequestsService`, `VisitsService`, `PatientsService`, `appointments.controller.ts`, `requests.service.ts`, `departments.service.ts`, `payment-providers.service.ts`, `EmrBaseEntity`, `ReferralsService`, `staff.service.ts`, `tenant-context.ts`, `ListQueryDto`, `tags.service.ts`, `DashboardService`, `list.ts`, `encounters.service.ts`, `FormSubmissionsService`, `CreateBedDto`, `MessageTemplateOrmEntity`?**
  _High betweenness centrality (0.097) - this node is a cross-community bridge._
- **Why does `CurrentUser` connect `CurrentUser` to `admissions.controller.ts`, `notifications.module.ts`, `RequestsService`, `VisitsService`, `PatientsService`, `appointments.controller.ts`, `departments.service.ts`, `payment-providers.service.ts`, `IdentityProxyService`, `staff.service.ts`, `tenant-context.ts`, `tags.service.ts`, `request.dto.ts`, `RequestUser`, `DashboardService`, `FormDefinitionsController`, `FormSubmissionsController`, `MedicationsController`, `ReferralsController`, `BedsController`, `EncountersController`, `tenantFromUser`, `MessageTemplatesController`, `StaffController`, `TagsController`, `WardsController`, `encounters.service.ts`, `FormSubmissionsService`?**
  _High betweenness centrality (0.071) - this node is a cross-community bridge._
- **What connects `$schema`, `collection`, `sourceRoot` to the rest of the system?**
  _198 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `admissions.controller.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.06990622335890878 - nodes in this community are weakly interconnected._
- **Should `notifications.module.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.058469945355191254 - nodes in this community are weakly interconnected._
- **Should `RequestsService` be split into smaller, more focused modules?**
  _Cohesion score 0.08708357685563997 - nodes in this community are weakly interconnected._