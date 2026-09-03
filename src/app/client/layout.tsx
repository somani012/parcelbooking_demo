import { requireClient } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { Shell } from "@/components/Shell";

export const dynamic = "force-dynamic";

const NAV = [
  { href: "/client/dashboard", label: "Dashboard" },
  { href: "/client/new-booking", label: "New Booking" },
  { href: "/client/bookings", label: "My Bookings" },
  { href: "/client/payments", label: "Payments / Balance" },
  { href: "/client/transactions", label: "Transactions" },
  { href: "/client/reports", label: "Reports" },
  { href: "/client/profile", label: "Profile" },
];

export default async function ClientLayout({ children }: { children: React.ReactNode }) {
  const session = await requireClient();
  const settings = await getSettings();
  return (
    <Shell nav={NAV} userName={session.name} roleLabel="Client portal" companyName={settings.companyName}>
      {children}
    </Shell>
  );
}
