import "dotenv/config";
import { getPool, disconnectDatabase } from "../config/database";

/**
 * Creates the tables and indexes used by TaskFlow Pro.
 * Safe to run multiple times (IF NOT EXISTS everywhere).
 */
async function main(): Promise<void> {
  const pool = getPool();

  await pool.query(`
    CREATE EXTENSION IF NOT EXISTS pgcrypto;

    CREATE TABLE IF NOT EXISTS users (
      id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      email       TEXT NOT NULL UNIQUE,
      password    TEXT NOT NULL,
      name        TEXT NOT NULL DEFAULT '',
      created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS tasks (
      id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title        TEXT NOT NULL CHECK (char_length(title) <= 200),
      description  TEXT NOT NULL DEFAULT '',
      scheduled_at TIMESTAMPTZ,
      deadline     TIMESTAMPTZ,
      priority     TEXT NOT NULL DEFAULT 'medium'
                   CHECK (priority IN ('low', 'medium', 'high')),
      status       TEXT NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending', 'completed')),
      category     TEXT NOT NULL DEFAULT 'general',
      tags         TEXT[] NOT NULL DEFAULT '{}',
      created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
      completed_at TIMESTAMPTZ
    );

    CREATE INDEX IF NOT EXISTS idx_tasks_user_status_deadline
      ON tasks (user_id, status, deadline);
    CREATE INDEX IF NOT EXISTS idx_tasks_user_category
      ON tasks (user_id, category);
  `);

  console.log("Migration complete: users + tasks tables ready.");
}

main()
  .catch((err) => {
    console.error("Migration failed:", err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await disconnectDatabase();
  });
