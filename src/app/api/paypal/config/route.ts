import { NextResponse } from "next/server";
import { services } from "@/server/app";

/** What the browser needs to load PayPal's button. The client ID is public by design; the secret never leaves the server. */
export async function GET() {
  const s = await services();
  const clientId = s.paypalMode === "simulated" ? null : process.env.PAYPAL_CLIENT_ID ?? null;
  return NextResponse.json({ mode: s.paypalMode, clientId, environment: s.paypalMode === "live" ? "live" : "sandbox" });
}
