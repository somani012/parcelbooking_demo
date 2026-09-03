import { requireClient } from "@/lib/auth";
import { db } from "@/lib/db";
import { inr, fmtDate, label, num } from "@/lib/money";
import { PageTitle, Empty } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function Transactions() {
  const session = await requireClient();
  const [client, txns] = await Promise.all([
    db.client.findUniqueOrThrow({ where: { id: session.clientId } }),
    db.transaction.findMany({ where: { clientId: session.clientId }, orderBy: { createdAt: "desc" }, take: 300 }),
  ]);

  return (
    <>
      <PageTitle title="Transactions" sub={`Current balance: ${inr(client.balance)}`} />
      <div className="card overflow-x-auto">
        {txns.length === 0 ? (
          <Empty text="No transactions yet." />
        ) : (
          <table className="ledger-table">
            <thead>
              <tr><th>Date</th><th>Transaction ID</th><th>Type</th><th className="text-right">Amount</th><th className="text-right">Balance after</th><th>Reference</th></tr>
            </thead>
            <tbody>
              {txns.map((t) => {
                const amt = num(t.amount);
                return (
                  <tr key={t.id}>
                    <td className="whitespace-nowrap">{fmtDate(t.createdAt)}</td>
                    <td className="font-medium">{t.transactionId}</td>
                    <td>{label(t.transactionType)}</td>
                    <td className={`money text-right font-semibold ${amt >= 0 ? "text-credit" : "text-debit"}`}>
                      {amt >= 0 ? "+" : "-"}{inr(Math.abs(amt))}
                    </td>
                    <td className="money text-right">{inr(t.balanceAfter)}</td>
                    <td>{t.referenceId || "-"}</td>
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
