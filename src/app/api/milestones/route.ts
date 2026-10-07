import { NextResponse } from "next/server";
import { createMilestoneFor } from "@/server/api/actions";
import { errorResponse, readJson, workspaceId } from "@/server/api/http";
import { services } from "@/server/app";

export async function GET() {
  try {
    const s = await services();
    const rows = await s.milestones.listMilestones(await workspaceId());
    return NextResponse.json({ milestones: rows.map(({ workspaceId: _hidden, ...m }) => (void _hidden, m)) });
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

