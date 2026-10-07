// Shared bits for route handlers: the workspace cookie and error responses.

import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { InvalidStateError, MoveInProgressError, NotFoundError, ValidationError } from "../milestones/service";
import { PayPalError } from "../paypal/client";

const COOKIE = "pp_ws";

/** The browser's workspace id. Created on first use; httpOnly so page scripts never see it. */
export async function workspaceId(): Promise<string> {
  const jar = await cookies();
  const existing = jar.get(COOKIE)?.value;
  if (existing && /^ws_[A-Za-z0-9_-]{22}$/.test(existing)) return existing;
  const id = `ws_${randomBytes(16).toString("base64url")}`;
  jar.set(COOKIE, id, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 * 365 });
  return id;
}

export function errorResponse(error: unknown) {
  if (error instanceof ValidationError) return NextResponse.json({ error: "invalid_request", message: error.message }, { status: 400 });
  if (error instanceof NotFoundError) return NextResponse.json({ error: "not_found", message: "Milestone not found" }, { status: 404 });
  if (error instanceof MoveInProgressError) return NextResponse.json({ error: "in_progress", message: "PayPal is still working on the last request. Try again in a minute." }, { status: 409, headers: { "Retry-After": "60" } });
  if (error instanceof InvalidStateError) return NextResponse.json({ error: "invalid_state", message: error.message, status: error.status }, { status: 409 });
  if (error instanceof PayPalError) {
    return NextResponse.json({ error: "paypal_error", message: error.message, name: error.name, issue: error.issue, debugId: error.debugId }, { status: error.status >= 500 ? 502 : 422 });
  }
  console.error(error);
  return NextResponse.json({ error: "server_error", message: "Something went wrong on our side. Please try again." }, { status: 500 });
}

export async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new ValidationError("Body must be JSON");
  }
}
