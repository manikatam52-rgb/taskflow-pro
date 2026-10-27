TaskFlow Pro — Full-stack mobile task manager

This is the mobile app repo. The `backend/` folder contains the Express API that the app talks to.

## Stack

- **Backend**: Node.js + Express + TypeScript, JWT auth, WebSocket realtime sync
- **Database**: PostgreSQL on Supabase
- **App**: React Native (Expo)

## Project structure

```
backend/          Express API (TypeScript)
  src/
    config/       Database connection
    models/       Shared types & row mappers
    middleware/   Auth + error handling
    routes/       /api/auth, /api/tasks, /api/health
    services/     Business logic
    realtime/     WebSocket server (same port, path /ws)
    scripts/      migrate.ts — creates tables
    __tests__/    Jest + Supertest integration tests
```

## Quick start (backend)

1. `cd backend`
2. Copy `.env.example` to `.env` and fill in:
   - `DATABASE_URL` — your Supabase connection string (Project Settings → Database → Connection string)
   - `JWT_SECRET` — any long random string
3. `npm install`
4. `npm run migrate` — creates the `users` and `tasks` tables
5. `npm run dev` — API on http://localhost:5000

## API overview

| Method | Path                  | Auth | Purpose                          |
|--------|-----------------------|------|----------------------------------|
| POST   | `/api/auth/register`  | –    | Create account, returns JWT      |
| POST   | `/api/auth/login`     | –    | Log in, returns JWT              |
| GET    | `/api/auth/me`        | JWT  | Current user                     |
| GET    | `/api/tasks`          | JWT  | List tasks (filters + sort)      |
| POST   | `/api/tasks`          | JWT  | Create task                      |
| GET    | `/api/tasks/:id`      | JWT  | Get one task                     |
| PATCH  | `/api/tasks/:id`      | JWT  | Update task                      |
| PATCH  | `/api/tasks/:id/complete` | JWT | Toggle/force completion     |
| DELETE | `/api/tasks/:id`      | JWT  | Delete task                      |
| GET    | `/api/health`         | –    | Health + DB status               |

All task operations are scoped to the authenticated user — one user can never
read, modify, or delete another user's tasks.

## Deployment

`render.yaml` deploys the API to Render. Set `DATABASE_URL` and `JWT_SECRET`
in the Render dashboard; run `npm run migrate` once against the production
database before first use.
