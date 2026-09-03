import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { inr, fmtDate, label, num } from "@/lib/money";
import { buildBookingWhere, paramsFromSearch } from "@/lib/filters";
import { Badge, PageTitle, Empty } from "@/components/ui";
import { BookingFilters } from "@/components/BookingFilters";

export const dynamic = "force-dynamic";

export default async function AdminBookings({ searchParams }: { searchParams: Record<string, string | string[] | undefined> }) {
  await requireAdmin();
  const where = buildBookingWhere(paramsFromSearch(searchParams));
  const [bookings, services, clients] = await Promise.all([
    db.booking.findMany({ where, include: { service: true, client: true }, orderBy: { createdAt: "desc" }, take: 200 }),
    db.service.findMany({ orderBy: { name: "asc" } }),
    db.client.findMany({ orderBy: { companyName: "asc" }, select: { id: true, companyName: true } }),
  ]);
  const qs = new URLSearchParams(
    Object.entries(searchParams).filter(([, v]) => typeof v === "string" && v) as [string, string][]
  ).toString();

  return (
    <>
      <PageTitle title="Bookings" sub={`${bookings.length} booking${bookings.length === 1 ? "" : "s"} shown`}>
        <a href={`/api/export/bookings${qs ? `?${qs}` : ""}`} className="btn-quiet">Export to Excel</a>
      </PageTitle>

      <BookingFilters services={services} clients={clients} basePath="/admin/bookings" sp={searchParams} showAdminFilters />

      <div className="card overflow-x-auto">
        {bookings.length === 0 ? (
          <Empty text="No bookings match these filters." />
        ) : (
          <table className="ledger-table">
            <thead>
              <tr>
                <th>Booking ID</th><th>Client</th><th>Date</th><th>Receiver</th><th>Type / Service</th>
                <th className="text-right">Weight</th><th className="text-right">Amount</th><th>Status</th><th>Action</th>
              </tr>
            </thead>
            <tbody>
              {bookings.map((b) => (
                <tr key={b.id}>
                  <td className="font-medium">{b.bookingId}</td>
                  <td>{b.client.companyName}</td>
                  <td className="whitespace-nowrap">{fmtDate(b.bookingDate)}</td>
                  <td>{b.receiverName}<br /><span className="text-xs text-neutral-400">{b.receiverCity}</span></td>
                  <td>{label(b.shipmentType)}<br /><span className="text-xs text-neutral-400">{b.service.name}</span></td>
                  <td className="money text-right">{num(b.weight)} kg</td>
                  <td className="money text-right">{inr(b.totalAmount)}</td>
                  <td><Badge value={b.bookingStatus} /></td>
                  <td className="whitespace-nowrap">
                    <Link href={`/admin/bookings/${b.id}`} className="font-medium text-primary hover:underline">Manage</Link>
                    <span className="mx-1 text-neutral-300">|</span>
                    <a href={`/api/slip/${b.id}`} className="font-medium text-primary hover:underline">PDF</a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
