# UPath: Remaining Tasks & Future Improvements

Following a comprehensive audit of the frontend (`public/*`), backend (`server/*`), and database seeds, the core application is highly functional, stable, and populated with realistic data.

There are no explicit `TODO`, `FIXME`, or `HACK` comments remaining in the codebase that block current functionality. However, to bring the project from a "feature-complete beta" to a "production-ready enterprise application," the following tasks are recommended:

## 🔴 High Priority (Production Readiness)

- [x] **Database Persistence for Announcements**: Notifications are stored in SQLite via the `Announcement` Sequelize model.
- [x] **Environment Variables (`.env`)**: Sensitive config uses `dotenv`.
- [x] **Rate Limiting**: Added `express-rate-limit` (disabled for Campus Wi-Fi shared IP).
- [x] **Online Classroom Support ("Join Links")**: "Online Class" button on QR Code page.
- [x] **Auto-Seeding**: Server auto-seeds all data (lecturers, classes, students, attendance) from `server/data/` on first boot.
- [x] **Program Mapping**: Classes use real program names from parsed timetable for correct student-class matching.
- [x] **All Models Synced**: Users, Attendance, Sessions, Classes (timetable), and Announcements tables created automatically.

## 🟡 Medium Priority (User Experience & Reliability)
- [x] **Progressive Web App (PWA) Support**: `manifest.json` and Service Worker (v4, network-first).
- [x] **Memory Leak Prevention on QR Codes**: Expired sessions auto-purged every hour.
- [x] **Dedicated Notification History**: `notifications.html` for viewing announcements.
- [x] **Database Storage Limits**: Announcements older than 7 days auto-purged.
- [x] **Input Validation & Sanitization**: `validator` npm package on all routes.
- [x] **"Online Class" Lecturer Notification**: Emerald-green "ONLINE CLASS" banner.
- [x] **Student Rep QR Scanning**: Reps can scan QR codes for attendance (treated as students).
- [x] **Attendance Seeding Includes Reps**: `student_rep` users get demo attendance records.
- [x] **Class Deduplication**: API routes filter duplicate class entries and invalid day values.
- [x] **Course-Based Filtering**: Manage Students page filters by course instead of program.
- [x] **Service Worker Cache Fix**: Ignores `chrome-extension://` URLs, uses network-first strategy.

## 🟢 Low Priority (Polish & Scaling)

- [ ] **Database Migration System**: Transition to proper Sequelize Migrations (using `sequelize-cli`) so schemas can be updated without dropping data.
- [ ] **Accessibility (A11y) Audit**: Run Lighthouse for WCAG AAA compliance.
- [ ] **Dockerization**: Create a `Dockerfile` and `docker-compose.yml`.

## ✅ Completed Features

- [x] **Student Rep Role**: Lecturers can promote students to `student_rep`. Reps get access to **Rep Console** with timetable editing and announcement posting.
- [x] **Admin Dashboard**: Full system administration with stats, user management, timetable viewer, and create-user form.
- [x] **Input Validation & Sanitization**: `validator` npm package applied to all backend routes.
- [x] **"Online Class" Notification Type**: Emerald green notification banner.
- [x] **Auto-Seed on Boot**: Fresh databases are fully populated automatically.
- [x] **No-Cache Headers**: Server-side cache prevention ensures fresh content.

---
*Generated following the codebase audit. Last updated: Feb 2026.*
