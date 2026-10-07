import { NextResponse } from "next/server";
import { mandateBody, parse } from "@/server/api/actions";
import { errorResponse, readJson, workspaceId } from "@/server/api/http";
import { services } from "@/server/app";

export async function GET() {
  try {
    const s = await services();
    const mandate = await s.milestones.getMandate(await workspaceId());
    return NextResponse.json({ mandate: mandate ?? null });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PUT(request: Request) {
  try {
    const s = await services();
    const input = parse(mandateBody, await readJson(request));
    const { workspaceId: _hidden, ...mandate } = await s.milestones.upsertMandate({ ...input, workspaceId: await workspaceId() });
    void _hidden;
    return NextResponse.json({ mandate });
  } catch (error) {
    return errorResponse(error);
  }
}
