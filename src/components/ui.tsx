import { label } from "@/lib/money";

const BADGE: Record<string, string> = {
  BOOKED: "bg-primary-light text-primary-dark",
  PROCESSING: "bg-blue-50 text-blue-800",
  DISPATCHED: "bg-indigo-50 text-indigo-800",
  IN_TRANSIT: "bg-saffron-light text-saffron",
  DELIVERED: "bg-green-50 text-credit",
  CANCELLED: "bg-red-50 text-debit",
  DRAFT: "bg-neutral-100 text-neutral-600",
  PENDING: "bg-saffron-light text-saffron",
  APPROVED: "bg-green-50 text-credit",
  REJECTED: "bg-red-50 text-debit",
  ACTIVE: "bg-green-50 text-credit",
  DISABLED: "bg-neutral-200 text-neutral-600",
};

export function Badge({ value }: { value: string }) {
  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${BADGE[value] ?? "bg-neutral-100 text-neutral-600"}`}>
      {label(value)}
    </span>
  );
}

export function StatCard({ label: l, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className={`card px-4 py-3 ${accent ? "border-primary bg-primary-light/60" : ""}`}>
      <p className="text-[12px] font-medium text-neutral-500">{l}</p>
      <p className="money mt-0.5 text-xl font-bold">{value}</p>
    </div>
  );
}

export function PageTitle({ title, sub, children }: { title: string; sub?: string; children?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-xl font-bold">{title}</h1>
        {sub && <p className="mt-0.5 text-sm text-neutral-500">{sub}</p>}
      </div>
      {children && <div className="flex flex-wrap gap-2">{children}</div>}
    </div>
  );
}

export function Empty({ text }: { text: string }) {
  return <p className="px-3 py-10 text-center text-sm text-neutral-400">{text}</p>;
}

export function Detail({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 border-b border-neutral-100 py-2 text-sm last:border-0">
      <span className="text-neutral-500">{k}</span>
      <span className="text-right font-medium">{v}</span>
    </div>
  );
}
