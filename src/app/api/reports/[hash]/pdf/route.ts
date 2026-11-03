import { NextResponse } from "next/server";
import { services } from "@/server/app";
import { reportPdf, type ReportPayload } from "@/server/reports/pdf";

/** Public: the signed report as a PDF, ready to attach to a PayPal dispute in the Resolution Center. */
export async function GET(request: Request, ctx: RouteContext<"/api/reports/[hash]/pdf">) {
  const { hash } = await ctx.params;
  if (!/^[0-9a-f]{64}$/.test(hash)) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const result = await (await services()).milestones.verifyReport(hash);
  if (!result) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const { milestone } = result.payload as ReportPayload;
  const bytes = reportPdf(result, `${new URL(request.url).origin}/r/${hash}`);
  return new NextResponse(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="payplan-M-${milestone.number}-report-${hash.slice(0, 8)}.pdf"`,
      "Cache-Control": "public, max-age=300",
    },
  });
}
