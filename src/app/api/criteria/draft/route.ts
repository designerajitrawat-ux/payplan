import { NextResponse } from "next/server";
import { z } from "zod";
import { parse } from "@/server/api/actions";
import { errorResponse, readJson, workspaceId } from "@/server/api/http";
import { draftCriteria } from "@/server/criteria/draft";
import { llmFromEnv } from "@/server/llm";

const body = z.object({ brief: z.string().trim().min(10).max(4000) });

// A few drafts a minute per browser is plenty; this keeps the free AI quota for real use.
const recent = new Map<string, number[]>();
function allowed(key: string) {
  const now = Date.now();
  const hits = (recent.get(key) ?? []).filter((t) => now - t < 60_000);
  if (hits.length >= 6) return false;
  recent.set(key, [...hits, now]);
  return true;
}

export const maxDuration = 45;

/** Drafts acceptance criteria from a brief: AI when a key is set, otherwise a labelled template. */
export async function POST(request: Request) {
  try {
    const input = parse(body, await readJson(request));
    if (!allowed(await workspaceId())) return NextResponse.json({ error: "rate_limited", message: "Too many drafts in a minute. Try again shortly." }, { status: 429 });
    return NextResponse.json(await draftCriteria(input.brief, llmFromEnv()));
  } catch (error) {
    return errorResponse(error);
  }
}
