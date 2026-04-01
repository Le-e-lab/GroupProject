# UPath - Smart Attendance System

A modern, full-stack university attendance portal for Africa University, allowing students and lecturers to manage attendance digitally through time-based codes and QR scanning.

## Features

### Student Portal

- Dashboard: overview of today's schedule and quick attendance stats.
- Weekly Schedule: full color-coded timetable from live university data.
- Mark Attendance: enter the 6-digit TOTP code shown by the lecturer.
- QR Scanner: scan the lecturer QR code to mark attendance.
- Reports: personal attendance records with charts and at-risk alerts.
- Campus Map: interactive map for navigating university buildings.
- Notifications: view announcements from lecturers.
- Profile: view and manage personal details.

### Student Representative Portal

- Rep Console: manage timetable for program/year.
- Send Announcements: post notifications on behalf of lecturers.
- STUDENT/REP badge: visual indicator of dual role.

### Lecturer Portal

- QR Code Generator: generates a live rotating QR and 6-digit code for active class.
- Online Class notice: notify students with a join link.
- Manual Attendance: mark students present individually for edge cases.
- My Classes: view all assigned classes and schedules.
- Manage Students: view students by course and promote to Student Rep.
- Announcements: post updates (delays, venue changes, cancellations).
- Analytics: visual charts for attendance trends and at-risk students.

### Admin Dashboard

- System Stats: user counts, class counts, attendance summary.
- User Management: list, search, change roles, delete users.
- Timetable Viewer: browse all classes with filters.
- Timetable Upload: preview diff, replace semester timetable, rollback backups.
- Create User: add new students/lecturers/admins.

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
```

Notes:

- `JWT_SECRET` must be at least 32 characters.
- `SEED_DEFAULT_ADMIN` and `DEFAULT_ADMIN_PASSWORD` are optional and should be used carefully.

## Mobile Testing (Ngrok)

To test camera/QR features on a real mobile device:

```bash
ngrok http 3000
```

Use the generated HTTPS URL in your phone browser.

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
| Password | set via `DEFAULT_ADMIN_PASSWORD` when `SEED_DEFAULT_ADMIN=true` |

## Project Structure

```text
GroupProject/
  public/
  server/
  docs/
  DOCUMENTATION.md
  package.json
  timetable.sqlite
```

## Documentation

- [DOCUMENTATION.md](./DOCUMENTATION.md)
- [API Specification](./docs/API_SPEC.md)
- [Security Agent Report](./docs/SECURITY_AGENT_REPORT.md)
- [Implementation Report](./docs/IMPLEMENTATION_REPORT.md)

## Built For

Built for the Group Project Module at Africa University.
