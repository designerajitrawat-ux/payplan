import { NextResponse } from "next/server";
import { services } from "@/server/app";

/** Public: the signed report, its signature and the public key, so anyone can verify it offline. */
export async function GET(_request: Request, ctx: RouteContext<"/api/reports/[hash]">) {
  const { hash } = await ctx.params;
  if (!/^[0-9a-f]{64}$/.test(hash)) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const result = await (await services()).milestones.verifyReport(hash);
  if (!result) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json({ ...result, algorithm: "Ed25519 over the canonical JSON of payload (keys sorted); reportHash = SHA-256 of the same bytes" });
}
