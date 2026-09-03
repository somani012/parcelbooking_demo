import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { bookingSlipPdf } from "@/lib/pdf";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return new NextResponse("Unauthorized", { status: 401 });

  const booking = await db.booking.findUnique({
    where: { id: params.id },
    include: { client: true, service: true },
  });
  if (!booking) return new NextResponse("Not found", { status: 404 });
  // Clients may only download slips for their own bookings.
  if (session.role !== "ADMIN" && booking.clientId !== session.clientId) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const settings = await getSettings();
  const pdf = await bookingSlipPdf(booking, settings);
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${booking.bookingId}.pdf"`,
    },
  });
}
