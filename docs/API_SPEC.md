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

- **Endpoint**: `GET /auth/users`
- **Access**: `lecturer`, `admin`
- **Response**: `{ students: [...], lecturers: [...] }`

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
