import { NextResponse } from "next/server";
import { getMilestoneFor } from "@/server/api/actions";
import { errorResponse, workspaceId } from "@/server/api/http";
import { services } from "@/server/app";

export async function GET(_request: Request, ctx: RouteContext<"/api/milestones/[id]">) {
  try {
    const { id } = await ctx.params;
    return NextResponse.json({ milestone: await getMilestoneFor(await services(), await workspaceId(), id) });
  } catch (error) {
    return errorResponse(error);
  }
}
