import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { errorResponse } from "@/server/api/http";
import { services } from "@/server/app";
import { runTimers } from "@/server/jobs";

function authorized(request: Request) {
  const secret = process.env.CRON_SECRET;
  const given = request.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  return Boolean(secret) && given.length === expected.length && timingSafeEqual(Buffer.from(given), Buffer.from(expected));
}

/** The timer job: a scheduled GitHub Action calls this every few minutes. */
async function run(request: Request) {
  if (!process.env.CRON_SECRET) return NextResponse.json({ error: "CRON_SECRET is not set" }, { status: 503 });
  if (!authorized(request)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    const s = await services();
    const jobs = await runTimers(s);
    return NextResponse.json({ ranAt: new Date().toISOString(), jobs });
  } catch (error) {
    return errorResponse(error);
  }
}

export const GET = run;
export const POST = run;
