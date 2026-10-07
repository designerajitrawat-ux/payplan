import { NextResponse } from "next/server";

/** The sample site's contact endpoint. The first delivery shipped it broken; the fix works. */
export async function POST(request: Request, ctx: RouteContext<"/demo/northwind/[version]/contact">) {
  const { version } = await ctx.params;
  if (version === "v1") return NextResponse.json({ error: "Mail server is not configured" }, { status: 500 });
  if (version !== "v2" && version !== "v3") return NextResponse.json({ error: "Not found" }, { status: 404 });
  const form = await request.formData().catch(() => null);
  const name = String(form?.get("name") ?? "").slice(0, 80);
  return NextResponse.json({ ok: true, message: `Thanks${name ? `, ${name}` : ""}. We will reply within a day.` });
}
