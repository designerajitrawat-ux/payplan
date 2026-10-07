import { cookies } from "next/headers";
import { NextResponse } from "next/server";

/** "Reset demo": forget this browser's workspace. The next request starts an empty one. */
export async function POST() {
  (await cookies()).delete("pp_ws");
  return NextResponse.json({ ok: true });
}
