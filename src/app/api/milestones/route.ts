import { NextResponse } from "next/server";
import { createMilestoneFor, publicView } from "@/server/api/actions";
import { errorResponse, readJson, workspaceId } from "@/server/api/http";
import { services } from "@/server/app";

export async function GET() {
  try {
    const s = await services();
    const views = await s.milestones.listMilestoneViews(await workspaceId());
    return NextResponse.json({ milestones: views.map(publicView), paypal: s.paypalMode, demoControls: s.demoControls, checker: s.judge.model });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const s = await services();
    const milestone = await createMilestoneFor(s, await workspaceId(), await readJson(request));
    return NextResponse.json({ milestone }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}

