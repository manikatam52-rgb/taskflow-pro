# TaskFlow v1.3 QA Error and Defect Report

**Assessment date:** 2026-11-04
**Build reviewed:** Android release v1.3.3 (`versionCode 7`, QA and UI updates)
**Review type:** Static source review, focused unit tests, and read-only live API checks

## Executive summary

The initial review recorded no reproduced runtime defect. Follow-up code fixes have now been applied for the confirmed source-level findings and the unsafe integration-test harness. Backend and mobile builds and focused tests pass. No physical-device or production-account end-to-end validation has been performed.

Static review found two actionable behavior risks and one input-validation defect:

1. **AUTH-07 / AUTH-08 / API-02 / API-10 - session restoration clears the saved token on any `/auth/me` failure.** A timeout, offline device, or cold start is handled the same way as an expired token. The Axios timeout is 15 seconds; Render documents that a free web service can take about one minute to wake after idling. This can force a user to log in again after a transient startup/network failure.
2. **TASK-03 - invalid date strings are converted to `null`.** The API accepts a malformed `deadline` as if no deadline was supplied instead of returning a validation error.
3. **API-01 - database health can become stale.** The health handler reports `db: connected` whenever a pool object exists, even if the database later becomes unreachable. Current live health passed; loss-of-connection behavior was not reproduced.

These were findings from source behavior, not claims that the scenarios were reproduced on a device. The remediation status below supersedes the earlier source-status entries in the matrix where a fix is now applied.

## Remediation status

- **AUTH-08 / API-02 / API-10:** transient `/auth/me` errors now preserve the encrypted token and keep the signed-in app route available for retry. Only a real `401` clears the session. API request timeout is 70 seconds to allow for Render cold starts.
- **TASK-03:** malformed non-empty `deadline` and `scheduledAt` values now return `400`; explicit `null` or empty values still mean no date. Added unit coverage.
- **API-01:** health now executes `SELECT 1` and returns `503` if the database is unreachable. PostgreSQL connection attempts have a 5-second timeout, and idle-client errors are handled rather than emitted as unhandled process errors.
- **QA-01 / QA-02:** destructive database integration tests now run only when `TASKFLOW_TEST_DATABASE_URL` is explicitly set. With no disposable database, DB tests are Jest-skipped; a configured but unreachable test database fails setup rather than silently passing.
- **Mobile typecheck:** excluded the temporary MongoDB integration-server script from app typechecking and included the Node type declarations required by the existing environment config.
- **UI/UX:** refreshed authentication forms, added the TaskFlow task-list logo and subtle animated login backdrop, redesigned shared controls/task cards/task details, and moved dashboard filters into a bottom sheet. The task list is virtualized and kept visible during focus refreshes. The Android emulator showed the release login and keyboard layout correctly at its compact logical width.

**Still needs external validation/action:** install and exercise the app on Android devices (including offline recovery, small screens, keyboard, and hardware back); run DB-backed authorization/CRUD/persistence tests against an isolated disposable PostgreSQL database; arrange durable database hosting before the current free database expires. Those require devices, a disposable database, or Render account/billing changes unavailable to this source-only fix.

## Evidence collected

- `GET https://taskflow-pro-wgnr.onrender.com/api/health`: **HTTP 200**, `status: healthy`, `db: connected`.
- `GET https://taskflow-pro-wgnr.onrender.com/api/tasks` without a token: **HTTP 401**, `Missing authentication token`.
- `mobile/__tests__/useTaskFilters.test.ts`: **8 passed**.
- `backend/src/__tests__/sorting.test.ts`: **8 passed**.
- Follow-up: backend `typecheck` and production build passed; validation, sorting, and API suites completed with **21 passed, 23 DB tests skipped** when no explicit disposable DB was configured.
- Follow-up: mobile TypeScript check passed; app render and filter tests passed (**9 passed**).
- Android release APK v1.3 was built in the prior task turn; this review did not install it on physical devices.

### Checks not run

The database-backed API integration suite was not run. Its setup and teardown execute `DELETE FROM tasks` and `DELETE FROM users` against the configured `DATABASE_URL`; running it without first creating an isolated disposable database could erase application data. In addition, its `itDb` helper returns early when the database is unavailable instead of marking those tests skipped, so Jest can report passing tests whose assertions never ran.

