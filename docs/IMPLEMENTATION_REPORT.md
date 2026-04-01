# UPath Implementation Report

Owner: Luke Team (Architecture Planner, Backend Security Specialist, UI UX Design Specialist, Frontend Implementation Specialist)
Date: 2026-04-01
Scope: Security hardening, backend reliability, admin upload workflow, map UX reliability, and smoke validation.

## Security Summary

- Enforced strong JWT secret policy and removed fallback secret behavior.
- Added server-side RBAC for sensitive auth, users, attendance, and debug flows.
- Added identity-aware rate limiting for API bursts, login brute-force, and attendance code attempts.
- Added CSP and hardening headers via Helmet with map/CDN compatibility.
- Disabled debug routes by default and gated them behind admin auth when enabled.
- Made default admin seeding explicit opt-in with password requirements.

## Backend Summary

- Aligned attendance API contracts and added missing manual mark endpoint.
- Fixed class create/update writes to the timetable schema fields.
- Added admin timetable upload pipeline with:
  - file parsing and validation,
  - preview mode,
  - full replacement upload,
  - upload history logs,
  - backup snapshots,
  - rollback endpoint.
- Added class-list export for manual attendance workflows.

## Design and UX Summary

- Improved admin dashboard consistency for upload/status/history sections.
- Added upload checklist and clear visual status cards.
- Added map alias handling and building detection.
- Added live tracking and dynamic rerouting from current GPS position.

## Smoke Validation Summary

- Syntax and diagnostics checks passed for touched runtime files.
- RBAC checks passed:
  - lecturer access to admin upload endpoints returns 403 as expected.
- Attendance and auth path checks completed in previous smoke cycle and documented.
- Admin smoke script added:
  - `npm run smoke:admin`

## Remaining Risks and Recommended Next Steps

- Add progressive lockout escalation and optional challenge flow for repeated auth failures.
- Add CI-integrated smoke tests for admin upload, rollback, and RBAC.
- Add security event logs for privileged actions (role changes, deletes, rollbacks).
