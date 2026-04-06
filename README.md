# UPath - Smart Attendance System

A modern, full-stack university attendance portal for Africa University, allowing students and lecturers to manage attendance digitally through time-based codes and QR scanning.

## Features

### Student Portal

- Dashboard: overview of today's schedule and quick attendance stats.
- Weekly Schedule: full color-coded timetable from live university data.
- Mark Attendance: enter the 6-digit code for check-in and check-out windows.
- QR Scanner: scan lecturer QR for check-in/check-out attendance flow.
- Reports: personal attendance records with charts and at-risk alerts.
- Campus Map: interactive map for navigating university buildings.
- Notifications: view announcements from lecturers.
- Profile: view and manage personal details.

### Student Representative Portal

- Rep Console: manage timetable for program/year.
- Send Announcements: post notifications on behalf of lecturers.
- STUDENT/REP badge: visual indicator of dual role.

### Lecturer Portal

- **QR Code Session Control**: Opens check-in and check-out windows with explicit mode indicators ("Active: Check-in Code" / "Active: Check-out Code") to prevent accidental clicks. Confirmation dialog guards against checkout mistakes.
- **Manual Code Entry**: Students can enter codes displayed on the QR page during attendance windows.
- **Online Class Notice**: Notify students with a join link via Emerald-green notification banner.
- **Manual Attendance**: Mark students present individually for edge cases (override mode).
- **My Classes**: View all assigned classes with session management.
- **Manage Students**: View students by course and promote to Student Rep.
- **Announcements**: Post updates (delays, venue changes, cancellations, live updates).
- **Analytics**: Visual charts for attendance trends and at-risk student identification.

### Admin Dashboard

- **System Stats**: Real-time user counts, class counts, attendance summary, QR sessions, announcements.
- **User Management**: List, search, filter by role, change roles, delete users.
- **Timetable Viewer**: Browse classes with multi-filter (college, program, year, day).
- **Timetable Upload**: Preview file before import, replace semester timetable, restore from backups, rollback on error.
- **Map & Routes**: Admin-mode campus map for route creation, recording, and path copying (students see static routes only).
- **Data Quality**: Detect and resolve duplicate lecturer accounts safely without terminal access.
- **AI Management**: View and manage AI assistant scopes and content policies.
- **Security**: Audit user accounts, device trust status, verification logs.
- **Create User**: Bulk user creation, role assignment automation.

## Setup and Installation

Prerequisites: Node.js v18+

```bash
npm install
npm start
```

The app runs at:

```text
http://localhost:3000
```

## Required Environment

Use a `.env` file in the project root with at least:

```ini
PORT=3000
NODE_ENV=development
DB_DIALECT=sqlite
DB_STORAGE=./timetable.sqlite
SESSION_SECRET=super_secret_upath_key_2026
JWT_SECRET=upath_dev_secret_key_2026_minimum_length_32_ok
ALLOWED_ORIGINS=http://localhost:3000,http://127.0.0.1:3000
IDENTITY_PROVIDER_URL=
IDENTITY_PROVIDER_API_KEY=
IDENTITY_PROVIDER_TIMEOUT_MS=20000
```

Notes:

- `JWT_SECRET` must be at least 32 characters.
- `SEED_DEFAULT_ADMIN` and `DEFAULT_ADMIN_PASSWORD` are optional and should be used carefully.
- If `IDENTITY_PROVIDER_URL` is set, selfie + ID verification calls that provider during device verification.

## Mobile Testing (Ngrok)

To test camera/QR features on a real mobile device:

```bash
ngrok http 3000
```

Use the generated HTTPS URL in your phone browser.

## Features Highlights (v2.1 Stability Update)

### QR & Code Entry Safety

- **Mode Indicators**: Both card and enlarged QR views show "CHECK-IN CODE" or "CHECK-OUT CODE"
- **Checkout Guard**: Confirmation dialog prevents accidental check-out transitions
- **Toast Notifications**: Smooth corner notifications auto-dismiss (no modal blocking)
- **Smart Class Resolution**: Composite class IDs prevent ambiguous course-code-only matches

### Admin & UI Polish

- **Admin Map Panel**: Uses full available height for map; description stays compact
- **AI Widget Overflow Fix**: Panel width optimized to 480px, AI output constrained with proper text wrapping
- **Analytics Compatibility**: Legacy attendance records remain visible; new lifecycle logic is enforced

