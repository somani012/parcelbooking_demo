import Link from "next/link";
import { ShipmentType, BookingStatus } from "@prisma/client";
import { label } from "@/lib/money";

export function BookingFilters({
  services,
  clients,
  basePath,
  sp,
  showAdminFilters = false,
}: {
  services: { id: string; name: string }[];
  clients?: { id: string; companyName: string }[];
  basePath: string;
  sp: Record<string, string | string[] | undefined>;
  showAdminFilters?: boolean;
}) {
  const g = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : "");
  return (
    <form method="GET" action={basePath} className="card mb-4 grid grid-cols-2 gap-3 p-4 md:grid-cols-4">
      <div className="col-span-2">
        <label htmlFor="q">Search</label>
        <input id="q" name="q" defaultValue={g("q")} placeholder="Booking ID, receiver or tracking/AWB" />
      </div>
      <div>
        <label htmlFor="from">From date</label>
        <input id="from" name="from" type="date" defaultValue={g("from")} />
      </div>
      <div>
        <label htmlFor="to">To date</label>
        <input id="to" name="to" type="date" defaultValue={g("to")} />
      </div>
      <div>
        <label htmlFor="shipmentType">Shipment type</label>
        <select id="shipmentType" name="shipmentType" defaultValue={g("shipmentType")}>
          <option value="">All</option>
          {Object.values(ShipmentType).map((t) => (
            <option key={t} value={t}>{label(t)}</option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="serviceId">Service</label>
        <select id="serviceId" name="serviceId" defaultValue={g("serviceId")}>
          <option value="">All</option>
          {services.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="status">Status</label>
        <select id="status" name="status" defaultValue={g("status")}>
          <option value="">All</option>
          {Object.values(BookingStatus).map((s) => (
            <option key={s} value={s}>{label(s)}</option>
          ))}
        </select>
      </div>
      {showAdminFilters && (
        <>
          <div>
            <label htmlFor="clientId">Client</label>
            <select id="clientId" name="clientId" defaultValue={g("clientId")}>
              <option value="">All</option>
              {clients?.map((c) => (
                <option key={c.id} value={c.id}>{c.companyName}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="mobile">Mobile</label>
            <input id="mobile" name="mobile" defaultValue={g("mobile")} placeholder="Sender or receiver" />
          </div>
          <div>
            <label htmlFor="city">City</label>
            <input id="city" name="city" defaultValue={g("city")} placeholder="Sender or receiver" />
          </div>
        </>
      )}
      <div className="col-span-2 flex items-end gap-2 md:col-span-1">
        <button className="btn flex-1">Apply filters</button>
        <Link href={basePath} className="btn-quiet">Clear</Link>
      </div>
    </form>
  );
}
