import { Pool, type QueryResult, type QueryResultRow } from "pg";

/**
 * PostgreSQL connection (Supabase).
 * Reads DATABASE_URL from the environment. Fails loudly when missing so the
 * app never silently runs without persistence.
 */
let pool: Pool | null = null;

export function getPool(): Pool {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error(
        "DATABASE_URL is not set. Add it to backend/.env (see .env.example)."
      );
    }
    pool = new Pool({
      connectionString,
      ssl: /localhost|127\.0\.0\.1/.test(connectionString)
        ? false
        : { rejectUnauthorized: false },
      max: 10,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000,
    });
    // A dropped idle PostgreSQL connection should be logged and recovered by
    // the pool, not become an unhandled EventEmitter error that crashes Node.
    pool.on("error", (error) => {
      console.error("PostgreSQL idle client error", error);
    });
  }
  return pool;
}

export async function connectDatabase(): Promise<void> {
  const client = await getPool().connect();
  try {
    await client.query("SELECT 1");
  } finally {
    client.release();
  }
  console.log("PostgreSQL connected");
}

export function isDbConnected(): boolean {
  return pool !== null;
}

/** Check actual database reachability instead of treating an initialized pool as healthy. */
export async function checkDatabase(): Promise<boolean> {
  if (!pool) return false;
  try {
    await pool.query("SELECT 1");
    return true;
  } catch {
    return false;
  }
}

export async function disconnectDatabase(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

export function query<T extends QueryResultRow>(
  text: string,
  params: unknown[] = []
): Promise<QueryResult<T>> {
  return getPool().query<T>(text, params);
}
