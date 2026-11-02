import { mkdirSync } from "node:fs";
import path from "node:path";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import * as schema from "./schema";

export type Db = PgDatabase<PgQueryResultHKT, typeof schema>;

export const migrationsFolder = path.join(process.cwd(), "drizzle");

/**
 * Neon when DATABASE_URL is set (production, previews). Without it, an embedded Postgres
 * (PGlite) in .data/ so anyone can run the app locally with no database to install.
 */
export async function createDb(env: Record<string, string | undefined> = process.env): Promise<Db> {
  if (env.DATABASE_URL) {
    const { Pool } = await import("@neondatabase/serverless");
    const { drizzle } = await import("drizzle-orm/neon-serverless");
    return drizzle({ client: new Pool({ connectionString: env.DATABASE_URL }), schema }) as unknown as Db;
  }
  return createPgliteDb(pgliteDir(env));
}

/** Where the embedded Postgres keeps its files. An empty PGLITE_DIR (as copied from .env.example) means the default, never memory. */
export function pgliteDir(env: Record<string, string | undefined>): string {
  return env.PGLITE_DIR || path.join(process.cwd(), ".data", "pglite");
}

/** Embedded Postgres with migrations applied. No dataDir means in memory (tests). */
export async function createPgliteDb(dataDir?: string): Promise<Db> {
  const { PGlite } = await import("@electric-sql/pglite");
  const { drizzle } = await import("drizzle-orm/pglite");
  const { migrate } = await import("drizzle-orm/pglite/migrator");
  // PGlite creates only the last folder, so a fresh clone without .data/ would fail.
  if (dataDir) mkdirSync(dataDir, { recursive: true });
  const db = drizzle({ client: new PGlite(dataDir), schema });
  await migrate(db, { migrationsFolder });
  return db as unknown as Db;
}
