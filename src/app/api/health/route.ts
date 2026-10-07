import { NextResponse } from "next/server";
import { services } from "@/server/app";

/** Which PayPal and database the app is running against. No secrets. */
export async function GET() {
  try {
    const s = await services();
    return NextResponse.json({ ok: true, paypal: s.paypalMode, database: s.database, webhook: Boolean(s.webhookId), checker: s.judge.model, demoControls: s.demoControls });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : String(error) }, { status: 503 });
  }
}
