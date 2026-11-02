import { after, NextResponse } from "next/server";
import { runAction } from "@/server/api/actions";
import { errorResponse, readJson, workspaceId } from "@/server/api/http";
import { services } from "@/server/app";
import { runVerification } from "@/server/verifier/run";

// The checker runs after the response; give it time for the page fetches, PageSpeed (up to 90 s) and a few AI calls.
export const maxDuration = 300;

/** Every state change on a milestone: fund, submit, release, appeal and so on. */
export async function POST(request: Request, ctx: RouteContext<"/api/milestones/[id]/actions">) {
  try {
    const { id } = await ctx.params;
    const s = await services();
    const body = await readJson(request);
    const result = await runAction(s, await workspaceId(), id, body);
    if (result.milestone.status === "verifying") {
      // Start the checker once the reply is on its way. The timer job finishes it if this run dies.
      after(() => runVerification(s.milestones, s.judge, id, s.checker).catch((error: unknown) => console.error("verification failed", id, error)));
    }
    return NextResponse.json(result);
  } catch (error) {
    return errorResponse(error);
  }
}
