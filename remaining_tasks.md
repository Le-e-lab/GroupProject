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

- [x] **Progressive Web App (PWA) Support**: `manifest.json` and Service Worker (v5, network-first).
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
- [x] **Lecturer Class Visibility Fix**: `/api/classes/lecturer/:id` now merges ID and name matching so lecturers see complete assigned class lists.
- [x] **QR/Class ID Integrity**: Lecturer QR links now pass composite class IDs (`course-day-time`) to avoid cross-course ambiguity.
- [x] **Check-in Ownership Resolution**: Attendance session open/close now resolves class ownership correctly for lecturer-generated QR sessions.
- [x] **QR Code Mode Indicators**: Explicit "CHECK-IN CODE" / "CHECK-OUT CODE" labels in both card and fullscreen views.
- [x] **Checkout Safety Guard**: Confirmation dialog prevents accidental check-out button clicks.
- [x] **Toast Notification System**: QR notifications use corner auto-dismiss toasts instead of blocking modals.
- [x] **Admin Map Panel Optimization**: Map iframe now uses flexbox for full-height rendering.
- [x] **AI Widget Overflow Fix**: Reduced panel width, added max-width constraints, proper text wrapping on output.

## 🟢 Low Priority (Polish & Scaling)

- [x] **Database Migration System**: Sequelize migrations scaffolded via `.sequelizerc` and baseline migration applied.
- [ ] **End-to-end Tests**: Cypress/Playwright automated test suite for critical user flows.
- [ ] **Performance Profiling**: Browser DevTools audit for rendering and memory optimization.

## ✅ Completed Features

- [x] **Student Rep Role**: Lecturers can promote students to `student_rep`. Reps get access to **Rep Console** with timetable editing and announcement posting.
- [x] **Admin Dashboard**: Full system administration with stats, user management, timetable viewer, and create-user form.
- [x] **Input Validation & Sanitization**: `validator` npm package applied to all backend routes.
- [x] **"Online Class" Notification Type**: Emerald green notification banner.
- [x] **Auto-Seed on Boot**: Fresh databases are fully populated automatically.
- [x] **No-Cache Headers**: Server-side cache prevention ensures fresh content.

---
*Generated following the codebase audit. Last updated: Apr 2026.*
