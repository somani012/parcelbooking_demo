import { db } from "./db";

export async function getSettings() {
  return db.companySettings.upsert({ where: { id: 1 }, create: { id: 1 }, update: {} });
}
