# Changelog — emr

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased] - 2026-10-25

### Added
- Annotate field type for forms (body-map, dermatome, organ catalog)
- OAuth proxy endpoints for Google/Facebook sign-in

### CI/CD
- Base freshness guard: fail PR whose base is stale (silent-revert guard)

---

## [28ab2f2] - 2026-10-25

### Added
- Annotate field type for forms
- OAuth proxy endpoints

---

## [8a46381] - 2026-10-24

### CI/CD
- Merged base freshness guard (PR #9)
- Check out PR head, not merge commit
- Fail PR whose base is stale (rxsoft-qa#801)

---

## [fc5028a] - 2026-10-23

### Added
- Merged EMR OAuth feature (PR #8)

---

## [0b1d344] - 2026-10-22

### Added
- Auth proxy: Google/Facebook OAuth sign-in for Prognocare (EMR channel)

---

## [b976c2d] - 2026-10-21

### Fixed
- Guards: require JWT_ACCESS_SECRET from env, remove hardcoded fallback

---

## [56859be, 2d2c64e] - 2026-10-20

### Added
- Visits: auto-create appointment on visit create (PR #7)

---

## [58b51dd] - 2026-10-19

### Chore
- Swagger regeneration
- Seed service tweaks

---

## [c21ca51, 6519ed7] - 2026-10-18

### Added
- In-app notifications + message templates (Phase 1) (PR #5, #6)

### Fixed
- Notifications: accept optional org/location on subscribe DTO
- Notifications: use TypeORM property paths in orderBy

---

## [011aabe] - 2026-09-29

### Chore
- Local changes snapshot

---

## [2f77fe3] - 2026-09-28

### Fixed
- Default encounter status to ACTIVE for schema sync on existing rows

---

## [1234f5a] - 2026-09-27

### Added
- Medications module
- Referrals module
- External request sync module

---

## [672b7b5] - 2026-09-26

### Chore
- Add missing tsconfig.build.json for Docker build