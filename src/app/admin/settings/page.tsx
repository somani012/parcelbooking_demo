import { requireAdmin } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { num } from "@/lib/money";
import { PageTitle } from "@/components/ui";
import { ActionForm } from "@/components/ActionForm";
import { saveSettings } from "@/actions/admin";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  await requireAdmin();
  const s = await getSettings();

  return (
    <>
      <PageTitle title="Company settings" sub="Shown on the login page, payment instructions and booking slips" />
      <div className="max-w-3xl">
        <ActionForm action={saveSettings} submitLabel="Save settings" pendingLabel="Saving..." className="space-y-6">
          <section className="card grid gap-3 p-4 sm:grid-cols-2">
            <h2 className="text-sm font-bold sm:col-span-2">Company</h2>
            <div><label>Company name</label><input name="companyName" defaultValue={s.companyName} required /></div>
            <div><label>Phone</label><input name="phone" defaultValue={s.phone} /></div>
            <div className="sm:col-span-2"><label>Address</label><input name="address" defaultValue={s.address} /></div>
            <div><label>Email</label><input name="email" type="email" defaultValue={s.email} /></div>
            <div><label>GST number</label><input name="gstNumber" defaultValue={s.gstNumber ?? ""} /></div>
            <div><label>GST % applied to bookings</label><input name="gstPercent" type="number" step="0.01" min="0" max="100" defaultValue={num(s.gstPercent)} /></div>
            <div>
              <label>Logo (PNG/JPEG, under 1 MB)</label>
              <input name="logo" type="file" accept="image/png,image/jpeg" className="text-sm" />
              {s.logo && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src="/api/logo" alt="Current logo" className="mt-2 h-12 rounded border border-neutral-200 bg-white p-1" />
              )}
            </div>
          </section>

          <section className="card grid gap-3 p-4 sm:grid-cols-2">
            <h2 className="text-sm font-bold sm:col-span-2">Payment collection</h2>
            <div><label>UPI ID</label><input name="upiId" defaultValue={s.upiId} placeholder="business@upi" /></div>
            <div><label>Account holder name</label><input name="accountName" defaultValue={s.accountName} /></div>
            <div><label>Bank name</label><input name="bankName" defaultValue={s.bankName} /></div>
            <div><label>Account number</label><input name="accountNumber" defaultValue={s.accountNumber} /></div>
            <div><label>IFSC</label><input name="ifsc" defaultValue={s.ifsc} /></div>
            <div><label>Branch</label><input name="branch" defaultValue={s.branch} /></div>
          </section>

          <section className="card p-4">
            <h2 className="mb-3 text-sm font-bold">Booking slip footer / terms</h2>
            <textarea name="terms" rows={3} defaultValue={s.terms} placeholder="Terms and conditions printed at the bottom of every booking slip" />
          </section>
        </ActionForm>
      </div>
    </>
  );
}
