import QRCode from "qrcode";
import { requireClient } from "@/lib/auth";
import { db } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { inr, fmtDate, label } from "@/lib/money";
import { Badge, PageTitle, Empty, Detail } from "@/components/ui";
import { PaymentForm } from "./PaymentForm";

export const dynamic = "force-dynamic";

export default async function PaymentsPage() {
  const session = await requireClient();
  const [client, settings, payments] = await Promise.all([
    db.client.findUniqueOrThrow({ where: { id: session.clientId } }),
    getSettings(),
    db.payment.findMany({ where: { clientId: session.clientId }, orderBy: { createdAt: "desc" }, take: 100 }),
  ]);

  let qr: string | null = null;
  if (settings.upiId) {
    const upiUrl = `upi://pay?pa=${encodeURIComponent(settings.upiId)}&pn=${encodeURIComponent(settings.accountName || settings.companyName)}&cu=INR`;
    qr = await QRCode.toDataURL(upiUrl, { margin: 1, width: 220 });
  }

  return (
    <>
      <PageTitle title="Payments and balance" sub={`Available balance: ${inr(client.balance)}`} />

      <div className="grid max-w-5xl gap-4 lg:grid-cols-3">
        <section className="card p-4">
          <h2 className="mb-2 text-sm font-bold">Pay by UPI</h2>
          {settings.upiId ? (
            <>
              {qr && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={qr} alt={`UPI QR code for ${settings.upiId}`} className="mx-auto rounded border border-neutral-200" width={180} height={180} />
              )}
              <Detail k="UPI ID" v={settings.upiId} />
              <Detail k="Account name" v={settings.accountName || settings.companyName} />
            </>
          ) : (
            <p className="text-sm text-neutral-500">UPI details have not been configured yet.</p>
          )}
        </section>

        <section className="card p-4">
          <h2 className="mb-2 text-sm font-bold">Pay by bank transfer</h2>
          {settings.accountNumber ? (
            <>
              <Detail k="Account name" v={settings.accountName} />
              <Detail k="Bank" v={settings.bankName} />
              <Detail k="Account number" v={settings.accountNumber} />
              <Detail k="IFSC" v={settings.ifsc} />
              <Detail k="Branch" v={settings.branch || "-"} />
            </>
          ) : (
            <p className="text-sm text-neutral-500">Bank details have not been configured yet.</p>
          )}
        </section>

        <section className="card p-4">
          <h2 className="mb-2 text-sm font-bold">Submit payment details</h2>
          <p className="mb-3 text-xs text-neutral-500">
            After paying by UPI or bank transfer, enter the details here. Your balance updates once the admin verifies and approves the payment.
          </p>
          <PaymentForm />
        </section>
      </div>

      <section className="card mt-6 max-w-5xl overflow-x-auto">
        <h2 className="border-b border-neutral-200 px-4 py-3 text-sm font-bold">Payment history</h2>
        {payments.length === 0 ? (
          <Empty text="No payments submitted yet." />
        ) : (
          <table className="ledger-table">
            <thead>
              <tr><th>Payment ID</th><th>Date</th><th className="text-right">Amount</th><th>Method</th><th>UTR</th><th>Status</th><th>Note</th></tr>
            </thead>
            <tbody>
              {payments.map((p) => (
                <tr key={p.id}>
                  <td className="font-medium">{p.paymentId}</td>
                  <td className="whitespace-nowrap">{fmtDate(p.paymentDate)}</td>
                  <td className="money text-right">{inr(p.amount)}</td>
                  <td>{label(p.paymentMethod)}</td>
                  <td>{p.utrNumber}</td>
                  <td><Badge value={p.status} /></td>
                  <td className="max-w-[220px] text-neutral-500">
                    {p.status === "REJECTED" ? p.rejectionReason : p.status === "PENDING" ? "Pending verification" : "Credited to balance"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </>
  );
}
