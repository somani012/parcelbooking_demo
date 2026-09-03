import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { inr, fmtDate, label, num } from "@/lib/money";
import { Badge, PageTitle, Empty, StatCard } from "@/components/ui";
import { ActionForm } from "@/components/ActionForm";
import { updateClient, toggleClientStatus, resetClientPassword, manualAdjustment } from "@/actions/admin";
import { SubmitButton } from "@/components/SubmitButton";

export const dynamic = "force-dynamic";

export default async function ClientDetail({ params }: { params: { id: string } }) {
  await requireAdmin();
  const client = await db.client.findUnique({
    where: { id: params.id },
    include: {
      bookings: { orderBy: { createdAt: "desc" }, take: 10 },
      transactions: { orderBy: { createdAt: "desc" }, take: 10 },
      payments: { orderBy: { createdAt: "desc" }, take: 10 },
    },
  });
  if (!client) notFound();
  const bookingCount = await db.booking.count({ where: { clientId: client.id } });

  return (
    <>
      <PageTitle title={`${client.companyName} (${client.clientCode})`} sub={`${client.contactPerson} - ${client.email}`}>
        <Link href={`/admin/bookings?clientId=${client.id}`} className="btn-quiet">All bookings</Link>
        <form action={toggleClientStatus}>
          <input type="hidden" name="id" value={client.id} />
          <SubmitButton className={client.status === "ACTIVE" ? "btn-danger" : "btn"}>
            {client.status === "ACTIVE" ? "Disable account" : "Enable account"}
          </SubmitButton>
        </form>
      </PageTitle>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Balance" value={inr(client.balance)} accent />
        <StatCard label="Total bookings" value={String(bookingCount)} />
        <StatCard label="Status" value={label(client.status)} />
        <StatCard label="Client since" value={fmtDate(client.createdAt)} />
      </div>

      <div className="mt-6 grid gap-4 xl:grid-cols-2">
        <section className="card p-4">
          <h2 className="mb-3 text-sm font-bold">Client details</h2>
          <ActionForm action={updateClient} submitLabel="Save changes" className="grid gap-3 sm:grid-cols-2">
            <input type="hidden" name="id" value={client.id} />
            <div><label>Company name</label><input name="companyName" defaultValue={client.companyName} required /></div>
            <div><label>Contact person</label><input name="contactPerson" defaultValue={client.contactPerson} required /></div>
            <div><label>Mobile</label><input name="phone" defaultValue={client.phone} required /></div>
            <div><label>GST number</label><input name="gstNumber" defaultValue={client.gstNumber ?? ""} /></div>
            <div className="sm:col-span-2"><label>Address</label><input name="address" defaultValue={client.address} required /></div>
            <div><label>City</label><input name="city" defaultValue={client.city} required /></div>
            <div><label>State</label><input name="state" defaultValue={client.state} required /></div>
            <div><label>PIN code</label><input name="pinCode" defaultValue={client.pinCode} pattern="\d{6}" required /></div>
          </ActionForm>
        </section>

        <div className="space-y-4">
          <section className="card p-4">
            <h2 className="mb-3 text-sm font-bold">Manual balance adjustment</h2>
            <p className="mb-3 text-xs text-neutral-500">Creates a ledger entry and an audit record. Use for corrections and offline settlements.</p>
            <ActionForm action={manualAdjustment} submitLabel="Apply adjustment" resetOnSuccess className="grid gap-3 sm:grid-cols-3">
              <input type="hidden" name="clientId" value={client.id} />
              <div>
                <label>Type</label>
                <select name="type" defaultValue="MANUAL_CREDIT">
                  <option value="MANUAL_CREDIT">Credit (add)</option>
                  <option value="MANUAL_DEBIT">Debit (deduct)</option>
                </select>
              </div>
              <div><label>Amount (&#8377;)</label><input name="amount" type="number" step="0.01" min="0.01" required /></div>
              <div className="sm:col-span-3"><label>Reason *</label><input name="description" required placeholder="e.g. Cash received at office" /></div>
            </ActionForm>
          </section>

          <section className="card p-4">
            <h2 className="mb-3 text-sm font-bold">Reset login password</h2>
            <ActionForm action={resetClientPassword} submitLabel="Reset password" resetOnSuccess className="flex flex-wrap items-end gap-3">
              <input type="hidden" name="id" value={client.id} />
              <div className="min-w-52 flex-1"><label>New password</label><input name="password" type="text" minLength={6} required /></div>
            </ActionForm>
          </section>
        </div>
      </div>

      <div className="mt-6 grid gap-4 xl:grid-cols-2">
        <section className="card overflow-x-auto">
          <h2 className="border-b border-neutral-200 px-4 py-3 text-sm font-bold">Recent bookings</h2>
          {client.bookings.length === 0 ? <Empty text="No bookings." /> : (
            <table className="ledger-table">
              <thead><tr><th>Booking ID</th><th>Date</th><th className="text-right">Amount</th><th>Status</th></tr></thead>
              <tbody>
                {client.bookings.map((b) => (
                  <tr key={b.id}>
                    <td><Link href={`/admin/bookings/${b.id}`} className="font-medium text-primary hover:underline">{b.bookingId}</Link></td>
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
          <h2 className="border-b border-neutral-200 px-4 py-3 text-sm font-bold">Recent transactions</h2>
          {client.transactions.length === 0 ? <Empty text="No transactions." /> : (
            <table className="ledger-table">
              <thead><tr><th>Date</th><th>Type</th><th className="text-right">Amount</th><th className="text-right">Balance after</th></tr></thead>
              <tbody>
                {client.transactions.map((t) => {
                  const amt = num(t.amount);
                  return (
                    <tr key={t.id}>
                      <td className="whitespace-nowrap">{fmtDate(t.createdAt)}</td>
                      <td>{label(t.transactionType)}</td>
                      <td className={`money text-right font-semibold ${amt >= 0 ? "text-credit" : "text-debit"}`}>
                        {amt >= 0 ? "+" : "-"}{inr(Math.abs(amt))}
                      </td>
                      <td className="money text-right">{inr(t.balanceAfter)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </section>
      </div>
    </>
  );
}
