# EMR — Use Cases

The Electronic Medical Record (EMR) covers patient administration, clinical workflow
(appointments → visits → encounters), dynamic documentation (forms), clinical orders
(requests), staff management, and an audit trail. This document outlines every use case
implemented in the EMR service (`emr/`) and its frontend (`frontend/src/features/emr`).

**Actors**

| Actor | Description |
|---|---|
| Receptionist | Registers patients, schedules/manages appointments, checks patients in |
| Clinician | Runs visits and encounters, records documentation, orders clinical requests, writes notes |
| Nurse | Records vitals and nursing documentation |
| Staff admin | Manages staff records, roles, departments, identity-user links |
| Form designer | Builds and publishes dynamic form definitions |
| Auditor / supervisor | Reviews request lifecycles, patient changes, audit trail |
| System (identity) | Identity service providing users, locations, organizations |

---

## 1. Patients

| ID | Use case | Actor | Flow | Endpoints |
|---|---|---|---|---|
| UC-01 | **Register a patient** | Receptionist | Fill demographics (names, gender, DOB, contact, next of kin, blood group/genotype, identifiers). MRN auto-generated if not supplied; duplicate MRN rejected. | `POST /patients` |
| UC-02 | **Search patients** | Anyone | Debounced search by name / MRN / phone with pagination; list rows navigate to the profile. | `GET /patients?search=&page=` |
| UC-03 | **Open patient profile** | Anyone | Full demographics card, history tabs (Appointments, Visits, Encounters, Requests, Documentation), Schedule & Edit actions. | `GET /patients/:id` |
| UC-04 | **Edit demographics** | Receptionist | Pre-filled edit modal; PATCH sends only changed fields; dirty-state guard prompts before discarding unsaved changes. Edits are audited with a field-level diff. | `PATCH /patients/:id` |
| UC-05 | **Look up a patient by MRN** | Anyone | Sidebar "Find patient by MRN" or deep links resolve an MRN to the patient UUID and open the profile. | `GET /patients/by-mrn/:mrn` |
| UC-06 | **Schedule from the profile** | Receptionist | Profile opens the appointment modal pre-filled with the patient; new appointments appear in the tab. | (see UC-10) |

## 2. Staff

| ID | Use case | Actor | Flow | Endpoints |
|---|---|---|---|---|
| UC-07 | **Register staff** | Staff admin | Record staff number (auto), names, email/phone, hire date, role type (Doctor/Nurse/Technician/Therapist/Admin/Support), category, department, identity location id, and optionally the identity-service **user id** so login data is not duplicated. | `POST /staff` |
| UC-08 | **Manage staff records** | Staff admin | Searchable list (name/number/email/department) with role/category/department/active filters; row menu opens a pre-filled edit modal (with dirty-state guard). | `GET /staff`, `PATCH /staff/:id` |
| UC-09 | **Select a provider** | Clinician/Receptionist | Any provider field (appointment, visit, encounter, request) is a searchable staff picker; selection stores both `providerId` and `providerName`. Inactive staff are hidden. | `GET /staff?search=&isActive=true` |

## 3. Appointments

| ID | Use case | Actor | Flow | Endpoints |
|---|---|---|---|---|
| UC-10 | **Schedule an appointment** | Receptionist | Pick patient (searchable), type, priority, date/time, provider (staff picker), reason (autocomplete of previous reasons), notes. | `POST /appointments` |
| UC-11 | **Check in a patient** | Receptionist | Row action; auto-starts the visit for the appointment (status → CHECKED_IN). | `POST /appointments/:id/check-in` |
| UC-12 | **Complete an appointment** | Clinician | Marks IN_PROGRESS appointment complete. | `POST /appointments/:id/complete` |
| UC-13 | **Mark no-show** | Receptionist | For SCHEDULED appointments. | `POST /appointments/:id/no-show` |
| UC-14 | **Cancel with reason** | Receptionist | Reason captured and recorded; available while not in progress/completed. | `POST /appointments/:id/cancel` |
| UC-15 | **Edit an appointment** | Receptionist | Update open appointments (date, provider, notes…). | `PATCH /appointments/:id` |