### Database & Migrations

- **Sequelize CLI Setup**: Baseline migration scaffold for future schema changes
- **Non-Destructive Sync**: SQLite schema changes avoid foreign key issues
- **Audit Trail**: Attendance lifecycle tracked: `checkedInAt`, `checkedOutAt`, `closedAt`

## Sample Credentials

### Ordinary Student

| Field | Value |
| --- | --- |
| School ID | `240102` |
| Password | `password123` |

### Student Representative

| Field | Value |
| --- | --- |
| School ID | `240101` |
| Password | `password123` |

### Lecturer

| Field | Value |
| --- | --- |
| Staff ID | `210153` |
| Password | `staff123` |

### Administrator

| Field | Value |
| --- | --- |
| Admin ID | `admin` |
| Password | `admin123` (default for this environment) |

## Attendance Completion Rule

- Attendance is finalized only when a student successfully completes both check-in and check-out.
- Manual lecturer attendance remains available for edge cases.
- Daily attendance exports include check-in and check-out timestamps.
- Buddy-signing detection flags shared device/IP patterns for lecturers and exports so suspicious multi-account use is easier to review.
- Lecturers can only open/close check-in sessions for classes they are assigned to.
- Student check-in/check-out is rejected for classes outside the student program/year cohort.
- Checkout finalization closes same-day duplicate open attendance rows for the same course to keep active-state views consistent.
- Lecturer manual attendance views should use class-scoped filters (`classId`, `sources=automated`, `state=active`) for accurate current check-ins.
- Manual attendance now requires a specific class variant ID (composite `classId`), so cross-cohort students are not mixed by course code alone.
- Lecturer manual attendance can also load course-wide cohorts (across the lecturer's owned variants) while still saving each student against the correct cohort variant.
- Admin dashboard actions now use in-app UI notifications instead of browser alerts.

## Presentation Q&A

### Q1: How do you prevent fake attendance?
Attendance is only completed after both check-in and check-out are valid. The backend also enforces role checks, class ownership, and cohort eligibility before saving attendance.

### Q2: What happens if a student checks in but forgets to check out?
The record stays incomplete until checkout. Lecturers can still close sessions and use manual attendance override for approved edge cases.

### Q3: How do you stop students from being mixed across different lecturer groups?
The system uses composite class IDs and class-scoped filtering, so course-code-only matches do not merge separate class variants.

### Q4: How do lecturers see suspicious shared-device attendance?
Buddy-signing detection flags repeated device/IP usage across multiple accounts and surfaces the warning in lecturer manual attendance and exports.

### Q5: What is the fallback if verification fails?
Students are directed to lecturer-managed manual attendance override, which keeps the attendance workflow intact for legitimate edge cases.

## Smoke Tests

Run quick production-readiness checks:

```bash
npm run smoke:admin
npm run smoke:attendance
```

Notes:

- `smoke:admin` now always runs authenticated checks by default using `admin/admin123` and lecturer `210153/staff123` unless overridden by environment variables.
- Override credentials when needed:

```bash
ADMIN_TEST_ID=admin ADMIN_TEST_PASSWORD=admin123 npm run smoke:admin
```

- If lecturer QR check-in returns `403 Forbidden`, it usually means the active cookie session is not lecturer/admin (stale account switch). Sign out, sign in as lecturer/admin, then open the QR page again.

## Database Migrations (Sequelize CLI)

Migration tooling is now scaffolded and ready.

```bash
npm run db:migrate
npm run db:migrate:status
npm run db:migrate:undo
```

Notes:

- `.sequelizerc` is configured for `server/migrations` and `server/seeders`.
- `20260402000000-baseline-schema.js` is a non-destructive baseline marker migration.
- Runtime `sync` still exists today; migrations are prepared for controlled schema evolution.
- `timetable.sqlite` is a local runtime file. It is created automatically on first boot and should not be committed.

## Project Structure

```text
GroupProject/
  public/
  server/
  docs/
  DOCUMENTATION.md
  package.json
  timetable.sqlite  # generated locally at runtime
```

## Documentation

- [DOCUMENTATION.md](./DOCUMENTATION.md)
- [API Specification](./docs/API_SPEC.md)
- [Security Agent Report](./docs/SECURITY_AGENT_REPORT.md)
- [Implementation Report](./docs/IMPLEMENTATION_REPORT.md)

## Built For

Built for the Group Project Module at Africa University.
