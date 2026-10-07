import { NextResponse } from "next/server";
import { runAction } from "@/server/api/actions";
import { errorResponse, readJson, workspaceId } from "@/server/api/http";
import { services } from "@/server/app";

/** Every state change on a milestone: fund, submit, release, appeal and so on. */
export async function POST(request: Request, ctx: RouteContext<"/api/milestones/[id]/actions">) {
  try {
    const { id } = await ctx.params;
    return NextResponse.json(await runAction(await services(), await workspaceId(), id, await readJson(request)));
  } catch (error) {
    return errorResponse(error);
  }
}