No physical-device, multi-device, airplane-mode, cold-start, keyboard, small-screen, memory, or long-duration testing was performed. No authenticated production account was used.

## Detailed potential issue matrix

-Actual result- reports static source behavior when marked **Static**. -Not run- means the scenario has not been reproduced at runtime and must not be presented as a confirmed runtime bug.

### Authentication

| ID | Module | Steps to reproduce | Expected result | Actual result / status | Severity |
|---|---|---|---|---|---|
| AUTH-01 | Registration | Leave all registration fields blank and submit. | Inline validation blocks the request and identifies required fields. | **Static:** submit validation rejects a short name, invalid email, weak password, and mismatched confirmation. Runtime not run. | High |
| AUTH-02 | Registration | Enter a malformed email and submit. | Registration is rejected with a clear email error. | **Static:** client regex and server email validation reject malformed addresses. Runtime not run. | Medium |
| AUTH-03 | Registration | Enter a password under 8 characters or without a letter/digit. | Registration is rejected with password requirements. | **Static:** client and backend enforce length/letter/digit requirements. Runtime not run. | Medium |
| AUTH-04 | Registration | Register an email, then register the same email again. | Second registration returns a duplicate-account error without creating another account. | **Static:** unique database constraint and `409` mapping are present; a DB-backed test exists but was not run. | High |
| AUTH-05 | Login | Submit an existing email with the wrong password. | Login is rejected with a generic invalid-credentials message. | **Static:** backend returns `401` for an incorrect password; DB-backed test exists but was not run. | High |
| AUTH-06 | Login | Submit empty email/password. | Request is blocked with field validation. | **Static:** client blocks empty fields; backend rejects missing credentials. Runtime not run. | Medium |
| AUTH-07 | Session expiry | Use an expired token on a protected endpoint, then reopen the app. | Expired session is cleared and the user is returned to login. | **Static:** protected-request `401` clears storage. On startup, however, any `/auth/me` failure also clears storage (see combined finding below). Expiry scenario not run. | High |
| AUTH-08 | Session persistence | Log in, force-stop, then reopen while the API is slow/offline. | A valid stored token remains available and can be revalidated when service returns. | **Static risk:** `AuthContext` clears the stored token for every `fetchCurrentUser` exception, including timeout/network errors. Runtime not run. | High |
| AUTH-09 | Logout | Log in, log out, then reopen the app. | Local token is removed and the app remains signed out. | **Static:** logout disconnects realtime, clears encrypted storage, and clears auth state. Runtime not run. | High |
| AUTH-10 | Login submission | Tap Login repeatedly while the first request is pending. | Only one request is sent. | **Static:** `PrimaryButton` is disabled while `loading`; no rapid-tap runtime test. | Medium |

### Task management

| ID | Module | Steps to reproduce | Expected result | Actual result / status | Severity |
|---|---|---|---|---|---|
| TASK-01 | Create task | Submit a task with an empty title. | Task is not created; title error is shown. | **Static:** client blocks blank title and backend requires it. Runtime not run. | High |
| TASK-02 | Create task | Create a task with a title and blank description. | Task is created with an empty description. | **Static:** description is optional and normalized to empty text. Runtime not run. | Low |
| TASK-03 | Deadline validation | Send a task request with `deadline: "not-a-date"`. | API returns `400` and reports an invalid deadline. | **Static defect:** `asDate` returns `null` for an invalid string; validation accepts that value as a missing deadline. Runtime request not run. | High |
| TASK-04 | Edit task | Edit title/priority/deadline, save, return to dashboard. | Updated values appear on the dashboard. | **Static:** form sends `PATCH`, then goes back; dashboard reloads on focus. Runtime not run. | High |
| TASK-05 | Delete task | Long-press a task, confirm deletion. | Task is removed from server and list. | **Static:** confirmation is shown; successful delete removes task from local list. Runtime not run. | High |
| TASK-06 | Completion/filter | Complete a pending task while viewing Pending. | It leaves Pending and appears under Completed. | **Static:** status is updated locally and persisted through completion endpoint; filters check status. Runtime not run. | High |
| TASK-07 | Reopen task | Mark a completed task pending again. | Task becomes pending and completed timestamp clears. | **Static:** completion endpoint accepts target status and clears `completedAt`; API test exists but not run. | Medium |
| TASK-08 | Duplicate creation | Tap Create repeatedly while saving, or submit duplicate requests. | A single task is created for one user action. | **Static:** UI disables the button while saving; API has no idempotency key/deduplication for concurrent duplicate requests. Not reproduced. | Medium |
| TASK-09 | Persistence | Create a task, close/reopen app, sign in again. | Task remains available from the database. | **Static:** task service writes to PostgreSQL and dashboard refetches. Persistence across restart was not runtime-tested. | Critical |
| TASK-10 | Update persistence | Update a task, then fetch it again from the API. | Updated fields are stored and returned. | **Static:** service issues SQL `UPDATE`; DB-backed test exists but was not run. | Critical |

