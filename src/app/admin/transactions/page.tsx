import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { inr, fmtDateTime, label, num } from "@/lib/money";
import { PageTitle, Empty } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function AdminTransactions({ searchParams }: { searchParams: { clientId?: string } }) {
  await requireAdmin();
  const clients = await db.client.findMany({ orderBy: { companyName: "asc" }, select: { id: true, companyName: true } });
  const txns = await db.transaction.findMany({
    where: searchParams.clientId ? { clientId: searchParams.clientId } : undefined,
    include: { client: true },
    orderBy: { createdAt: "desc" },
    take: 300,
  });

  return (
    <>
      <PageTitle title="Transaction ledger" sub="Every balance change across all clients" />
      <form method="GET" className="mb-4 flex max-w-md items-end gap-2">
        <div className="flex-1">
          <label htmlFor="clientId">Client</label>
          <select id="clientId" name="clientId" defaultValue={searchParams.clientId ?? ""}>
            <option value="">All clients</option>
            {clients.map((c) => <option key={c.id} value={c.id}>{c.companyName}</option>)}
          </select>
        </div>
        <button className="btn-quiet">Filter</button>
      </form>

      <div className="card overflow-x-auto">
        {txns.length === 0 ? (
          <Empty text="No transactions recorded." />
        ) : (
          <table className="ledger-table">
            <thead>
              <tr><th>When</th><th>Transaction ID</th><th>Client</th><th>Type</th><th className="text-right">Amount</th><th className="text-right">Balance after</th><th>Description</th></tr>
            </thead>
            <tbody>
              {txns.map((t) => {
                const amt = num(t.amount);
                return (
                  <tr key={t.id}>
                    <td className="whitespace-nowrap">{fmtDateTime(t.createdAt)}</td>
                    <td className="font-medium">{t.transactionId}</td>
                    <td>{t.client.companyName}</td>
                    <td>{label(t.transactionType)}</td>
                    <td className={`money text-right font-semibold ${amt >= 0 ? "text-credit" : "text-debit"}`}>
                      {amt >= 0 ? "+" : "-"}{inr(Math.abs(amt))}
                    </td>
                    <td className="money text-right">{inr(t.balanceAfter)}</td>
                    <td className="max-w-[260px] text-neutral-500">{t.description || t.referenceId || "-"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
