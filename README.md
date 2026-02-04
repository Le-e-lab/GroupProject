# UPath - University Portal Simulation

A modern, responsive University Portal system simulated for "XUL University". This project demonstrates a complete frontend/backend flow for Student and Lecturer dashboards, including attendance tracking, schedule management, and report generation.

## 🚀 Features

### for Students
-   **Dashboard**: Overview of daily schedule and quick stats.
-   **Weekly Schedule**: Color-coded timetable (Lectures, Labs, Tutorials).
-   **QR Scanner**: Built-in scanner to mark attendance via QR codes.
-   **Reports**: View personal attendance records and statistics.
-   **Campus Map**: Interactive map for navigating university grounds.
-   **Profile**: Manage personal details.

### for Lecturers
-   **QR Code Attendance**: Generate live QR codes for students to scan in class.
-   **Manual Entry**: Bulk-mark attendance for students who missed the scan.
-   **Class Management**: View active classes and schedules.
-   **Announcements**: Post updates for students.
-   **Analytics Reports**: Visual charts showing attendance trends and "At Risk" students.
-   **Profile**: Manage staff details.

## 🛠️ Setup & Installation

1.  **Prerequisites**: Ensure you have [Node.js](https://nodejs.org/) installed.
2.  **Clone/Download** this repository.
3.  **Install Dependencies**:
    ```bash
    npm install
    ```

## 🏁 How to Run

1.  Start the server:
    ```bash
    npm start
    ```
2.  Open your browser and visit:
    `http://localhost:3000`

## 🔐 Mock Credentials (Login)

The system simulates a Single Sign-On (SSO) experience. You can use any of the users in `server/data/users.json`. Here are some defaults:

**Student Access 👨‍🎓**
-   **School ID**: `240101` (Chris Banda)
-   **Password**: `123456`

**Lecturer Access 👩‍🏫**
-   **Staff ID**: `210101` (Mr. Makambwa)
-   **Password**: `staff123`

## 📂 Project Structure

-   `public/`: Contains all frontend files (HTML, CSS, JS).
    -   `pages/`: Individual pages.
        -   `student/`: Student-specific pages (Schedule, Map, Reports, etc.).
        -   `lecturer/`: Lecturer-specific pages (QR Gen, Manual Entry, Reports, etc.).
    -   `css/`: Global styles and strict design system.
    -   `js/`: Frontend logic (`api.js`, `layout.js`, etc.).
-   `server/`: Node.js Express server.
    -   `data/`: JSON files acting as the mock database (`users.json`, `classes.json`).
    -   `routes/`: API endpoints for Auth, Attendance, and Data.

## 📝 Notes for Developers

-   **Backend**: The server uses JSON files for persistence (`server/data/`).
-   **Database Migration**: The code includes `// TODO: SQL` comments in `routes/` to guide the migration to a real SQL database.
-   **Error Handling**: The server is crash-proof against malformed data.
-   **Documentation**: The backend code is fully documented with JSDoc comments.

---
*Built for the Group Project Module.*
