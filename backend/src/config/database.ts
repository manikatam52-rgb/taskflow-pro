import mongoose from "mongoose";
import dns from "dns";

/**
 * MongoDB connection.
 * Reads MONGODB_URI from the environment. Fails loudly when missing so the
 * app never silently runs without persistence.
 */
export async function connectDatabase(): Promise<void> {
  const uri = process.env.MONGODB_URI;

  if (!uri) {
    throw new Error(
      "MONGODB_URI is not set. Add it to backend/.env (see .env.example)."
    );
  }

  mongoose.set("strictQuery", true);

  try {
    await mongoose.connect(uri);
  } catch (err) {
    /*
     * Some corporate/ISP DNS servers refuse DNS SRV queries, which makes
     * mongodb+srv:// fail with `querySrv ECONNREFUSED` even though the cluster
     * is reachable. In that case, retry once using public DNS resolvers
     * (8.8.8.8 / 1.1.1.1) for SRV lookup. Regular host resolution still uses
     * the OS resolver.
     */
    const isSrvRefused =
      uri.startsWith("mongodb+srv") &&
      err instanceof Error &&
      (err.message.includes("querySrv") ||
        (err as NodeJS.ErrnoException).code === "ECONNREFUSED");

    if (!isSrvRefused) throw err;

    console.warn(
      "SRV lookup failed via system DNS; retrying with public resolvers (8.8.8.8, 1.1.1.1)"
    );
    dns.setServers(["8.8.8.8", "1.1.1.1"]);
    await mongoose.connect(uri);
  }

  console.log("MongoDB connected");
}

export function isDbConnected(): boolean {
  return mongoose.connection.readyState === 1;
}
