# EMR Implementation — Task Plan

## Goal
Build EMR backend (`/Users/john/develop/rxsoft/emr`) + frontend (`rxsoft-admin-3`) for the workflow **appointment → visit → encounter → notes (dynamic forms) & requests (Prescriptions/Lab/Rad/Other Tests)**, OpenMRS-reference UX. rxsoft-backend layout. Users/orgs/locations live in rxsoft-identity (complete its org/location stubs).

## Decisions
- Backend: NestJS + TypeORM + PostgreSQL only, port 8093, `DB_NAME=emr`, rxsoft-backend layout (Pattern B modules)
- Identity: EMR references users/orgs/locations via JWT claims + `identity-proxy`; complete rxsoft-identity organizations + locations CRUD
- Integrations: Lab→LIS (`POST {EMR_LIS_API_URL}/lis/orders`), Rx→pharmacy (`POST {EMR_PHARMACY_API_URL}/website/orders`)
- Frontend: OpenMRS-style screens; Visit Workspace stepper modeled on LIS OrderWorkflowLayout
- Tests: integration tests + workflow e2e against real PG

## Phases
- [x] Phase 0: planning files + research
- [x] Phase 1: Scaffold emr/ backend (config, common, shared, database, main, app.module)
- [ ] Phase 2: Complete rxsoft-identity organizations + locations CRUD
- [x] Phase 4a: Backend dashboard module (metrics endpoint)
- [ ] Phase 4: Backend integration tests + workflow e2e
- [x] Phase 5a: Frontend emr module scaffold — emr-api client, module/sidebar registration, EMR dashboard page per design spec, generic resource list pages + 6 routes
- [ ] Phase 5: Frontend CRUD pages, visit workspace, form builder
- [ ] Phase 6: End-to-end verification (build, tests, lint)

## Errors Encountered
| Error | Attempt | Resolution |
|-------|---------|------------|
| Relative import depth (entity/DTO files used `../` instead of `../../` for base entity and shared) | Build after scaffold | Fixed all entity/dto imports to correct depth |
| Union types used as values in `@IsEnum`/`enum:` decorators | Build | Converted `enums.ts` to const-array pattern (`APPOINTMENT_TYPES` etc.) + derived union types |
| TS1272 `import type` for type-only unions in decorated signatures | Build | Split DTO/entity imports: value arrays as regular imports, union types as `import type` |
| `ExpressRequest` flagged TS1272 in controller | Build | Changed to `import type` |
| AppointmentsService.create expected 3 args, controller passed 2 | Build | Added `user` arg to call |
| FormCategory imported from wrong module in form-definition entity | Build | Moved to `enums` import |
| JSX in `.ts` file (emr-resources) | typecheck | Renamed to `emr-resources.tsx` |
| Wrong import path (resource-page) + unused imports/params + `curly` rule in emr frontend files | lint/typecheck | Fixed imports, removed `HeartPulse`, `handleAction` param, added braces |
| Pre-existing `yarn build` failures (damorex Grid `gutter`, lis schema Option/Column) | build | NOT FIXED — unrelated to EMR, present without my changes |
