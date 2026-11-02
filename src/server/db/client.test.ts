import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { createPgliteDb } from "./client";
import { milestones } from "./schema";

describe("createPgliteDb", () => {
  it("creates missing parent folders, as on a fresh clone", async () => {
    const dir = path.join(mkdtempSync(path.join(tmpdir(), "payplan-db-")), ".data", "pglite");
    const db = await createPgliteDb(dir);
    expect(await db.select().from(milestones)).toEqual([]);
    // A database on disk migrates slower than one in memory, especially on a busy Windows machine.
  }, 60_000);
});
