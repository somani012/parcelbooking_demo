import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { inr, fmtDate } from "@/lib/money";
import { Badge, PageTitle, Empty } from "@/components/ui";
import { ActionForm } from "@/components/ActionForm";
import { createClient } from "@/actions/admin";

export const dynamic = "force-dynamic";

export default async function ClientsPage({ searchParams }: { searchParams: { q?: string; new?: string } }) {
  await requireAdmin();
  const q = searchParams.q?.trim();
  const clients = await db.client.findMany({
    where: q
      ? {
          OR: [
            { companyName: { contains: q, mode: "insensitive" } },
            { contactPerson: { contains: q, mode: "insensitive" } },
            { email: { contains: q, mode: "insensitive" } },
            { phone: { contains: q } },
            { clientCode: { contains: q, mode: "insensitive" } },
          ],
        }
      : undefined,
    orderBy: { createdAt: "desc" },
  });

  return (
    <>
      <PageTitle title="Clients" sub={`${clients.length} client${clients.length === 1 ? "" : "s"}`}>
        <Link href={searchParams.new ? "/admin/clients" : "/admin/clients?new=1"} className="btn">
          {searchParams.new ? "Close form" : "Add client"}
        </Link>
      </PageTitle>

      {searchParams.new && (
        <section className="card mb-6 max-w-3xl p-4">
          <h2 className="mb-3 text-sm font-bold">New client account</h2>
          <ActionForm action={createClient} submitLabel="Create client" pendingLabel="Creating..." resetOnSuccess className="grid gap-3 sm:grid-cols-2">
            <div><label>Company name *</label><input name="companyName" required /></div>
            <div><label>Contact person *</label><input name="contactPerson" required /></div>
            <div><label>Email (used to log in) *</label><input name="email" type="email" required /></div>
            <div><label>Mobile (used to log in) *</label><input name="phone" required /></div>
            <div className="sm:col-span-2"><label>Address *</label><input name="address" required /></div>
            <div><label>City *</label><input name="city" required /></div>
            <div><label>State *</label><input name="state" required /></div>
            <div><label>PIN code *</label><input name="pinCode" pattern="\d{6}" required /></div>
            <div><label>GST number</label><input name="gstNumber" /></div>
            <div><label>Login password *</label><input name="password" type="text" minLength={6} required placeholder="Share this with the client" /></div>
          </ActionForm>
        </section>
      )}

      <form method="GET" action="/admin/clients" className="mb-4 flex max-w-md gap-2">
        <input name="q" defaultValue={q} placeholder="Search company, person, email, mobile or code" />
        <button className="btn-quiet">Search</button>
      </form>

      <div className="card overflow-x-auto">
        {clients.length === 0 ? (
          <Empty text="No clients found." />
        ) : (
          <table className="ledger-table">
            <thead>
              <tr><th>Code</th><th>Company</th><th>Contact</th><th>City</th><th className="text-right">Balance</th><th>Status</th><th>Since</th></tr>
            </thead>
            <tbody>
              {clients.map((c) => (
                <tr key={c.id}>
                  <td><Link href={`/admin/clients/${c.id}`} className="font-medium text-primary hover:underline">{c.clientCode}</Link></td>
                  <td>{c.companyName}</td>
                  <td>{c.contactPerson}<br /><span className="text-xs text-neutral-400">{c.phone}</span></td>
                  <td>{c.city}</td>
                  <td className="money text-right">{inr(c.balance)}</td>
                  <td><Badge value={c.status} /></td>
                  <td className="whitespace-nowrap">{fmtDate(c.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
