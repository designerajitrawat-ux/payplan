import { NextResponse } from "next/server";
import { errorResponse } from "@/server/api/http";
import { handleWebhook } from "@/server/api/webhook";
import { services } from "@/server/app";

/** PayPal calls this for captures, voids, refunds and disputes. A non-2xx reply makes PayPal retry. */
export async function POST(request: Request) {
  try {
    const result = await handleWebhook(await services(), request.headers, await request.text());
    return NextResponse.json(result.body, { status: result.status });
  } catch (error) {
    return errorResponse(error);
  }
}
