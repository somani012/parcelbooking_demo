import Link from "next/link";
import { notFound } from "next/navigation";
import { requireClient } from "@/lib/auth";
import { db } from "@/lib/db";
import { inr, fmtDate, label, num } from "@/lib/money";
import { Badge, PageTitle, Detail } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function BookingDetail({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { created?: string };
}) {
  const session = await requireClient();
  const b = await db.booking.findFirst({
    where: { id: params.id, clientId: session.clientId },
    include: { service: true },
  });
  if (!b) notFound();

  return (
    <>
      {searchParams.created && (
        <p className="field-ok mb-4">Booking confirmed. The amount has been deducted from your balance and your slip is ready below.</p>
      )}
      <PageTitle title={b.bookingId} sub={`Booked ${fmtDate(b.bookingDate)}`}>
        <a href={`/api/slip/${b.id}`} className="btn">Download booking slip</a>
        <Link href="/client/bookings" className="btn-quiet">Back to bookings</Link>
      </PageTitle>

      <div className="grid max-w-4xl gap-4 md:grid-cols-2">
        <section className="card p-4">
          <h2 className="mb-2 text-sm font-bold">Status</h2>
          <Detail k="Booking status" v={<Badge value={b.bookingStatus} />} />
          <Detail k="Payment" v={b.paymentStatus} />
          <Detail k="Tracking / AWB" v={b.trackingNumber || "Not assigned yet"} />
        </section>
        <section className="card p-4">
          <h2 className="mb-2 text-sm font-bold">Charges</h2>
          <Detail k="Base charge" v={inr(b.baseCharge)} />
          <Detail k="Additional charge" v={inr(b.additionalCharge)} />
          <Detail k="GST" v={inr(b.gst)} />
          <Detail k="Total amount" v={<strong>{inr(b.totalAmount)}</strong>} />
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
        <section className="card p-4 md:col-span-2">
          <h2 className="mb-2 text-sm font-bold">Shipment</h2>
          <div className="grid gap-x-8 md:grid-cols-2">
            <Detail k="Shipment type" v={label(b.shipmentType)} />
            <Detail k="Service" v={b.service.name} />
            <Detail k="Weight" v={`${num(b.weight)} kg`} />
            <Detail k="Quantity" v={String(b.quantity)} />
            <Detail k="Dimensions" v={b.length && b.width && b.height ? `${num(b.length)} x ${num(b.width)} x ${num(b.height)} cm` : "-"} />
            <Detail k="Contents" v={b.description || "-"} />
          </div>
        </section>
      </div>
    </>
  );
}