### Dashboard and filtering

| ID | Module | Steps to reproduce | Expected result | Actual result / status | Severity |
|---|---|---|---|---|---|
| DASH-01 | Counts | Compare Total to all tasks returned by the API. | Total equals task count. | **Static:** total is computed from `tasks.length`. Runtime data comparison not run. | High |
| DASH-02 | Counts | Compare Pending count with tasks whose status is pending. | Counts match. | **Static:** dashboard increments pending for every non-completed task. Runtime data comparison not run. | High |
| DASH-03 | Counts | Compare Completed count with completed tasks. | Counts match. | **Static:** dashboard counts completed status explicitly. Runtime data comparison not run. | High |
| DASH-04 | Counts | Compare Overdue count with pending tasks whose deadline is before now. | Counts match. | **Static:** dashboard calls `isOverdue`, which excludes completed/no-deadline tasks. Runtime data comparison not run. | High |
| DASH-05 | Refresh | Create a task and return to dashboard. | New task appears without app restart. | **Static:** dashboard reloads on focus after form navigation. Runtime not run. | High |
| DASH-06 | Overdue logic | Complete a task with a past deadline. | It is not counted as overdue. | **Static:** `isOverdue` returns false for completed tasks; focused sorting tests cover completed placement, not the dashboard count. Runtime not run. | Medium |
| DASH-07 | Filters | Combine status, priority, category, and search filters. | Only matching tasks are displayed. | **Static:** filters are applied locally; filter-combination behavior has no focused test in the reviewed mobile suite. Runtime not run. | High |
| DASH-08 | Deadline sort | Choose Deadline sort with past, future, and absent deadlines. | Earlier deadlines appear first; missing deadlines last. | **Unit test:** mobile sorting suite passed the deadline ordering case. Device UI test not run. | Medium |
| DASH-09 | Priority sort | Choose Priority sort with high/medium/low tasks. | High, then medium, then low. | **Unit test:** priority order passed. Device UI test not run. | Medium |
| DASH-10 | Empty state | Open dashboard with no tasks or filters with no matches. | An explanatory empty state appears. | **Static:** dashboard renders -No Tasks Found- and context-sensitive text. Runtime not run. | Low |

### Deadlines and priority

| ID | Module | Steps to reproduce | Expected result | Actual result / status | Severity |
|---|---|---|---|---|---|
| DATE-01 | Formatting | Create task with a date/time and inspect card/details. | Date/time is readable and consistent with device locale/time zone. | **Static:** formatting uses `toLocaleString('en-GB')` and device local time. Device locale/time-zone behavior not tested. | Medium |
| DATE-02 | Deadline policy | Select a deadline in the past and save. | Product policy should define whether this is rejected or shown overdue. | **Static:** past dates are accepted and displayed as overdue. The submitted requirements do not prohibit past deadlines, so no defect established. | Medium |
| DATE-03 | Time zones | Create/edit the same task on devices in different time zones. | The selected instant displays consistently according to each device-s local time. | **Static:** local `Date` values are serialized with `toISOString()` and parsed back; cross-zone behavior not runtime-tested. | High |
| DATE-04 | Overdue boundary | Set deadline around current time and observe immediately before/after it. | Task becomes overdue when its timestamp is earlier than current time. | **Static:** `isOverdue` compares deadline timestamp with `Date.now()`. Backend sorting tests passed; boundary on device not run. | High |
| DATE-05 | Edit priority | Change priority, save, reopen task. | Chosen priority remains. | **Static:** edit form loads and sends priority. DB-backed persistence not runtime-tested. | High |
| DATE-06 | Priority sort | Sort a mixed priority set. | High priority precedes medium and low. | **Unit test:** focused mobile sorting test passed. | Medium |
| DATE-07 | Missing deadline | Create/sort a task with no deadline. | Task remains valid and missing deadline sorts last. | **Static/unit tests:** null deadline is accepted; mobile deadline-sort test passed for missing deadline. | Medium |

