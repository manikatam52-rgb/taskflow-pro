# TaskFlow Pro API

Base URL: `http://localhost:5000/api`

All responses use a consistent JSON envelope:

```json
{ "success": true, "data": { ... } }
{ "success": false, "message": "Human-readable error" }
```

Authentication uses a Bearer token: `Authorization: Bearer <jwt>`.
The token is returned by register/login and expires per `JWT_EXPIRES_IN` (default 7d).

---

## Health

### GET /api/health
No authentication.

**200**
```json
{ "success": true, "status": "healthy", "db": "connected", "timestamp": "2026-01-01T00:00:00.000Z" }
```

---

## Authentication

### POST /api/auth/register
Creates an account.

Body:
| Field | Type | Required |
|---|---|---|
| email | string (valid email) | yes |
| password | string (>= 8 chars, 1 letter + 1 digit) | yes |
| confirmPassword | string (must equal password) | optional |
| name | string | optional |

**201**
```json
{ "success": true, "data": { "token": "<jwt>", "user": { "_id": "...", "email": "a@b.com", "name": "Test", "createdAt": "..." } } }
```

Errors: `400` invalid email / weak password / mismatched confirm · `409` duplicate email

### POST /api/auth/login
Body: `{ "email": "...", "password": "..." }`

**200** — same shape as register.

Errors: `400` missing fields · `401` `Invalid email or password` (same message for unknown email — no user enumeration)

### GET /api/auth/me
Requires auth.

**200**
```json
{ "success": true, "data": { "user": { "_id": "...", "email": "a@b.com", "name": "Test", "createdAt": "..." } } }
```

Errors: `401` missing/invalid/expired token

---

## Tasks (all require auth; ownership is derived from the JWT)

### Task shape
```json
{
  "_id": "65f0...",
  "userId": "65f0...",
  "title": "Ship release",
  "description": "",
  "scheduledAt": "2026-01-01T09:00:00.000Z" | null,
  "deadline": "2026-01-02T17:00:00.000Z" | null,
  "priority": "low" | "medium" | "high",
  "status": "pending" | "completed",
  "category": "general",
  "tags": [],
  "createdAt": "...",
  "updatedAt": "...",
  "completedAt": "..." | null
}
```

### GET /api/tasks
Query parameters (all optional):
| Param | Values |
|---|---|
| status | `pending`, `completed` |
| priority | `low`, `medium`, `high` |
| category | any category string |
| search | matches title, description, tags (case-insensitive) |
| sortBy | `smart` (default), `deadline`, `priority`, `createdAt`, `updatedAt` |

**200**
```json
{ "success": true, "data": { "tasks": [ ... ] } }
```

`sortBy=smart` applies the server-side urgency score — see docs/ARCHITECTURE.md.

### POST /api/tasks
Body: `{ title (required), description?, scheduledAt?, deadline?, priority?, status?, category?, tags? }`

`userId` is set by the server from the token and **cannot** be set by the client.
`createdAt`/`updatedAt`/`completedAt` are server-managed.

**201** with the created task · `400` validation errors

### GET /api/tasks/:id
**200** with the task · `400` invalid id · `404` not found / not owned

### PATCH /api/tasks/:id
Body: any subset of the editable fields above.

**200** with the updated task · `400` invalid id / no editable fields · `404` not found / not owned

### PATCH /api/tasks/:id/complete
Toggles completion. Optional body `{ "status": "pending" | "completed" }` forces a target.
Sets `completedAt` on completion, clears it when reverting.

**200** with the updated task · `400` invalid id · `404` not found / not owned

### DELETE /api/tasks/:id
**200** `{ "success": true, "data": { "message": "Task deleted" } }` · `400` invalid id · `404` not found / not owned

---

## Status codes used
| Code | Meaning |
|---|---|
| 200 | OK |
| 201 | Created |
| 400 | Validation error / invalid id |
| 401 | Missing, invalid, or expired token; bad credentials |
| 404 | Task not found or not owned by caller |
| 409 | Duplicate email |
| 500 | Unexpected server error (details logged server-side only, never returned) |
