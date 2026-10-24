/*
 * Starts a local in-memory MongoDB (via mongodb-memory-server) and keeps it
 * running so `npm run dev` can connect to it. Prints the connection URI.
 */
const { MongoMemoryServer } = require("mongodb-memory-server");

async function main() {
  const mongod = await MongoMemoryServer.create({
    instance: { port: 27017, ip: "127.0.0.1" },
  });
  console.log(`In-memory MongoDB ready at ${mongod.getUri()}`);
  process.on("SIGINT", async () => {
    await mongod.stop();
    process.exit(0);
  });
  // Keep the process alive.
  setInterval(() => {}, 1 << 30);
}

main().catch((err) => {
  console.error("Failed to start in-memory MongoDB:", err);
  process.exit(1);
});
