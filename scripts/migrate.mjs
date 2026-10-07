// Applies database migrations to Neon. Vercel runs it before every build (see "vercel-build").
// Without DATABASE_URL it does nothing: the app then uses its embedded Postgres, which migrates itself.

import { Pool } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import { migrate } from "drizzle-orm/neon-serverless/migrator";

if (!process.env.DATABASE_URL) {
  console.log("DATABASE_URL is not set; skipping migrations.");
  process.exit(0);
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
try {
  await migrate(drizzle({ client: pool }), { migrationsFolder: "drizzle" });
  console.log("Database migrations applied.");
} finally {
  await pool.end();
}
