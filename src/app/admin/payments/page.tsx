import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { inr, fmtDate, fmtDateTime, label } from "@/lib/money";
import { Badge, PageTitle, Empty } from "@/components/ui";
import { approvePayment, rejectPayment } from "@/actions/payments";
import { SubmitButton } from "@/components/SubmitButton";

export const dynamic = "force-dynamic";

export default async function AdminPayments({ searchParams }: { searchParams: { error?: string } }) {
  await requireAdmin();
  const [pending, history] = await Promise.all([
    db.payment.findMany({ where: { status: "PENDING" }, include: { client: true }, orderBy: { createdAt: "asc" } }),
    db.payment.findMany({ where: { status: { not: "PENDING" } }, include: { client: true }, orderBy: { approvedAt: "desc" }, take: 50 }),
  ]);

  return (
    <>
      <PageTitle title="Payment verification" sub={`${pending.length} payment${pending.length === 1 ? "" : "s"} awaiting verification`} />
      {searchParams.error === "reason" && (
        <p className="field-error mb-4">A rejection reason is required. The payment was not rejected.</p>
      )}

      <div className="space-y-4">
        {pending.length === 0 && (
          <div className="card"><Empty text="Nothing to verify right now." /></div>
        )}
        {pending.map((p) => (
          <section key={p.id} className="card p-4">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-64">
                <p className="font-bold">{p.paymentId} <span className="ml-2"><Badge value={p.status} /></span></p>
                <p className="mt-1 text-sm">{p.client.companyName} ({p.client.clientCode})</p>
                <p className="mt-2 text-sm text-neutral-600">
                  <span className="money text-lg font-bold text-ink">{inr(p.amount)}</span> by {label(p.paymentMethod)} on {fmtDate(p.paymentDate)}
                </p>
                <p className="mt-1 text-sm text-neutral-600">UTR: <span className="font-medium text-ink">{p.utrNumber}</span></p>
                {p.screenshot ? (
                  <a href={`/api/screenshot/${p.id}`} target="_blank" className="mt-1 inline-block text-sm font-medium text-primary hover:underline">
                    View payment screenshot
                  </a>
                ) : (
                  <p className="mt-1 text-xs text-neutral-400">No screenshot attached</p>
                )}
              </div>

              <div className="flex flex-col gap-3">
                <form action={approvePayment}>
                  <input type="hidden" name="id" value={p.id} />
                  <SubmitButton pendingText="Approving...">Approve and credit {inr(p.amount)}</SubmitButton>
                </form>
                <form action={rejectPayment} className="flex flex-wrap items-start gap-2">
                  <input type="hidden" name="id" value={p.id} />
                  <input name="reason" required placeholder="Rejection reason (shown to client)" className="min-w-56 flex-1" />
                  <SubmitButton className="btn-danger" pendingText="Rejecting...">Reject</SubmitButton>
                </form>
              </div>
            </div>
          </section>
        ))}
      </div>

      <section className="card mt-8 overflow-x-auto">
        <h2 className="border-b border-neutral-200 px-4 py-3 text-sm font-bold">Verification history</h2>
        {history.length === 0 ? (
          <Empty text="No verified payments yet." />
        ) : (
          <table className="ledger-table">
            <thead>
              <tr><th>Payment ID</th><th>Client</th><th className="text-right">Amount</th><th>Method</th><th>UTR</th><th>Status</th><th>Decided</th><th>Note</th></tr>
            </thead>
            <tbody>
              {history.map((p) => (
                <tr key={p.id}>
                  <td className="font-medium">{p.paymentId}</td>
                  <td>{p.client.companyName}</td>
                  <td className="money text-right">{inr(p.amount)}</td>
                  <td>{label(p.paymentMethod)}</td>
                  <td>{p.utrNumber}</td>
                  <td><Badge value={p.status} /></td>
                  <td className="whitespace-nowrap">{p.approvedAt ? fmtDateTime(p.approvedAt) : "-"}</td>
                  <td className="max-w-[200px] text-neutral-500">{p.rejectionReason || "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </>
  );
}
