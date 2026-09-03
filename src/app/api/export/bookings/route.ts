import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { buildBookingWhere, paramsFromSearch } from "@/lib/filters";
import { bookingsXlsx } from "@/lib/excel";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return new NextResponse("Unauthorized", { status: 401 });

  const sp = Object.fromEntries(req.nextUrl.searchParams.entries());
  // Clients can only ever export their own bookings, whatever the query says.
  const forcedClientId = session.role === "ADMIN" ? undefined : session.clientId ?? "none";
  const where = buildBookingWhere(paramsFromSearch(sp), forcedClientId);

  const bookings = await db.booking.findMany({
    where,
    include: { client: true, service: true },
    orderBy: { createdAt: "desc" },
    take: 5000,
  });
  const buf = await bookingsXlsx(bookings);
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="bookings-${new Date().toISOString().slice(0, 10)}.xlsx"`,
    },
  });
}
