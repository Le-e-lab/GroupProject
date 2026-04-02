# Code Improvements And Optimization Opportunities

Generated: April 2, 2026
Status: Post v2.1 Stability Update

## Summary

UPath is stable for core attendance workflows.
This plan focuses on maintainability, performance, and reliability.
Priority 4 is intentionally paused for now.

## Priority 1: Critical Performance

### 1.1 Backend Route Refactoring

The file `server/routes/attendance.js` currently contains mixed concerns.
The implementation should be split into `sessions.js`, `validation.js`, `analytics.js`, and `exports.js` under `server/routes/attendance/`.
This will improve readability, reduce merge conflicts, and make test ownership clearer.

### 1.2 Frontend Bundle Optimization

The files `public/pages/student/map.html` and `public/dashboard.html` are very large and include heavy inline scripts.
The recommended direction is to move page logic into `public/js/pages/` modules.
This improves cache reuse and reduces HTML payload size.

## Priority 2: Code Quality

### 2.1 Centralize API Methods In api.js

Direct fetch logic is duplicated across pages.
All page-level data calls should be routed through `API.*` wrappers to keep credentials, error handling, and retries consistent.
Current sprint progress already includes new attendance helper methods in `public/js/api.js` and usage in `manual_attendance.html`.

### 2.2 Add Input Validation Layer

Input validation is currently distributed manually across route handlers.
Introduce schema validation first on attendance endpoints for `bulk-mark`, `checkin`, and `checkout` payloads.
Either `zod` or `joi` can be used.

### 2.3 Extract Service Layer

Business logic is still embedded in several route files.
Create `server/services/attendance.service.js`, `class.service.js`, `user.service.js`, and `notification.service.js` and delegate route operations to these services.

## Priority 3: Testing And Reliability

### 3.1 Unit Tests

Start with attendance lifecycle, lecturer ownership checks, student cohort checks, and device trust checks.
The target is at least 60 percent coverage for backend critical paths.

### 3.2 Integration Tests

Add integration tests for these flows: student eligibility checks, lecturer ownership checks, manual attendance lock behavior, non-blocking notification actions, and full-height admin map tab rendering.

### 3.3 Load Testing

Run controlled load simulations for concurrent student attendance submissions, lecturer session open bursts, and admin timetable uploads.
Use K6 or Artillery.

## Priority 4: DevOps And Deployment

Paused for now.

## Current Sprint Quick Wins Implemented

Notification clear on student notifications page now uses a two-step in-app toast flow instead of browser confirm.
Notification join action now uses toast feedback and URL extraction instead of browser alert.
Admin map tab now has full-height sizing and refresh logic on tab open.
Manual attendance clear now preserves already checked-in students and prevents re-saving locked check-ins.

## Current Risks

Browser popup APIs still exist in several other pages and should be removed incrementally.
The attendance route file remains large until Priority 1 extraction is completed.

## Next Implementation Slice

Implement attendance session route extraction into `server/routes/attendance/sessions.js`.
Add schema validation middleware for attendance payloads.
Add integration tests for map tab height, notification non-blocking actions, and manual attendance lock behavior.

Last updated: Apr 2026
