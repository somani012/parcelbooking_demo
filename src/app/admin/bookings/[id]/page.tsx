import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { inr, fmtDate, label, num } from "@/lib/money";
import { Badge, PageTitle, Detail } from "@/components/ui";
import { updateBookingStatus, cancelBooking } from "@/actions/admin";
import { SubmitButton } from "@/components/SubmitButton";
import { BookingStatus } from "@prisma/client";

export const dynamic = "force-dynamic";

export default async function AdminBookingDetail({ params }: { params: { id: string } }) {
  await requireAdmin();
  const b = await db.booking.findUnique({
    where: { id: params.id },
    include: { service: true, client: true },
  });
  if (!b) notFound();
  const cancellable = !["DELIVERED", "CANCELLED"].includes(b.bookingStatus);

  return (
    <>
      <PageTitle title={b.bookingId} sub={`${b.client.companyName} - booked ${fmtDate(b.bookingDate)}`}>
        <a href={`/api/slip/${b.id}`} className="btn-quiet">Download slip</a>
        <Link href="/admin/bookings" className="btn-quiet">Back</Link>
      </PageTitle>

      <div className="grid max-w-5xl gap-4 lg:grid-cols-2">
        <section className="card p-4">
          <h2 className="mb-3 text-sm font-bold">Update status and tracking</h2>
          {b.bookingStatus === "CANCELLED" ? (
            <p className="text-sm text-neutral-500">This booking is cancelled; the amount was refunded to the client&apos;s balance.</p>
          ) : (
            <form action={updateBookingStatus} className="space-y-3">
              <input type="hidden" name="id" value={b.id} />
              <div>
                <label htmlFor="status">Booking status</label>
                <select id="status" name="status" defaultValue={b.bookingStatus}>
                  {Object.values(BookingStatus).filter((s) => s !== "CANCELLED").map((s) => (
                    <option key={s} value={s}>{label(s)}</option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="trackingNumber">Tracking / AWB number</label>
                <input id="trackingNumber" name="trackingNumber" defaultValue={b.trackingNumber ?? ""} placeholder="e.g. EK123456789IN" />
              </div>
              <SubmitButton pendingText="Saving...">Save changes</SubmitButton>
            </form>
          )}
          {cancellable && (
            <form action={cancelBooking} className="mt-4 border-t border-neutral-100 pt-4">
              <input type="hidden" name="id" value={b.id} />
              <p className="mb-2 text-xs text-neutral-500">
                Cancelling refunds {inr(b.totalAmount)} to the client&apos;s balance and records a refund transaction.
              </p>
              <SubmitButton className="btn-danger" pendingText="Cancelling...">Cancel booking and refund</SubmitButton>
            </form>
          )}
        </section>

        <section className="card p-4">
          <h2 className="mb-2 text-sm font-bold">Summary</h2>
          <Detail k="Status" v={<Badge value={b.bookingStatus} />} />
          <Detail k="Payment" v={b.paymentStatus} />
          <Detail k="Client" v={<Link href={`/admin/clients/${b.clientId}`} className="text-primary hover:underline">{b.client.companyName}</Link>} />
          <Detail k="Service" v={b.service.name} />
          <Detail k="Shipment" v={`${label(b.shipmentType)}, ${num(b.weight)} kg, qty ${b.quantity}`} />
          <Detail k="Charges" v={`${inr(b.baseCharge)} + ${inr(b.additionalCharge)} + GST ${inr(b.gst)}`} />
          <Detail k="Total" v={<strong>{inr(b.totalAmount)}</strong>} />
        </section>

        <section className="card p-4">
          <h2 className="mb-2 text-sm font-bold">Sender</h2>
          <Detail k="Name" v={b.senderName} />
          {b.senderCompany && <Detail k="Company" v={b.senderCompany} />}
          <Detail k="Mobile" v={b.senderMobile} />
          <Detail k="Address" v={`${b.senderAddress}, ${b.senderCity}, ${b.senderState} - ${b.senderPin}`} />
        </section>
        <section className="card p-4">
          <h2 className="mb-2 text-sm font-bold">Receiver</h2>
          <Detail k="Name" v={b.receiverName} />
          {b.receiverCompany && <Detail k="Company" v={b.receiverCompany} />}
          <Detail k="Mobile" v={b.receiverMobile} />
          <Detail k="Address" v={`${b.receiverAddress}, ${b.receiverCity}, ${b.receiverState} - ${b.receiverPin}`} />
        </section>
      </div>
    </>
  );
}
