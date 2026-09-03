import { Prisma } from "@prisma/client";

type Tx = Prisma.TransactionClient;

async function nextNumber(tx: Tx, key: string): Promise<number> {
  const counter = await tx.counter.upsert({
    where: { key },
    create: { key, value: 1 },
    update: { value: { increment: 1 } },
  });
  return counter.value;
}

export async function nextBookingId(tx: Tx): Promise<string> {
  const year = new Date().getFullYear();
  const n = await nextNumber(tx, `BK-${year}`);
  return `BK-${year}-${String(n).padStart(5, "0")}`;
}

export async function nextPaymentId(tx: Tx): Promise<string> {
  const year = new Date().getFullYear();
  const n = await nextNumber(tx, `PAY-${year}`);
  return `PAY-${year}-${String(n).padStart(5, "0")}`;
}

export async function nextTransactionId(tx: Tx): Promise<string> {
  const year = new Date().getFullYear();
  const n = await nextNumber(tx, `TXN-${year}`);
  return `TXN-${year}-${String(n).padStart(5, "0")}`;
}

export async function nextClientCode(tx: Tx): Promise<string> {
  const n = await nextNumber(tx, "CL");
  return `CL-${String(n).padStart(4, "0")}`;
}
