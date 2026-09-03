import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return new NextResponse("Unauthorized", { status: 401 });
  const payment = await db.payment.findUnique({ where: { id: params.id } });
  if (!payment?.screenshot) return new NextResponse("Not found", { status: 404 });
  if (session.role !== "ADMIN" && payment.clientId !== session.clientId) {
    return new NextResponse("Forbidden", { status: 403 });
  }
  return new NextResponse(new Uint8Array(payment.screenshot), {
    headers: { "Content-Type": payment.screenshotMime || "image/png" },
  });
}
