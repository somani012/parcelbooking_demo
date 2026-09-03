import Link from "next/link";
import { requireClient } from "@/lib/auth";
import { db } from "@/lib/db";
import { inr, fmtDate, label } from "@/lib/money";
import { Badge, StatCard, PageTitle, Empty } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function ClientDashboard() {
  const session = await requireClient();
  const clientId = session.clientId;
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const [client, total, today, pending, completed, recent] = await Promise.all([
    db.client.findUniqueOrThrow({ where: { id: clientId } }),
    db.booking.count({ where: { clientId } }),
    db.booking.count({ where: { clientId, createdAt: { gte: todayStart } } }),
    db.booking.count({ where: { clientId, bookingStatus: { in: ["BOOKED", "PROCESSING", "DISPATCHED", "IN_TRANSIT"] } } }),
    db.booking.count({ where: { clientId, bookingStatus: "DELIVERED" } }),
    db.booking.findMany({ where: { clientId }, orderBy: { createdAt: "desc" }, take: 8, include: { service: true } }),
  ]);

  return (
    <>
      <PageTitle title={`Hello, ${client.contactPerson.split(" ")[0]}`} sub={client.companyName} />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <StatCard label="Available balance" value={inr(client.balance)} accent />
        <StatCard label="Total bookings" value={String(total)} />
        <StatCard label="Today's bookings" value={String(today)} />
        <StatCard label="Pending" value={String(pending)} />
        <StatCard label="Delivered" value={String(completed)} />
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Link href="/client/new-booking" className="btn">New booking</Link>
        <Link href="/client/bookings" className="btn-quiet">My bookings</Link>
        <Link href="/client/payments" className="btn-quiet">Add money</Link>
        <Link href="/client/reports" className="btn-quiet">Reports</Link>
      </div>

      <section className="card mt-6 overflow-x-auto">
        <h2 className="border-b border-neutral-200 px-4 py-3 text-sm font-bold">Recent bookings</h2>
        {recent.length === 0 ? (
          <Empty text="No bookings yet. Create your first booking to get started." />
        ) : (
          <table className="ledger-table">
            <thead>
              <tr>
                <th>Booking ID</th><th>Date</th><th>Receiver</th><th>Type</th>
                <th className="text-right">Amount</th><th>Status</th>
              </tr>
            </thead>
            <tbody>
              {recent.map((b) => (
                <tr key={b.id}>
                  <td><Link href={`/client/bookings/${b.id}`} className="font-medium text-primary hover:underline">{b.bookingId}</Link></td>
                  <td className="whitespace-nowrap">{fmtDate(b.bookingDate)}</td>
                  <td>{b.receiverName}</td>
                  <td>{label(b.shipmentType)}</td>
                  <td className="money text-right">{inr(b.totalAmount)}</td>
                  <td><Badge value={b.bookingStatus} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </>
  );
}