## 4. Visits

| ID | Use case | Actor | Flow | Endpoints |
|---|---|---|---|---|
| UC-16 | **Start a visit** | Receptionist | Patient picker, visit type, provider (staff picker), start datetime. Check-in can auto-start a visit. | `POST /visits` |
| UC-17 | **End a visit** | Clinician | Row action on ongoing visits; records stop datetime. | `POST /visits/:id/end` |
| UC-18 | **Cancel a visit** | Clinician | Row action for ongoing visits. | `POST /visits/:id/cancel` |
| UC-19 | **View visit detail** | Anyone | Visit header (patient link, provider, start/end), linked **encounters** and **requests** for that visit; rows navigate to their detail pages. Reached from the visits list, encounter detail, or request detail. | `GET /visits/:id`, `GET /encounters?visitId=`, `GET /requests?visitId=` |

## 5. Encounters

| ID | Use case | Actor | Flow | Endpoints |
|---|---|---|---|---|
| UC-20 | **Record an encounter** | Clinician | Patient, encounter type, provider (staff picker), datetime, reason (autocomplete), notes. | `POST /encounters` |
| UC-21 | **Time an active encounter** | Clinician | "Record & Start Timer" begins a live HH:MM:SS counter from `encounterDatetime`; persists in localStorage across navigation/reload; rows started today show per-row elapsed timers. | — (client) |
| UC-22 | **View encounter detail** | Anyone | Encounter header (patient link, visit link, provider, datetime, reason/notes) plus a **Documentation tab**. | `GET /encounters/:id` |
| UC-23 | **Deep-link across records** | Anyone | Encounter detail links to its patient and visit; request detail links to its encounter and visit; patient profile links to requests and encounters. | — (client) |

## 6. Documentation (dynamic forms)

| ID | Use case | Actor | Flow | Endpoints |
|---|---|---|---|---|
| UC-24 | **Build a form definition** | Form designer | Visual builder: metadata (name/code/category/description), field editor with 13 types incl. containers (**Section**, **Tab**, **Column**), drag-and-drop reorder, duplicate field, live preview, and a raw **JSON** view (apply/discard). | `POST /form-definitions` |
| UC-25 | **Edit a form definition** | Form designer | Edit metadata/schema; backend auto-bumps the version when the schema changes. | `PATCH /form-definitions/:id` |
| UC-26 | **Publish / unpublish** | Form designer | Publish makes a form available for documentation; unpublish hides it. | `POST /form-definitions/:id/publish`, `POST /form-definitions/:id/unpublish` |
| UC-27 | **Create documentation** | Clinician | Popup lists **published forms the user may access** (server-enforced via `form_access` table + `GET /forms/available`); patient pre-filled from active encounter / profile / visit; dynamic form renders schema (text, numbers, dates, selects, checkboxes, tables, sections, tabs, columns); Save Draft or Submit. | `GET /forms/available`, `POST /form-submissions` |
| UC-28 | **View a submission** | Anyone | Schema-labeled field values; amendments count + version navigation (Original → Amend 1 → …); Print / PDF. | `GET /form-submissions/:id`, `GET /form-submissions/:id/chain` |
| UC-29 | **Amend a submission** | Clinician | Pre-filled dynamic form; creates a new submission preserving the original (amend chain). | `POST /form-submissions/:id/amend` |
| UC-30 | **Print / export a submission** | Clinician | Frontend print view **or** backend-generated PDF from an HTML template. | `GET /form-submissions/:id/pdf` |
| UC-31 | **Review encounter documentation** | Clinician | Encounter Documentation tab lists submissions for the encounter with inline key-field summaries, View/Amend actions. | `GET /form-submissions?encounterId=` |
| UC-32 | **Review patient documentation** | Anyone | Profile Documentation tab lists the patient's submissions; "New Documentation" opens the popup pre-filled. | `GET /form-submissions?patientId=` |
| UC-33 | **Review request-linked documentation** | Clinician | Request detail Documentation tab lists submissions linked via the request's encounter or visit. | `GET /form-submissions?encounterId=&visitId=` |

