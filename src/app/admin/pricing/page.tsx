import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { inr, num } from "@/lib/money";
import { PageTitle, Empty } from "@/components/ui";
import { ActionForm } from "@/components/ActionForm";
import { savePricingRule, deletePricingRule } from "@/actions/admin";
import { SubmitButton } from "@/components/SubmitButton";

export const dynamic = "force-dynamic";

export default async function PricingPage() {
  await requireAdmin();
  const services = await db.service.findMany({
    orderBy: { name: "asc" },
    include: { pricingRules: { orderBy: { minimumWeight: "asc" } } },
  });

  return (
    <>
      <PageTitle title="Pricing" sub="Weight slabs per service. Above the top slab, the additional price applies per started kg." />

      <section className="card mb-6 max-w-3xl p-4">
        <h2 className="mb-3 text-sm font-bold">Add a pricing rule</h2>
        <ActionForm action={savePricingRule} submitLabel="Add rule" resetOnSuccess className="grid gap-3 sm:grid-cols-5">
          <div>
            <label>Service *</label>
            <select name="serviceId" required defaultValue="">
              <option value="" disabled>Select</option>
              {services.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div><label>Min weight (kg) *</label><input name="minimumWeight" type="number" step="0.001" min="0" required /></div>
          <div><label>Max weight (kg) *</label><input name="maximumWeight" type="number" step="0.001" min="0.001" required /></div>
          <div><label>Base price (&#8377;) *</label><input name="basePrice" type="number" step="0.01" min="0.01" required /></div>
          <div><label>Add-on / extra kg (&#8377;)</label><input name="additionalPrice" type="number" step="0.01" min="0" defaultValue="0" /></div>
        </ActionForm>
      </section>

      <div className="grid max-w-5xl gap-4 lg:grid-cols-2">
        {services.map((s) => (
          <section key={s.id} className="card overflow-x-auto">
            <h2 className="border-b border-neutral-200 px-4 py-3 text-sm font-bold">{s.name}</h2>
            {s.pricingRules.length === 0 ? (
              <Empty text="No pricing rules yet. Bookings for this service will fail until one is added." />
            ) : (
              <table className="ledger-table">
                <thead><tr><th>Weight range</th><th className="text-right">Base price</th><th className="text-right">Per extra kg</th><th></th></tr></thead>
                <tbody>
                  {s.pricingRules.map((r) => (
                    <tr key={r.id}>
                      <td>{num(r.minimumWeight)} - {num(r.maximumWeight)} kg</td>
                      <td className="money text-right">{inr(r.basePrice)}</td>
                      <td className="money text-right">{inr(r.additionalPrice)}</td>
                      <td className="text-right">
                        <form action={deletePricingRule} className="inline">
                          <input type="hidden" name="id" value={r.id} />
                          <SubmitButton className="text-sm font-medium text-debit hover:underline">Delete</SubmitButton>
                        </form>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        ))}
      </div>
    </>
  );
}
