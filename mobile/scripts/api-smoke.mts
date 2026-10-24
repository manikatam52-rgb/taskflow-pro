/**
 * End-to-end smoke test of the REAL backend API (backend/src/app.ts) against an
 * in-memory MongoDB. Verifies the exact contracts the mobile app relies on
 * (mobile/src/services/*.ts): register -> /auth/me -> task CRUD -> complete
 * toggle -> filters/sort -> 401 handling -> delete.
 *
 * Run: node ..\backend\node_modules\tsx\dist\cli.mjs scripts\api-smoke.mjs
 */
import { MongoMemoryServer } from '../../backend/node_modules/mongodb-memory-server';

const BASE = 'http://127.0.0.1:5100/api';
let token: string | null = null;
let failures = 0;

async function req(method: string, path: string, body?: unknown) {
  const res = await fetch(BASE + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

function check(name: string, cond: boolean, extra = '') {
  if (cond) console.log(`PASS ${name}`);
  else { failures++; console.log(`FAIL ${name} ${extra}`); }
}

async function main() {
  // --- Boot the real backend in-process against an in-memory MongoDB ---
  const mongod = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mongod.getUri('taskflow-integration');
  process.env.JWT_SECRET = 'integration_test_secret';
  process.env.JWT_EXPIRES_IN = '7d';

  const { connectDatabase } = await import('../../backend/src/config/database');
  await connectDatabase();
  const { createApp } = await import('../../backend/src/app');
  const server = createApp().listen(5100);
  console.log('Backend (real app.ts) running on 5100 with in-memory MongoDB\n');

  try {
    const email = `smoke-${Date.now()}@test.dev`;
    const password = 'Test1234';

    let r = await req('POST', '/auth/register', { email, password, confirmPassword: password, name: 'Smoke Test' });
    check('register 201 + token + user', r.status === 201 && r.data?.data?.token && r.data?.data?.user?.email === email, JSON.stringify(r.data));
    token = r.data?.data?.token;

    r = await req('GET', '/auth/me');
    check('auth/me returns user', r.status === 200 && r.data?.data?.user?.email === email);

    r = await req('POST', '/auth/login', { email, password });
    check('login returns token', r.status === 200 && !!r.data?.data?.token);
    token = r.data?.data?.token;
    check('wrong password rejected 401', (await req('POST', '/auth/login', { email, password: 'nope' })).status === 401);

    // Create
    r = await req('POST', '/tasks', { title: 'Alpha', description: 'First', deadline: '2026-10-20T17:00:00.000Z', priority: 'medium' });
    check('create task 201', r.status === 201 && r.data?.data?.task?.title === 'Alpha');
    const t1 = r.data?.data?.task?._id;

    r = await req('POST', '/tasks', { title: 'Beta', priority: 'high', deadline: '2026-10-15T10:00:00.000Z' });
    const t2 = r.data?.data?.task?._id;
    r = await req('POST', '/tasks', { title: 'Gamma', priority: 'low' });
    const t3 = r.data?.data?.task?._id;
    check('created 3 tasks', t1 && t2 && t3);

    // Read / details
    r = await req('GET', `/tasks/${t1}`);
    check('get task by id', r.status === 200 && r.data?.data?.task?.title === 'Alpha');

    // List
    r = await req('GET', '/tasks');
    check('list tasks returns 3', r.data?.data?.tasks?.length === 3, JSON.stringify(r.data?.data?.tasks?.length));

    // Smart sort: higher priority + earlier deadline first, completed last
    await req('PATCH', `/tasks/${t3}/complete`, { status: 'completed' });
    r = await req('GET', '/tasks?sortBy=smart');
    const titles = r.data?.data?.tasks?.map((t: any) => t.title);
    check('smart sort: Beta first, Gamma (completed) last', titles?.[0] === 'Beta' && titles?.[2] === 'Gamma', JSON.stringify(titles));

    // Filters
    r = await req('GET', '/tasks?status=completed');
    check('filter status=completed -> Gamma only', r.data?.data?.tasks?.length === 1 && r.data.data.tasks[0].title === 'Gamma');
    r = await req('GET', '/tasks?priority=high');
    check('filter priority=high -> Beta only', r.data?.data?.tasks?.length === 1 && r.data.data.tasks[0].title === 'Beta');
    r = await req('GET', '/tasks?sortBy=deadline');
    check('sort by deadline: Beta (Oct 15) before Alpha (Oct 20)', r.data?.data?.tasks?.[0]?.title === 'Beta');

    // Update
    r = await req('PATCH', `/tasks/${t1}`, { title: 'Alpha v2', priority: 'high' });
    check('update task', r.status === 200 && r.data?.data?.task?.title === 'Alpha v2' && r.data.data.task.priority === 'high');

    // Toggle back to pending
    r = await req('PATCH', `/tasks/${t3}/complete`, { status: 'pending' });
    check('toggle to pending', r.data?.data?.task?.status === 'pending');

    // 401 handling with an invalid token (mobile interceptor logs the user out)
    const saved = token;
    token = 'invalid.token.here';
    check('invalid token -> 401', (await req('GET', '/tasks')).status === 401);
    token = saved;

    // Delete
    for (const id of [t1, t2, t3]) {
      r = await req('DELETE', `/tasks/${id}`);
      check(`delete task ${id.slice(-4)}`, r.status === 200);
    }
    check('list empty after deletes', (await req('GET', '/tasks')).data?.data?.tasks?.length === 0);
    check('get deleted task -> 404', (await req('GET', `/tasks/${t1}`)).status === 404);
  } finally {
    server.close();
    await mongod.stop();
  }

  console.log(failures === 0 ? '\nALL CHECKS PASSED' : `\n${failures} CHECK(S) FAILED`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch(e => { console.error(e); process.exit(1); });
