# UPath API Specification

## Base URL

`http://localhost:3000/api`

## Authentication

All protected routes require the server-issued `upath_token` HttpOnly cookie.
Role checks are enforced on the backend for privileged actions.

### Login

- **Endpoint**: `POST /auth/login`
- **Body**: `{ email, password }`
- **Response**: `{ message, user: { ... } }`

### Register

- **Endpoint**: `POST /auth/register`
- **Body**: `{ fullName, email, password, role, idNumber }`
- **Response**: `{ message, user: { ... } }`

### Get All Users

- **Endpoint**: `GET /users`
- **Access**: `lecturer`, `admin`
- **Response**: `{ users: [ { id, fullName, role, program, year, ... } ] }`

### Get User Overview Stats

- **Endpoint**: `GET /users/stats/overview`
- **Access**: `lecturer`, `admin`
- **Response**: `{ totalStudents, totalLecturers, totalAdmins, totalReps, totalClasses }`

---

## Classes

### Get All Classes

- **Endpoint**: `GET /classes`
- **Access**: authenticated user
- **Response**: `[ { id, code, name, year, section, day, time, room, lecturerName, lecturerId }, ... ]`

### Get Lecturer Classes

- **Endpoint**: `GET /classes/lecturer/:id`
- **Access**: authenticated user
- **Response**: `[ ...classes ]`

### Update Class

- **Endpoint**: `PUT /classes/:id`
- **Access**: authenticated user (policy can be restricted further by role)
- **Body**: `{ day, time, room }`
- **Response**: `{ message, class }`

### Create Class

- **Endpoint**: `POST /classes`
- **Access**: authenticated user (policy can be restricted further by role)
- **Body**: `{ name, code, time, room, lecturerId, lecturerName, day }`
- **Response**: `{ message, class }`

---

## Attendance

### Open Check-In Session

- **Endpoint**: `POST /attendance/checkin`
- **Access**: `lecturer`, `admin`
- **Body**: `{ classId }`
- **Response**: `{ sessionId, code, timeLeft, status }`

### Open Check-Out Session

- **Endpoint**: `POST /attendance/checkout`
- **Access**: `lecturer`, `admin`
- **Body**: `{ classId }`
- **Response**: `{ sessionId, code, timeLeft, status }`

### Validate Check-In

- **Endpoint**: `POST /attendance/validate-checkin`
- **Access**: authenticated student/rep for own account
- **Body**: `{ classId, studentId, code }`
- **Response**: `{ attendanceId, requiresVerification, nextStep }`

### Validate Check-Out

- **Endpoint**: `POST /attendance/validate-checkout`
- **Access**: authenticated student/rep for own account
- **Body**: `{ classId, studentId, code, attendanceId? }`
- **Response**: `{ attendanceId, checkedInAt, checkedOutAt }`

### Get Today's Attendance By Course

- **Endpoint**: `GET /attendance/today-by-class/:courseCode`
- **Access**: `lecturer`, `admin`, `student_rep`
- **Query**:
  - `classId` (optional): restrict results to one class variant/cohort
  - If `lecturer` omits `classId`, backend returns course-wide results across that lecturer's owned course variants only.
  - `sources` (optional): use `automated` to include only `totp`, `qr`, `checkin_checkout`
  - `state` (optional): use `active` to return only currently checked-in rows (`checkedOutAt = null`)
- **Response**: `{ checkedInStudents: [ { userId, method, status, checkedInAt, checkedOutAt } ] }`

### Get Course Roster For Attendance

- **Endpoint**: `GET /attendance/students/:courseCode`
- **Access**: `lecturer`, `admin`, `student_rep`
- **Query**:
  - `classId` (optional): restrict roster to one class variant/cohort
  - If `lecturer` omits `classId`, backend returns a course-wide roster across that lecturer's owned course variants only.
- **Response**: `{ students: [ ... , recommendedClassId? ], totalSessions }`

### Manual Bulk Mark (Lecturer/Admin)

- **Endpoint**: `POST /attendance/bulk-mark`
- **Access**: `lecturer`, `admin`
- **Body**: `{ classId, students: string[], date? }`
- **Behavior**:
  - `classId` must be a specific composite class variant ID.
  - Backend validates lecturer ownership and each student's cohort eligibility before insert.

### Legacy Validate Code (Deprecated)

- **Endpoint**: `POST /attendance/validate-code`
- **Status**: removed from current backend (clients should treat as unavailable)
- **Migration**: clients must use `POST /attendance/validate-checkin` and `POST /attendance/validate-checkout`

### Verify Identity (Device Verification)

- **Endpoint**: `POST /attendance/verify-identity`
- **Access**: authenticated student/rep for own account
- **Body**: `{ userId, method, selfieImage?, idImage?, photoWidth?, photoHeight?, sessionId? }`
- **Response**: `{ verified, verificationId, message }`

### Active Devices

- **Endpoint**: `GET /attendance/devices/active`
- **Access**: authenticated user
- **Response**: `{ devices, maxDevices, totalDevices }`

### Register Device

- **Endpoint**: `POST /attendance/devices/register`
- **Access**: authenticated user
- **Response**: `{ deviceId, message }`

### Mark Attendance (Single)

- **Endpoint**: `POST /attendance/mark`
- **Access**: `lecturer`, `admin`
- **Body**: `{ studentId, classId, status, date }`
- **Response**: `{ message, attendance }`

### Mark Attendance (Bulk)

- **Endpoint**: `POST /attendance/bulk-mark`
- **Access**: `lecturer`, `admin`
- **Body**: `{ classId, students: [id1, id2...], date }`
- **Response**: `{ message, count }`

### Get Student Attendance

- **Endpoint**: `GET /attendance/student/:id`
- **Access**: own record, `lecturer`, `admin`, `student_rep`
- **Response**:

```json
{
  "history": ["...records"],
  "stats": [
    {
      "courseCode": "NCSC211",
      "attended": 5,
      "total": 12
    }
  ]
}
```

### Get Course Statistics

- **Endpoint**: `GET /attendance/stats/course/:courseId`
- **Access**: authenticated user
- **Response**:

```json
{
  "totalSessions": 12,
  "totalStudents": 30,
  "totalPresent": 250,
  "avgAttendance": 88
}
```

### Export Today's Attendance CSV

- **Endpoint**: `GET /attendance/today-by-class/:courseCode/export`
- **Access**: `lecturer`, `admin`, `student_rep`
- **CSV Columns**:
  `Date,CourseCode,CourseName,StudentId,FullName,Program,Year,Method,CheckInTime,CheckOutTime,Completion`
