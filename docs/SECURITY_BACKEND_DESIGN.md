# Security Backend Design

## Purpose

Define backend security controls for authentication, authorization, attendance integrity, and production hardening in UPath.

## Security Objectives

- Prevent unauthorized attendance actions.
- Ensure attendance is only complete after valid check-in and check-out.
- Restrict lecturer actions to their own classes.
- Block students from checking into classes outside their course cohort.
- Enforce device trust and identity verification before completion.
- Reduce abuse via rate limiting and strict input validation.

## Trust Boundaries

- Client browser/mobile app: untrusted.
- API server: trusted enforcement layer.
- Database: trusted storage, protected by API controls.
- External identity provider: conditionally trusted, accessed through guarded adapter.

## Auth and Session Model

- Auth uses JWT in HTTP-only cookies.
- Cookie flags are configured by environment and constrained for browser compatibility.
- All attendance routes are protected by auth middleware.
- Session tokens include user id and role and are validated server-side on each request.

## RBAC Policy

- `student` and `student_rep`:
  - Can submit attendance only for self in student validation routes.
  - Can read own attendance data.
- `lecturer`:
  - Can open/close check-in and check-out only for classes they own.
  - Can view class attendance and perform manual attendance override paths.
- `admin`:
  - Can manage all classes/users and operational controls.

## Attendance Integrity Controls

### Session Lifecycle

- `checkin` opens session state `checkin_open` with TOTP check-in secret.
- `checkout` opens session state `checkout_open` with TOTP check-out secret.
- `close` marks session `closed` and expires it immediately.

### Completion Rule

Attendance is considered complete only when all are true:

- status is `present`
- `checkedInAt` is set
- `checkedOutAt` is set

Reporting and export endpoints must filter by this completion rule for finalized attendance analytics.

### Lecturer-Class Binding

For session-open/close operations:

- Resolve class by composite class id (`course-day-time`) when provided.
- Verify lecturer ownership (`LecturerId`) before action.
- Reject with `403` if lecturer attempts another lecturer class.

### Student-Class Eligibility

For check-in/check-out validation:

- Resolve target class.
- Resolve student record.
- Validate student cohort against class cohort (`program` and year parsed from `Year_Semester`).
- Reject mismatches with `403`.

## Device Trust and Identity Verification

- Device fingerprint generated from user-agent and source IP hash.
- New/unknown devices are marked untrusted and require verification.
- Checkout is blocked for untrusted or verification-required devices.
- Verification attempts are logged without storing raw photo payloads.
- Optional external identity provider is used through `server/utils/identityVerification.js`.

## Abuse Mitigation

- Rate limit login and attendance validation attempts.
- Validate and sanitize request inputs (`validator` usage and strict parsing).
- Return explicit error states without exposing internal secrets.
- Keep role checks and identity checks server-side only.

## Operational Hardening

- Use non-destructive schema alter strategy on SQLite (`alter: { drop: false }`) to avoid destructive FK failures.
- Enable CORS allowlist in strict environments.
- Keep large payload limits only where needed for identity verification images.
- Maintain audit logs for admin-sensitive operations.

## API Security Requirements

- Never trust client role claims; always use token claims from middleware.
- Never accept attendance completion from client flags alone.
- Every attendance mutation must verify actor, target class, and target student constraints.
- Manual override remains an explicit lecturer/admin path, separate from student check-in routes.

## Verification Checklist

- Lecturer can open check-in for owned class only.
- Lecturer is denied when opening another class.
- Student is denied when class program/year does not match.
- Untrusted device is blocked from checkout until verification.
- Export headers include check-in/check-out timestamps and completion marker.
- Session close endpoint transitions active session to closed/expired state.
