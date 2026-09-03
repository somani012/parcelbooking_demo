import { requireAdmin } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { Shell } from "@/components/Shell";

export const dynamic = "force-dynamic";

const NAV = [
  { href: "/admin/dashboard", label: "Dashboard" },
  { href: "/admin/bookings", label: "Bookings" },
  { href: "/admin/payments", label: "Payments" },
  { href: "/admin/clients", label: "Clients" },
  { href: "/admin/transactions", label: "Transactions" },
  { href: "/admin/services", label: "Services" },
  { href: "/admin/pricing", label: "Pricing" },
  { href: "/admin/reports", label: "Reports" },
  { href: "/admin/settings", label: "Settings" },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await requireAdmin();
  const settings = await getSettings();
  return (
    <Shell nav={NAV} userName={session.name} roleLabel="Admin console" companyName={settings.companyName}>
      {children}
    </Shell>
  );
}
