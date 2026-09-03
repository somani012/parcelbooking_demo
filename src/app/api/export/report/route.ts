import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { reportXlsx } from "@/lib/excel";
import { num } from "@/lib/money";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return new NextResponse("Unauthorized", { status: 401 });

  const sp = req.nextUrl.searchParams;
  const clientId = session.role === "ADMIN" ? sp.get("clientId") || undefined : session.clientId ?? "none";
  const from = sp.get("from") ? new Date(sp.get("from")!) : undefined;
  const to = sp.get("to") ? new Date(sp.get("to")!) : undefined;
  if (to) to.setHours(23, 59, 59, 999);

  const where = {
    ...(clientId ? { clientId } : {}),
    ...(from || to ? { bookingDate: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } } : {}),
  };

  const bookings = await db.booking.findMany({ where, orderBy: { bookingDate: "asc" } });
  const active = bookings.filter((b) => b.bookingStatus !== "CANCELLED");
  const count = (s: string[]) => bookings.filter((b) => s.includes(b.bookingStatus)).length;

  const monthlyMap = new Map<string, { bookings: number; amount: number }>();
  for (const b of active) {
    const d = new Date(b.bookingDate);
    const key = d.toLocaleDateString("en-IN", { month: "long", year: "numeric" });
    const cur = monthlyMap.get(key) ?? { bookings: 0, amount: 0 };
    cur.bookings += 1;
    cur.amount += num(b.totalAmount);
    monthlyMap.set(key, cur);
  }

  const buf = await reportXlsx(
    "Booking report" + (from || to ? ` (${sp.get("from") || "start"} to ${sp.get("to") || "today"})` : ""),
    [
      ["Total bookings", bookings.length],
      ["Total amount spent", active.reduce((s, b) => s + num(b.totalAmount), 0)],
      ["Total weight (kg)", active.reduce((s, b) => s + num(b.weight), 0)],
      ["Delivered", count(["DELIVERED"])],
      ["In transit", count(["IN_TRANSIT", "DISPATCHED"])],
      ["Pending", count(["BOOKED", "PROCESSING", "DRAFT"])],
      ["Cancelled", count(["CANCELLED"])],
    ],
    Array.from(monthlyMap.entries()).map(([month, v]) => ({ month, ...v }))
  );

  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="report-${new Date().toISOString().slice(0, 10)}.xlsx"`,
    },
  });
}
