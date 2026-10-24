# TaskFlow Pro — Architecture

## Overview

```
┌──────────────┐   HTTPS/JSON   ┌────────────────┐   Mongoose    ┌───────────┐
│  Mobile app   │ ─────────────▶ │  Express API   │ ────────────▶ │  MongoDB  │
│  RN 0.87 CLI  │ ◀───────────── │  TS + JWT auth │               │  Atlas    │
└──────────────┘                └────────────────┘               └───────────┘
```

- **Mobile**: React Native 0.87 (CLI, not Expo), TypeScript, React Navigation, Zustand stores, Axios client, React Hook Form + Zod, EncryptedStorage for tokens.
- **Backend**: Express 5 + TypeScript. Layered: routes (HTTP) → services (business rules) → models (Mongoose). Central error middleware maps operational errors to status codes and never leaks internals.
- **Database**: MongoDB (Atlas in dev). All task queries are scoped by `userId` taken from the verified JWT.

## Security model

1. Passwords hashed with bcryptjs (10 rounds); plaintext never stored, hashes never serialized (`toSafeUser` strips them).
2. JWTs are signed with `JWT_SECRET`, carry `sub` (user id), expire per `JWT_EXPIRES_IN`.
3. `requireAuth` verifies the Bearer token on every private route; the authenticated identity is **derived from the token**, never from client-supplied ids.
4. Task ownership: every query filters by `userId` from the token, so another user's task simply returns 404 (no information leak).
5. `userId`, `createdAt`, `updatedAt`, `completedAt` are server-managed and ignored if present in request bodies.
6. `.env` holds secrets and is gitignored; only `.env.example` (placeholders) is committed.

## Smart task prioritization (shared rules, mobile + server)

Deterministic urgency score (implemented in `backend/src/services/taskService.ts::urgencyScore`
and mirrored by `mobile/src/utils/taskSorting.ts`):

| Case | Score |
|---|---|
| Completed task | `-1000` (always last; never classified as overdue) |
| Overdue pending | `1000 + priorityWeight` (always first) |
| Pending with deadline | `100 − clamp(hoursLeft, 0, 100) + priorityWeight` |
| Pending without deadline | `10 + priorityWeight` |

`priorityWeight`: high = 30, medium = 20, low = 10.

Consequences (verified by tests):
- Overdue pending always outranks every non-overdue task (even far-future high priority).
- Higher priority outranks lower at equal deadlines; nearer deadline outranks farther at equal priority.
- Tasks without deadlines never crash and sit below any with-deadline task at equal priority.
- Equal scores tie-break on deadline, then createdAt (stable, deterministic).
- The sort never mutates its input (it copies first).

## Data model

**User**: `email` (unique, indexed), `password` (hash), `name`, timestamps.
**Task**: `userId` (ObjectId ref, indexed), `title` (required), `description`, `scheduledAt`, `deadline`, `priority` (enum), `status` (enum), `category`, `tags[]`, `completedAt`, timestamps.
Compound indexes: `{ userId, status, deadline }` and `{ userId, category }` for the common list queries.

## Session persistence (mobile)

- Token stored with `react-native-encrypted-storage` (Android Keystore-backed), never AsyncStorage.
- On app launch the auth store restores the token and validates it via `GET /api/auth/me`; a 401 clears the session.
- Logout deletes the stored token and resets the store.

## Backend scripts

- `npm run dev` — tsx watch (development)
- `npm run build` / `npm start` — tsc to dist/ and run
- `npm run typecheck` — tsc --noEmit
- `npm test` — Jest: API integration tests (supertest + in-memory MongoDB) and urgency-score unit tests

## Known limitations

- No rate limiting on auth endpoints (sufficient for an assignment; production would add it).
- No offline sync on mobile — the app requires connectivity.
- Search uses an escaped regex; full-text indexes would be the production approach.
