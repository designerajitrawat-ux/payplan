import { NextResponse } from "next/server";
import { services } from "@/server/app";

/** Public: the key this deployment signs acceptance reports with. */
export async function GET() {
  const { keyId, publicKeyPem, source } = (await services()).milestones.signingKey();
  return NextResponse.json({ algorithm: "Ed25519", keyId, publicKeyPem, stable: source !== "memory" });
}
