# TaskFlow Pro

Full-stack task-management application: a **React Native (CLI) Android app** with a **Node.js/Express + MongoDB REST API**, JWT authentication, and smart deadline/priority-based task sorting.

```
taskflow-pro/
├── mobile/     React Native 0.87 (CLI) + TypeScript app
├── backend/    Express 5 + TypeScript + Mongoose REST API
├── docs/       API.md (endpoint reference), ARCHITECTURE.md (design + algorithm)
└── README.md
```

## Features

- Email/password registration and login (bcryptjs hashing, JWT tokens)
- Secure session persistence (EncryptedStorage on Android, auto-restore + logout)
- Tasks with title, description, scheduled date/time, deadline, priority (low/medium/high), category, tags
- Create / edit / complete / delete tasks; user sees only their own tasks
- Dashboard with real counts (total, completed, pending, overdue, today) and an upcoming list
- Smart sorting: overdue first, then priority × time-to-deadline (see docs/ARCHITECTURE.md)
- Search, status/priority/category filters, sort controls on the Tasks screen
- Calendar view of tasks by date

## Technology stack

| Layer | Tools |
|---|---|
| Mobile | React Native 0.87 (CLI), TypeScript, React Navigation, Zustand, Axios, React Hook Form, Zod, react-native-encrypted-storage, @react-native-community/datetimepicker, react-native-calendars, react-native-reanimated, react-native-vector-icons |
| Backend | Node.js, Express 5, TypeScript, Mongoose, JWT, bcryptjs, dotenv, cors |
| Testing | Jest + ts-jest + supertest + mongodb-memory-server (backend); Jest (mobile, sorting tests) |

## Prerequisites

- Node.js >= 22.11 (tested on 26)
- MongoDB Atlas account **or** local MongoDB Community
- Android Studio + Android SDK (with an emulator or device)
- JDK 17+ (Android Studio's bundled JBR works)

## Backend setup

```powershell
cd backend
npm install
Copy-Item .env.example .env   # then edit .env
```

`.env` values (see `.env.example` for the full list — never commit the real `.env`):

```dotenv
PORT=5000
MONGODB_URI=<your MongoDB connection string>
JWT_SECRET=<long random string>
JWT_EXPIRES_IN=7d
```

For Atlas, allow your IP under **Network Access** (or `0.0.0.0/0` for dev).

Run (terminal 1):

```powershell
npm run dev        # tsx watch, http://localhost:5000/api/health
```

Backend tests:

```powershell
npm test           # Jest: API integration tests (in-memory MongoDB) + sorting tests
npm run typecheck
```

## Mobile setup

```powershell
cd mobile
npm install
```

API base URL — Android emulator uses `http://10.0.2.2:5000`; a physical device needs your PC's LAN IP.

Run (terminal 2):

```powershell
npm run android
```

Mobile tests (task sorting algorithm):

```powershell
npm test
```

## Running both (two terminals)

```powershell
# Terminal 1
cd backend; npm run dev

# Terminal 2
cd mobile; npm run android
```

## API

Full endpoint reference with request/response examples: [docs/API.md](docs/API.md).

## Screenshots

_(Add screenshots of the Welcome, Dashboard, Tasks, Create Task, Task Details, Calendar and Profile screens here before submission.)_

## Known limitations

- No rate limiting on auth endpoints.
- No offline sync — connectivity required.
- Atlas free-tier latency applies in development.