### Backend and API

| ID | Module | Steps to reproduce | Expected result | Actual result / status | Severity |
|---|---|---|---|---|---|
| API-01 | Availability | Request `/api/health`. | `200` and healthy status while database is reachable. | **Runtime pass:** HTTP 200, database connected at assessment time. Static risk remains that health can report a stale connected state after a later DB disconnect. | Critical |
| API-02 | Timeout | Request API during slow response/cold start. | App shows a retryable timeout state without losing valid session. | **Static risk:** Axios times out at 15 seconds; session restore clears token on any request error. Slow-network scenario not run. | High |
| API-03 | Error handling | Cause validation, auth, and server errors; inspect response/UI. | Stable status/envelope with a useful safe message. | **Static:** backend central middleware maps validation/auth/database errors; client extracts server messages and gives generic network/timeout text. Runtime variants not tested. | High |
| API-04 | JWT attachment | Log in, then call a protected endpoint. | Request contains `Authorization: Bearer <token>`. | **Static:** token is stored in Axios default header and explicitly supplied to `/auth/me`. Authenticated live request not run. | Critical |
| API-05 | Authorization | Call `GET /api/tasks` without a token. | Server rejects with 401. | **Runtime pass:** HTTP 401, -Missing authentication token-. | Critical |
| API-06 | User isolation | Create a task as User A; attempt to list/get/update/delete as User B. | User B cannot access or alter A-s task. | **Static:** queries are scoped by verified JWT user id; API test covers isolation but DB-backed suite not run. | Critical |
| API-07 | Duplicate requests | Submit same create request twice. | Product policy should define whether duplicate tasks are allowed or deduplicated. | **Static:** separate requests create separate rows; no idempotency mechanism. UI disables during loading. No runtime reproduction; duplicate prevention is not specified by the API contract. | Medium |
| API-08 | Persistence | Create/update task and read it after service restart. | Data remains in PostgreSQL. | **Static:** PostgreSQL is configured and idempotent schema migration runs at startup. Persistence across restart not tested. | Critical |
| API-09 | Offline handling | Disconnect device during login/task fetch/save. | App stays open and shows retryable error. | **Static:** auth/dashboard/form/detail catch request exceptions and display an error. Device offline test not run. | High |
| API-10 | Render cold start | Wait for free service to idle, then launch/reopen app. | App waits/retries without discarding valid credentials. | **Static/platform risk:** Render free web services spin down after 15 minutes and can take about a minute to restart; client timeout is 15 seconds and session restore clears the token on failure. Not reproduced. | Medium |

### UI and Android compatibility

