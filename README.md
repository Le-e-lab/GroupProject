# UPath – Smart Attendance System

A modern, full-stack University Attendance Portal for **Africa University**, allowing students and lecturers to manage attendance digitally through time-based codes and QR scanning.

## 🚀 Features

### Student Portal
- **Dashboard** – Overview of today's schedule and quick attendance stats
- **Weekly Schedule** – Full colour-coded timetable from live university data
- **Mark Attendance** – Enter the 6-digit TOTP code shown by the lecturer
- **QR Scanner** – Scan the lecturer's QR code to mark attendance (HTTPS required on mobile)
- **Reports** – Personal attendance records with charts and at-risk alerts
- **Campus Map** – Interactive map for navigating university buildings
- **Notifications** – View announcements from lecturers (delays, cancellations, online classes)
- **Profile** – View and manage personal details

### Student Representative Portal
- **Rep Console** – Manage timetable (reschedule, change venue) for their program/year
- **Send Announcements** – Post notifications on behalf of lecturers
- **STUDENT / REP Badge** – Visual indicator of dual role

### Lecturer Portal
- **QR Code Generator** – Generates a live rotating QR + 6-digit code for active class
- **Online Class** – Notify students that a class is online and share a join link
- **Manual Attendance** – Mark students present individually for edge cases
- **My Classes** – View all assigned classes and schedules
- **Manage Students** – View students by course, promote to Student Rep
- **Announcements** – Post updates (delays, venue changes, cancellations) to students
- **Analytics** – Visual charts showing attendance trends and at-risk students

### Admin Dashboard
- **System Stats** – User counts, class counts, attendance summary
- **User Management** – List, search, change roles, delete users
- **Timetable Viewer** – Browse all classes with filters
- **Create User** – Add new students/lecturers/admins

---

## 🛠️ Setup & Installation

**Prerequisites**: [Node.js](https://nodejs.org/) v18+

```bash
# 1. Install dependencies
npm install

# 2. Start the server
npm start

# 3. Open browser
# http://localhost:3000
```

---

## 🌐 Mobile Testing (Ngrok)

To test camera/QR features on a real mobile device:

```bash
# Install ngrok, then:
ngrok http 3000
# Copy the https://....ngrok-free.app URL
```

---

## 🔐 Login Credentials

### Ordinary Student 👨‍🎓
| Field | Value |
| --- | --- |
| School ID | `240102` |
| Password | `password123` |
| Program | BSc Honours in Artificial Intelligence, Year 2 |

### Student Representative 🎓

| Field | Value |
| --- | --- |
| School ID | `240101` |
| Password | `password123` |
| Note | Has extra `Rep Console` permissions to manage schedules/notifications |

### Lecturer 👩‍🏫

| Field | Value |
| --- | --- |
| Staff ID | `210153` |
| Password | `staff123` |
| Name | Dr. Tendai Zengeni |

> Other lecturer IDs are available in the database. All use password `staff123`.

### System Administrator ⚙️

| Field | Value |
| --- | --- |
| Admin ID | `admin` |
| Password | `admin123` |
| Note | Has full access to the admin dashboard for system configuration |

---

## � Project Structure

```
GroupProject/
├── public/
│   ├── index.html              # Landing page
│   ├── dashboard.html          # Student dashboard
│   ├── lecturer_dashboard.html # Lecturer dashboard
│   ├── css/                    # Theme & component styles
│   ├── js/
│   │   ├── api.js              # Centralised API wrapper
│   │   └── layout.js           # Shared UI (header, toast, etc.)
│   └── pages/
│       ├── auth.html           # Login page
│       ├── student/            # Schedule, Map, Reports, QR scan, Profile
│       └── lecturer/           # QR gen, Manual entry, Reports, Announcements
├── server/
│   ├── server.js               # Express app (port 3000)
│   ├── models/index.js         # Sequelize models
│   ├── routes/                 # auth.js, classes.js, attendance.js
│   ├── config/database.js      # SQLite connection config
│   ├── data/
│   │   ├── seed_data.js        # Data generators (real university data)
│   │   ├── parse_raw.js        # Timetable text parser
│   │   └── parsed_timetable.json # 895 parsed class records
│   └── scripts/
│       ├── seed_all.js         # Full database re-seed
│       └── seed_attendance.js  # Attendance history seeder
├── timetable.sqlite            # SQLite database
├── DOCUMENTATION.md            # Technical documentation
└── package.json
```

---

## 📝 Database Notes

- **895 real class sessions** parsed from official Africa University timetable data
- **49 degree programmes** across multiple colleges (CBMS, CEAS, Law, etc.)
- **185+ lecturers** with hashed passwords
- **~1,070 students** generated per programme/year combination
- **24,600+ attendance records** seeded for realistic dashboard data
- **Auto-seeding** – Server populates all data on first boot from `server/data/`

---

## 📚 Documentation

See [DOCUMENTATION.md](./DOCUMENTATION.md) for the full technical guide including architecture, API reference, and troubleshooting.

---

*Built for the Group Project Module at Africa University*

[Developer Portfolio](https://le-e-lab.github.io/portfolio/)
