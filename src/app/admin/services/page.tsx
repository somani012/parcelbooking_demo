import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { PageTitle, Badge, Empty } from "@/components/ui";
import { ActionForm } from "@/components/ActionForm";
import { saveService, toggleService } from "@/actions/admin";
import { SubmitButton } from "@/components/SubmitButton";

export const dynamic = "force-dynamic";

export default async function ServicesPage({ searchParams }: { searchParams: { edit?: string } }) {
  await requireAdmin();
  const services = await db.service.findMany({ orderBy: { name: "asc" }, include: { _count: { select: { pricingRules: true, bookings: true } } } });
  const editing = searchParams.edit ? services.find((s) => s.id === searchParams.edit) : undefined;

  return (
    <>
      <PageTitle title="Services" sub="Service types offered to clients (e.g. Speed Post, Courier)" />

      <section className="card mb-6 max-w-xl p-4">
        <h2 className="mb-3 text-sm font-bold">{editing ? `Edit "${editing.name}"` : "Add a service"}</h2>
        <ActionForm key={editing?.id ?? "new"} action={saveService} submitLabel={editing ? "Save service" : "Add service"} resetOnSuccess={!editing}>
          {editing && <input type="hidden" name="id" value={editing.id} />}
          <div><label>Service name *</label><input name="name" defaultValue={editing?.name} required /></div>
          <div><label>Description</label><input name="description" defaultValue={editing?.description ?? ""} placeholder="Shown to clients while booking" /></div>
        </ActionForm>
        {editing && <Link href="/admin/services" className="mt-2 inline-block text-sm text-primary hover:underline">Cancel editing</Link>}
      </section>

      <div className="card max-w-3xl overflow-x-auto">
        {services.length === 0 ? (
          <Empty text="No services yet. Add your first service above." />
        ) : (
          <table className="ledger-table">
            <thead><tr><th>Service</th><th>Description</th><th className="text-right">Pricing rules</th><th>Status</th><th>Action</th></tr></thead>
            <tbody>
              {services.map((s) => (
                <tr key={s.id}>
                  <td className="font-medium">{s.name}</td>
                  <td className="text-neutral-500">{s.description || "-"}</td>
                  <td className="money text-right">{s._count.pricingRules}</td>
                  <td><Badge value={s.status} /></td>
                  <td className="whitespace-nowrap">
                    <Link href={`/admin/services?edit=${s.id}`} className="font-medium text-primary hover:underline">Edit</Link>
                    <span className="mx-1 text-neutral-300">|</span>
                    <form action={toggleService} className="inline">
                      <input type="hidden" name="id" value={s.id} />
                      <SubmitButton className="font-medium text-primary hover:underline">
                        {s.status === "ACTIVE" ? "Disable" : "Enable"}
                      </SubmitButton>
                    </form>
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
