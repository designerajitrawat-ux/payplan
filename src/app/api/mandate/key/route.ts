import { NextResponse } from "next/server";
import { errorResponse, workspaceId } from "@/server/api/http";
import { services } from "@/server/app";

/** Issues a new MCP key for this browser's agent. The old key stops working. The key is shown once. */
export async function POST(request: Request) {
  try {
    const s = await services();
    const key = await s.milestones.issueAgentKey(await workspaceId());
    return NextResponse.json({ key, mcpUrl: `${new URL(request.url).origin}/api/mcp` });
  } catch (error) {
    return errorResponse(error);
  }
}
