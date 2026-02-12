# Attendance System Documentation

## Overview
This document explains the technical implementation of the Group Project Attendance System, including recent fixes for mobile responsiveness, camera access, backend validation, and analytics.

---

## 1. System Architecture

### Backend (Node.js + Express + Sequelize)
- **Database**: SQLite (`database.sqlite`) via Sequelize ORM.
- **Authentication**: Custom JWT/Session-based (mocked for demo).
- **API**: RESTful endpoints in `server/routes/`.

### Frontend (HTML5 + Vanilla JS)
- **Styling**: Custom CSS variables (`index.css`) for consistent theming.
- **Logic**: `api.js` handles all server communication.
- **Libraries**: `html5-qrcode` (Scanning), `Chart.js` (Analytics).

---

## 2. Key Features & Workflows

### A. Generating the Code (Lecturer Side)
1.  **Lecturer Dashboard**:
    *   Lecturer selects a class and clicks **"Generate QR"**.
2.  **Server Logic (`POST /api/attendance/generate-code`)**:
    *   Checks for an existing active session.
    *   If none, creates a new session with a 2-hour expiry.
    *   Returns a **TOTP-based 6-digit code**.

### B. Marking Attendance (Student Side)
1.  **Scanning QR (`scan_qr.html`)**:
    *   Uses **rear camera** by default (`facingMode: "environment"`).
    *   Requires **HTTPS** (via Ngrok) on mobile.
2.  **Manual Entry (`enter_code.html`)**:
    *   Fallback for checking in without a camera.
3.  **Validation (`POST /api/attendance/validate-code`)**:
    *   Verifies the code against the active session.
    *   Records attendance in the `Attendances` table.
    *   **Fix**: Uses `userId` (Student ID) to link records correctly.

### C. Analytics (Lecturer Dashboard)
1.  **Dashboard Load**:
    *   Fetches course stats via `GET /api/attendance/stats/course/:courseId`.
2.  **Aggregation Logic**:
    *   Calculates **Total Sessions** (unique dates).
    *   Calculates **Total Students** (enrolled in program).
    *   Calculates **Average Attendance** %.
    *   **Fix**: Correctly aggregates data using `userId` and `classId` fuzzy matching.

---

## 3. Recent Fixes & Improvements

### ✅ Backend Fixes
*   **Column Name Mismatch**: Fixed `studentId` -> `userId` in `attendance.js` (Stats and Today's Attendance routes).
*   **Analytics Route**: Implemented missing `/api/attendance/stats/course/:courseId` endpoint.
*   **Duplicate Classes**: Added deduplication logic to `classes.js` to prevent schedule clutter.

### ✅ Mobile Support
*   **Ngrok Support**: Documented setup for testing on mobile devices via public URL.
*   **Camera & Location**: Optimized for mobile browsers (HTTPS requirement, optional geolocation).

---

## 4. Setup & Testing

### Running Locally
```bash
npm install
npm start
# Visit http://localhost:3000
```

### Running on Mobile (Ngrok)
```bash
ngrok http 3000
# Copy https://....ngrok-free.app URL
```

---

## 5. Troubleshooting

- **"Camera not working"**: Ensure you are using the **https** Ngrok URL, not http.
- **"Network Error"**: Check if `api.js` base URL is correct (should be relative `/api`).
- **"Database Error"**: Check server console for SQL constraints (e.g., `userId` mismatches).
