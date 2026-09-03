import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { inr, num } from "@/lib/money";
import { PageTitle, StatCard } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function AdminReports({ searchParams }: { searchParams: { from?: string; to?: string; clientId?: string } }) {
  await requireAdmin();
  const clients = await db.client.findMany({ orderBy: { companyName: "asc" }, select: { id: true, companyName: true } });

  const from = searchParams.from ? new Date(searchParams.from) : undefined;
  const to = searchParams.to ? new Date(searchParams.to) : undefined;
  if (to) to.setHours(23, 59, 59, 999);

  const [bookings, approvedAgg] = await Promise.all([
    db.booking.findMany({
      where: {
        ...(searchParams.clientId ? { clientId: searchParams.clientId } : {}),
        ...(from || to ? { bookingDate: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } } : {}),
      },
      orderBy: { bookingDate: "asc" },
    }),
    db.payment.aggregate({
      where: {
        status: "APPROVED",
        ...(searchParams.clientId ? { clientId: searchParams.clientId } : {}),
        ...(from || to ? { paymentDate: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } } : {}),
      },
      _sum: { amount: true },
    }),
  ]);

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
  for (const k of ["from", "to", "clientId"] as const) {
    if (searchParams[k]) qs.set(k, searchParams[k]!);
  }

  return (
    <>
      <PageTitle title="Reports" sub="Booking volume, revenue and payment collections">
        <a href={`/api/export/report?${qs.toString()}`} className="btn-quiet">Export report to Excel</a>
      </PageTitle>

      <form method="GET" className="card mb-4 flex max-w-3xl flex-wrap items-end gap-3 p-4">
        <div className="min-w-40 flex-1">
          <label htmlFor="clientId">Client</label>
          <select id="clientId" name="clientId" defaultValue={searchParams.clientId ?? ""}>
            <option value="">All clients</option>
            {clients.map((c) => <option key={c.id} value={c.id}>{c.companyName}</option>)}
          </select>
        </div>
        <div className="min-w-36 flex-1"><label htmlFor="from">From</label><input id="from" name="from" type="date" defaultValue={searchParams.from} /></div>
        <div className="min-w-36 flex-1"><label htmlFor="to">To</label><input id="to" name="to" type="date" defaultValue={searchParams.to} /></div>
        <button className="btn">Apply</button>
      </form>

      <div className="grid max-w-5xl grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Total bookings" value={String(bookings.length)} />
        <StatCard label="Booking revenue" value={inr(active.reduce((s, b) => s + num(b.totalAmount), 0))} accent />
        <StatCard label="Payments received" value={inr(num(approvedAgg._sum.amount ?? 0))} />
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
