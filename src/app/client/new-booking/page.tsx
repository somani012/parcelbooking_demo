import { requireClient } from "@/lib/auth";
import { db } from "@/lib/db";
import { num } from "@/lib/money";
import { PageTitle } from "@/components/ui";
import { BookingForm } from "./BookingForm";

export const dynamic = "force-dynamic";

export default async function NewBookingPage() {
  const session = await requireClient();
  const [client, services] = await Promise.all([
    db.client.findUniqueOrThrow({ where: { id: session.clientId } }),
    db.service.findMany({ where: { status: "ACTIVE" }, orderBy: { name: "asc" } }),
  ]);

  return (
    <>
      <PageTitle title="New booking" sub="Charges are calculated by the system before you confirm." />
      <BookingForm
        services={services.map((s) => ({ id: s.id, name: s.name }))}
        balance={num(client.balance)}
        senderDefaults={{
          senderName: client.contactPerson,
          senderCompany: client.companyName,
          senderMobile: client.phone,
          senderAddress: client.address,
          senderCity: client.city,
          senderState: client.state,
          senderPin: client.pinCode,
        }}
      />
    </>
  );
}