## 7. Clinical Requests

| ID | Use case | Actor | Flow | Endpoints |
|---|---|---|---|---|
| UC-34 | **Create a request** | Clinician | Patient, type (Prescription/Lab/Radiology/Other test), priority, ordering provider (staff picker), diagnosis, notes, and dynamic line items (name, code, dose, frequency, route, qty, instructions). LAB/PRESCRIPTION requests sync externally. | `POST /requests` |
| UC-35 | **Transition request status** | Clinician | Backend-enforced rules: REQUESTED → IN_PROGRESS/COMPLETED/CANCELLED/REJECTED; IN_PROGRESS → COMPLETED/CANCELLED/REJECTED; cancel/reject require a reason. Each transition is recorded on the timeline **and** in `audit_logs` with structured metadata. | `POST /requests/:id/transition` |
| UC-36 | **Append a note** | Clinician | Free-text note on the request timeline without changing status; recorded with actor + timestamp. | `POST /requests/:id/note` |
| UC-37 | **View request detail** | Anyone | Header (patient/encounter/visit links, provider, external order id/reference with copy-to-clipboard), Activity timeline (transitions + notes), line items, sync status, Documentation tab. | `GET /requests/:id`, `GET /requests/:id/history` |
| UC-38 | **Re-sync to external system** | Clinician | LAB/PRESCRIPTION requests re-run external sync; sync status (NONE/PENDING/SYNCED/FAILED) and errors surface live, also in the list. | `POST /requests/:id/sync` |
| UC-39 | **Review request lifecycle from a patient** | Anyone | Profile Requests tab rows open the detail page; Timeline action opens the modal with the full chain. | `GET /requests/:id/history` |
| UC-40 | **Update an open request** | Clinician | Open (non-terminal) requests can be edited incl. line items. | `PATCH /requests/:id` |

## 8. Audit trail

| ID | Use case | Actor | Flow | Endpoints |
|---|---|---|---|---|
| UC-41 | **Attribute request changes** | Auditor | Every request creation, status transition, and note lands in `audit_logs` (`request.created`, `request.status_transition`, `request.note_added`) with actor, org, and structured metadata (from/to status, reason). | — (backend) |
| UC-42 | **Attribute patient edits** | Auditor | `patient.created` / `patient.updated` events with a per-field `{ from, to }` diff. | — (backend) |
| UC-43 | **HTTP-level audit** | Auditor | All non-GET requests are also recorded by the interceptor (method, path, status, duration, IP, user agent). | — (backend) |

## 9. Access control & cross-cutting

| ID | Use case | Actor | Flow | Endpoints |
|---|---|---|---|---|
| UC-44 | **Control form access** | Staff admin | `form_access` table maps user/role → form codes (wildcard for all); seeded defaults (super_admin/admin all, clinician → CLINICAL_NOTE+VITALS, auditor → VITALS); users with no rows default to all published forms. | `GET /forms/available` |
| UC-45 | **Authenticate via identity** | All | JWT auth; identity-proxy resolves users/locations/organizations from the identity service (`IDENTITY_SERVICE_URL`, defaults to production). | — |
| UC-46 | **Dashboard overview** | Anyone | Daily metrics (appointments by status, provider load, upcoming list). | `GET /dashboard` |

---

## Operational notes

- The EMR service runs from `emr/dist` (`node dist/main`) with TypeORM `synchronize` on —
  new tables (`staff`, `form_access`, `request_status_history`, …) are created on restart.
- Backend changes require a service restart; the pending `emr_*` → unprefixed table rename
  must run **before** the next restart (see earlier change notes).
- Form definitions are stored with `schemaJson`; field keys are globally unique and the
  schema validator (schema + data) is mirrored client-side in the dynamic renderer.
