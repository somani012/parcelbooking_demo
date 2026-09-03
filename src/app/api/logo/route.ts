import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const settings = await db.companySettings.findFirst();
  if (!settings?.logo) return new NextResponse("Not found", { status: 404 });
  return new NextResponse(new Uint8Array(settings.logo), {
    headers: { "Content-Type": settings.logoMime || "image/png" },
  });
}
