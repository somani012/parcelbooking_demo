import { Prisma } from "@prisma/client";
import type { Session } from "./auth";

export async function logAudit(
  tx: Prisma.TransactionClient,
  user: Session,
  action: string,
  entity: string,
  entityId: string,
  detail?: string
) {
  await tx.auditLog.create({
    data: { userId: user.uid, userName: user.name, action, entity, entityId, detail },
  });
}
