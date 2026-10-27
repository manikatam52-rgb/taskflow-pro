/*
 * Starts an embedded local PostgreSQL (no install, no Docker) and keeps it
 * running so `npm run dev` can connect to it. Data is stored in
 * backend/.embedded-pg and survives restarts.
 *
 * Usage: npm run dev:db
 * Connection string: postgresql://postgres:postgres@127.0.0.1:54329/taskflow
 */
const EmbeddedPostgres = require("embedded-postgres").default;

const PG_PORT = 54329;
const DATA_DIR = `${__dirname}/../.embedded-pg`;

const fs = require("fs");

// initialise() only runs initdb; skip it when the cluster already exists.
const clusterExists = fs.existsSync(`${DATA_DIR}/PG_VERSION`);

async function main() {
  const pg = new EmbeddedPostgres({
    databaseDir: DATA_DIR,
    user: "postgres",
    password: "postgres",
    port: PG_PORT,
    persistent: true,
  });

  if (!clusterExists) {
    await pg.initialise();
  }
  await pg.start();
  if (!clusterExists) {
    await pg.createDatabase("taskflow");
  }

  console.log(`Embedded PostgreSQL ready at postgresql://postgres:postgres@127.0.0.1:${PG_PORT}/taskflow`);
  console.log("Keep this window/process running while you use `npm run dev`.");

  const shutdown = async () => {
    try {
      await pg.stop();
    } finally {
      process.exit(0);
    }
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
  // Keep the process alive.
  setInterval(() => { }, 1 << 30);
}

main().catch((err) => {
  console.error("Failed to start embedded PostgreSQL:", err);
  process.exit(1);
});
