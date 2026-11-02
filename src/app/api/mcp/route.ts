import { NextResponse } from "next/server";
import { handleMcp } from "@/server/agent/mcp";
import { services } from "@/server/app";

// A release waits for PayPal's capture, so allow a little time.
export const maxDuration = 60;

const rpcError = (status: number, code: number, message: string, headers?: Record<string, string>) => NextResponse.json({ jsonrpc: "2.0", id: null, error: { code, message } }, { status, headers });

const unauthorized = () => rpcError(401, -32001, "Send the agent key from PayPlan's Agents page as: Authorization: Bearer ppk_…", { "WWW-Authenticate": 'Bearer realm="payplan"' });

/** MCP endpoint for the client's own AI agent. The agent key picks the client's workspace and limits. */
export async function POST(request: Request) {
  const key = request.headers.get("authorization")?.match(/^Bearer\s+(\S+)$/i)?.[1];
  if (!key) return unauthorized();
  const s = await services();
  const workspaceId = await s.milestones.workspaceForAgentKey(key);
  if (!workspaceId) return unauthorized();

  let message: unknown;
  try {
    message = await request.json();
  } catch {
    return rpcError(400, -32700, "Parse error");
  }
  if (Array.isArray(message)) return rpcError(400, -32600, "Send one message per request");

  const out = await handleMcp({ s, workspaceId, origin: new URL(request.url).origin }, message);
  return out ? NextResponse.json(out) : new Response(null, { status: 202 });
}

// Stateless server: no event stream to open and no session to end.
const notAllowed = () => new Response(null, { status: 405, headers: { Allow: "POST" } });
export const GET = notAllowed;
export const DELETE = notAllowed;
