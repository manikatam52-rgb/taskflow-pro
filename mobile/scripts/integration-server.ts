/**
 * TEMPORARY integration-test server (not part of the app).
 * Runs the REAL backend app (backend/src/app.ts) against an in-memory MongoDB
 * on port 5100 so the mobile API smoke test can exercise the true contracts.
 * The backend source is never modified. Run with: tsx scripts/integration-server.ts
 */
import { MongoMemoryServer } from '../../backend/node_modules/mongodb-memory-server';

async function main() {
  const mongod = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mongod.getUri('taskflow-integration');
  process.env.JWT_SECRET = 'integration_test_secret';
  process.env.JWT_EXPIRES_IN = '7d';
  process.env.PORT = '5100';

  const { connectDatabase } = await import('../../backend/src/config/database');
  await connectDatabase();

  const { createApp } = await import('../../backend/src/app');
  const app = createApp();
  app.listen(5100, () => console.log('INTEGRATION SERVER READY on 5100'));
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
