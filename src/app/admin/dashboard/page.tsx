import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { inr, fmtDate, fmtDateTime, num } from "@/lib/money";
import { Badge, StatCard, PageTitle, Empty } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function AdminDashboard() {
  await requireAdmin();
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const [clients, bookings, todayBookings, pendingDeliveries, delivered, pendingPayments, approvedAgg, recentBookings, recentAudit] =
    await Promise.all([
      db.client.count(),
      db.booking.count(),
      db.booking.count({ where: { createdAt: { gte: todayStart } } }),
      db.booking.count({ where: { bookingStatus: { in: ["BOOKED", "PROCESSING", "DISPATCHED", "IN_TRANSIT"] } } }),
      db.booking.count({ where: { bookingStatus: "DELIVERED" } }),
      db.payment.count({ where: { status: "PENDING" } }),
      db.payment.aggregate({ where: { status: "APPROVED" }, _sum: { amount: true } }),
      db.booking.findMany({ orderBy: { createdAt: "desc" }, take: 8, include: { client: true } }),
      db.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: 8 }),
    ]);

  return (
    <>
      <PageTitle title="Dashboard" sub="Business at a glance">
        {pendingPayments > 0 && (
          <Link href="/admin/payments" className="btn">
            Verify {pendingPayments} pending payment{pendingPayments === 1 ? "" : "s"}
          </Link>
        )}
      </PageTitle>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-7">
        <StatCard label="Total clients" value={String(clients)} />
        <StatCard label="Total bookings" value={String(bookings)} />
        <StatCard label="Today's bookings" value={String(todayBookings)} />
        <StatCard label="Pending deliveries" value={String(pendingDeliveries)} />
        <StatCard label="Delivered" value={String(delivered)} />
        <StatCard label="Pending payments" value={String(pendingPayments)} accent={pendingPayments > 0} />
        <StatCard label="Payments received" value={inr(num(approvedAgg._sum.amount ?? 0))} />
      </div>

      <div className="mt-6 grid gap-4 xl:grid-cols-2">
        <section className="card overflow-x-auto">
          <h2 className="border-b border-neutral-200 px-4 py-3 text-sm font-bold">Recent bookings</h2>
          {recentBookings.length === 0 ? (
            <Empty text="No bookings yet." />
          ) : (
            <table className="ledger-table">
              <thead>
                <tr><th>Booking ID</th><th>Client</th><th>Date</th><th className="text-right">Amount</th><th>Status</th></tr>
              </thead>
              <tbody>
                {recentBookings.map((b) => (
                  <tr key={b.id}>
                    <td><Link href={`/admin/bookings/${b.id}`} className="font-medium text-primary hover:underline">{b.bookingId}</Link></td>
                    <td>{b.client.companyName}</td>
                    <td className="whitespace-nowrap">{fmtDate(b.bookingDate)}</td>
                    <td className="money text-right">{inr(b.totalAmount)}</td>
                    <td><Badge value={b.bookingStatus} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <section className="card overflow-x-auto">
          <h2 className="border-b border-neutral-200 px-4 py-3 text-sm font-bold">Recent activity (audit log)</h2>
          {recentAudit.length === 0 ? (
            <Empty text="No activity recorded yet." />
          ) : (
            <table className="ledger-table">
              <thead><tr><th>When</th><th>Who</th><th>Action</th><th>Entity</th></tr></thead>
              <tbody>
                {recentAudit.map((a) => (
                  <tr key={a.id}>
                    <td className="whitespace-nowrap">{fmtDateTime(a.createdAt)}</td>
                    <td>{a.userName}</td>
                    <td>{a.action.replaceAll("_", " ").toLowerCase()}</td>
                    <td>{a.entityId}{a.detail ? ` - ${a.detail}` : ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>
    </>
  );
}
