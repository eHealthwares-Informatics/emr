# EMR Implementation — Findings

## rxsoft-backend layout essentials (source of truth for emr/)
- `src/main.ts`: ValidationPipe(whitelist, transform, forbidNonWhitelisted), GlobalExceptionFilter, RequestLoggingInterceptor, global prefix `api`, CORS, Swagger at `/api/docs` + writes `swagger.yml`, seed on boot.
- `src/app.module.ts`: ConfigModule global, TypeOrmModule.forRootAsync (DB_TYPE/DB_HOST/DB_PORT/DB_USER/DB_PASSWORD/DB_NAME/DB_SYNCHRONIZE/DB_DROP_SCHEMA), APP_INTERCEPTOR AuditLogInterceptor, DatabaseSeedService provider.
- `src/common/`: decorators (current-user, permissions, roles, audit-action), guards (jwt-auth, permissions, roles), filters (global-exception with PG error codes), interceptors (request-logging with requestId+masking, audit-log), tenant-context.ts (`tenantFromUser`).
- `src/shared/`: constants (persistence-scope.ts DEFAULT_STORE_ID/DEFAULT_UOM_ID), domain (types.ts + mappers.ts), dto (list-query.dto.ts with page/limit/search/sortBy/sortOrder/filter/organizationId), utils.
- `src/database/`: list.ts (applyFilters qb helpers), seeding.service.ts (STUB in rxsoft-backend — EMR will implement real SEED_ON_START), seeds/.
- Modules (Pattern B): `entities/*.orm-entity.ts`, `dto/*.dto.ts`, `services/*.service.ts`, `controllers/*.controller.ts`, `{name}.module.ts` with TypeOrmModule.forFeature. Domain types in shared/domain + toXType mappers.
- JWT guard secret default `rxsoft-access-secret` (rxsoft-backend) vs `admin-access-secret` (lis). Identity issues JWT_ACCESS_SECRET.
- Users-proxy pattern: HttpService → IDENTITY_SERVICE_URL, forward Bearer or x-api-key INTERNAL_API_KEY, AppCacheService caching.

## rxsoft-identity status
- users: fully implemented (use cases, UserRepository). endpoints GET/POST/PUT/DELETE /users, PATCH /users/:id/roles.
- organizations: STUB (returns {data:[]}, payload echo).
- locations: STUB (returns {data:[]}).
- LocationOrmEntity: id, organization_id, code, name, parent_id, is_active, timestamps.
- OrganizationOrmEntity exists in entities/.
- Identity on port 8092, DB `identity`, same PG instance. DB_SYNCHRONIZE=true default.

## LIS integration contract
- POST `{LIS}/lis/orders` CreateOrderDto: patientId, patientName, patientAge?, patientGender?, patientDateOfBirth?, priorityId?, requestedDate?, requesterName?, requesterPhone?, diagnosis?, clinicalNotes?, notes?, items:[{testDefinitionId, notes?}], stepProgress?, samples?.
- LIS base URL from env; frontend uses VITE_LIS_API_URL=http://localhost:8002.

## Pharmacy integration contract
- rxsoft-backend `POST /website/orders` (cart-based order). website.controller.ts @Controller('website'), @Post('orders').
- Prescription entity exists (website) but is patient-upload based (user/phone/email + files) — not clinical line items. EMR Rx integration maps to /website/orders; exact payload to confirm at impl time.

## Frontend (rxsoft-admin-3)
- lib/*-api.ts: axios instance + refresh interceptor (copy lis-api.ts), env VITE_<MOD>_API_URL.
- module-data.ts: ModuleId + ModuleDefinition (apiProvider, root, routes, resources). moduleMap + getModuleRoot.
- sidebar-data.ts: SidebarData with nav groups + filterNavGroupsByModule.
- Routes: file-based under src/routes/_authenticated/<module>/; custom pages use DataPageShell + ModelConfig OR custom components; LIS orders uses OrderWorkflowLayout/OrderStepper/OrderContext (model for Visit Workspace).
- ModelConfig dynamic CRUD: features/components/page/data-page-shell.tsx + data-page-form.tsx, features/shared/model-schema.ts.
- Identity API: VITE_IDENTITY_API_URL=http://localhost:8092.
- Env example .env.local has VITE_* URLs. Modules need VITE_EMR_API_URL added.

## Image attachments
- User attached emr.png + screenshot — MODEL CANNOT READ IMAGES. Design follows OpenMRS reference app (esm-appointments-app, esm-active-visits-app, esm-patient-chart-app, esm-form-engine-app, esm-patient-orders-app).
