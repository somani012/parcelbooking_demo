import { requireClient } from "@/lib/auth";
import { db } from "@/lib/db";
import { inr, fmtDate } from "@/lib/money";
import { PageTitle, Detail, Badge } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function Profile() {
  const session = await requireClient();
  const client = await db.client.findUniqueOrThrow({ where: { id: session.clientId } });
  return (
    <>
      <PageTitle title="Profile" sub="Contact the office to update these details." />
      <div className="card max-w-lg p-4">
        <Detail k="Client code" v={client.clientCode} />
        <Detail k="Company" v={client.companyName} />
        <Detail k="Contact person" v={client.contactPerson} />
        <Detail k="Email" v={client.email} />
        <Detail k="Mobile" v={client.phone} />
        <Detail k="Address" v={`${client.address}, ${client.city}, ${client.state} - ${client.pinCode}`} />
        <Detail k="GST number" v={client.gstNumber || "-"} />
        <Detail k="Account status" v={<Badge value={client.status} />} />
        <Detail k="Balance" v={inr(client.balance)} />
        <Detail k="Client since" v={fmtDate(client.createdAt)} />
      </div>
    </>
  );
}
