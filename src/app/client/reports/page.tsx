import { requireClient } from "@/lib/auth";
import { db } from "@/lib/db";
import { inr, num } from "@/lib/money";
import { PageTitle, StatCard } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function ClientReports({ searchParams }: { searchParams: { from?: string; to?: string } }) {
  const session = await requireClient();
  const from = searchParams.from ? new Date(searchParams.from) : undefined;
  const to = searchParams.to ? new Date(searchParams.to) : undefined;
  if (to) to.setHours(23, 59, 59, 999);

  const bookings = await db.booking.findMany({
    where: {
      clientId: session.clientId,
      ...(from || to ? { bookingDate: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } } : {}),
    },
    orderBy: { bookingDate: "asc" },
  });

  const active = bookings.filter((b) => b.bookingStatus !== "CANCELLED");
  const count = (s: string[]) => bookings.filter((b) => s.includes(b.bookingStatus)).length;
  const monthly = new Map<string, { bookings: number; amount: number }>();
  for (const b of active) {
    const key = new Date(b.bookingDate).toLocaleDateString("en-IN", { month: "long", year: "numeric" });
    const cur = monthly.get(key) ?? { bookings: 0, amount: 0 };
    cur.bookings += 1;
    cur.amount += num(b.totalAmount);
    monthly.set(key, cur);
  }

  const qs = new URLSearchParams();
  if (searchParams.from) qs.set("from", searchParams.from);
  if (searchParams.to) qs.set("to", searchParams.to);

  return (
    <>
      <PageTitle title="Reports" sub="Booking activity and spending for a period">
        <a href={`/api/export/report?${qs.toString()}`} className="btn-quiet">Export report to Excel</a>
      </PageTitle>

      <form method="GET" className="card mb-4 flex max-w-2xl flex-wrap items-end gap-3 p-4">
        <div className="min-w-40 flex-1">
          <label htmlFor="from">From</label>
          <input id="from" name="from" type="date" defaultValue={searchParams.from} />
        </div>
        <div className="min-w-40 flex-1">
          <label htmlFor="to">To</label>
          <input id="to" name="to" type="date" defaultValue={searchParams.to} />
        </div>
        <button className="btn">Apply</button>
      </form>

      <div className="grid max-w-4xl grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Total bookings" value={String(bookings.length)} />
        <StatCard label="Total amount spent" value={inr(active.reduce((s, b) => s + num(b.totalAmount), 0))} accent />
        <StatCard label="Total weight" value={`${active.reduce((s, b) => s + num(b.weight), 0).toFixed(2)} kg`} />
        <StatCard label="Delivered" value={String(count(["DELIVERED"]))} />
        <StatCard label="In transit" value={String(count(["IN_TRANSIT", "DISPATCHED"]))} />
        <StatCard label="Pending" value={String(count(["BOOKED", "PROCESSING", "DRAFT"]))} />
        <StatCard label="Cancelled" value={String(count(["CANCELLED"]))} />
      </div>

      <section className="card mt-6 max-w-2xl overflow-x-auto">
        <h2 className="border-b border-neutral-200 px-4 py-3 text-sm font-bold">Monthly summary</h2>
        <table className="ledger-table">
          <thead><tr><th>Month</th><th className="text-right">Bookings</th><th className="text-right">Amount</th></tr></thead>
          <tbody>
            {Array.from(monthly.entries()).map(([month, v]) => (
              <tr key={month}>
                <td>{month}</td>
                <td className="money text-right">{v.bookings}</td>
                <td className="money text-right">{inr(v.amount)}</td>
              </tr>
            ))}
            {monthly.size === 0 && <tr><td colSpan={3} className="py-8 text-center text-neutral-400">No bookings in this period.</td></tr>}
          </tbody>
        </table>
      </section>
    </>
  );
}
