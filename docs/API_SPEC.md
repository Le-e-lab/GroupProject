# UPath API Specification

## Base URL
`http://localhost:3000/api`

## Authentication

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
- **Response**: `{ students: [...], lecturers: [...] }`

---

## Classes

### Get All Classes
- **Endpoint**: `GET /classes`
- **Response**: `[ { id, code, name, year, section, day, time, room, lecturerName, lecturerId }, ... ]`

### Get Lecturer Classes
- **Endpoint**: `GET /classes/lecturer/:id`
- **Response**: `[ ...classes ]`

### Update Class
- **Endpoint**: `PUT /classes/:id`
- **Body**: `{ day, time, room }`
- **Response**: `{ message, class }`

### Create Class
- **Endpoint**: `POST /classes`
- **Body**: `{ name, code, time, room, lecturerId, lecturerName, day }`
- **Response**: `{ message, class }`

---

## Attendance

### Mark Attendance (Single)
- **Endpoint**: `POST /attendance/mark`
- **Body**: `{ studentId, classId, status, date }`
- **Response**: `{ message, record }`

### Mark Attendance (Bulk)
- **Endpoint**: `POST /attendance/bulk-mark`
- **Body**: `{ classId, students: [id1, id2...], date }`
- **Response**: `{ message, count }`

### Get Student Attendance
- **Endpoint**: `GET /attendance/student/:id`
- **Response**: 
```json
{
  "history": [ ...records ],
  "stats": [ { "courseCode": "NCSC211", "attended": 5, "total": 12 } ]
}
```

### Get Course Statistics
- **Endpoint**: `GET /attendance/stats/course/:courseId`
- **Response**: 
```json
{
  "totalSessions": 12,
  "totalStudents": 30,
  "totalPresent": 250,
  "avgAttendance": 88
}
```