| ID | Module | Steps to reproduce | Expected result | Actual result / status | Severity |
|---|---|---|---|---|---|
| UI-01 | Layout | Inspect login, task form, and dashboard on a narrow/compact device. | Text and controls do not overlap or become unreachable. | Not run on a physical small-screen device; no confirmed defect. | Medium |
| UI-02 | Keyboard | Focus each input with Android keyboard open and scroll to submit. | Focused field and submit action remain reachable. | **Static:** screens use `ScrollView`; Android `KeyboardAvoidingView` behavior is undefined. Device keyboard test not run. | Medium |
| UI-03 | Buttons | Rapidly tap login/register/create/save/delete actions. | One action per submission. | **Static:** primary buttons disable while loading; duplicate request race was not stress-tested. | Medium |
| UI-04 | Loading | Restore session and load/save tasks. | Visible progress indicator while waiting. | **Static:** app restore, dashboard, task form, details, and primary buttons render loading indicators. Runtime not run. | Medium |
| UI-05 | Delete confirmation | Long-press a dashboard task and select Delete/Cancel. | Confirmation appears; Cancel preserves task; Delete removes it. | **Static:** `Alert.alert` provides Cancel and destructive Delete actions. Runtime not run. | Medium |
| UI-06 | Navigation | Open form/details and use Android back. | Returns to prior screen without losing saved data. | **Static:** native stack navigation is configured. Hardware back behavior not tested on device. | High |
| UI-07 | Spacing | Review screens at common density/font scales. | Spacing remains consistent and readable. | Not run visually across devices/font scales; no confirmed defect. | Low |
| UI-08 | Empty state | Open empty dashboard and filtered-empty dashboard. | Empty state is visible and aligned. | **Static:** explicit empty state exists. Visual layout not run on device. | Low |
| UI-09 | Error messages | Trigger invalid credentials, offline, and validation errors. | Message identifies the action the user can take. | **Static:** server messages are displayed; network and timeout messages are generic. Usability not runtime-tested. | Medium |
| UI-10 | Refresh on navigation | Edit/create/delete and navigate back to dashboard. | Dashboard reflects latest state. | **Static:** dashboard reloads on focus; local delete/toggle state is also updated. Runtime not run. | Medium |
| AND-01 | Launch stability | Install v1.3 on supported Android versions and cold-launch. | App opens without crash. | No device launch/crash test performed; no crash confirmed. | Critical |
| AND-02 | Network stability | Disconnect/reconnect network during requests. | App remains usable and reports failure/recovery. | Request errors are caught in source; device stability test not performed. | High |
| AND-03 | Backgrounding | Background and resume during dashboard/task flow. | App restores usable state and reloads stale data. | Dashboard reloads on focus; process death/background scenarios not run. | Medium |
| AND-04 | Reopen | Force-stop app and reopen with a saved session. | Valid session restores after API responds. | Encrypted token restore exists; API failure path can clear it. Device scenario not run. | High |
| AND-05 | Android back | Use hardware/system back on each screen. | Native navigation returns to expected screen. | Native stack is configured; no hardware-back test performed. | Medium |
| AND-06 | Small screens | Install on smallest supported viewport and inspect all screens. | All controls remain reachable without clipping. | Not run on device/emulator at compact dimensions. | Medium |
| AND-07 | Memory | Profile app during long task list and realtime updates. | Memory remains within device limits. | No profiler run; no defect confirmed. | Medium |
| AND-08 | Rendering speed | Profile first launch and long dashboard list. | Screens render within acceptable demo time. | No performance profile run; no defect confirmed. | Medium |

## Additional QA process findings

| ID | Module | Steps to reproduce | Expected result | Actual result / status | Severity |
|---|---|---|---|---|---|
| QA-01 | Backend test harness | Run API tests with `DATABASE_URL` unset or unreachable. | Database-backed tests are reported as skipped, not passed. | **Static defect:** `itDb` returns from a normal Jest test body, which can appear as a pass without running assertions. | High |
| QA-02 | Test data safety | Run API integration tests with a database containing real data. | Tests use an isolated test database. | **Static risk:** suite deletes all rows from `tasks` and `users` before/after the run. Do not run against shared/demo/production data. | Critical |
| OPS-01 | Database retention | Keep using the configured free Render Postgres database past its expiration date. | Data remains available or is upgraded before expiry. | **Platform-confirmed risk:** current Render docs state free Postgres expires 30 days after creation; after a 14-day grace period it is deleted. The current instance expires 2026-12-03. [Render free instance limits](https://render.com/docs/free#free-postgres) | Critical |

## Recommended reproduction order

1. Verify session restoration, offline recovery, and the longer cold-start wait on an Android device.
2. Run the full API integration suite with `TASKFLOW_TEST_DATABASE_URL` set to a disposable PostgreSQL database.
3. Perform device checks for compact screens, keyboard visibility, hardware back, and cross-network login.
4. Upgrade or replace the free Postgres instance before 2026-12-03 if demo data must survive beyond its expiry.
