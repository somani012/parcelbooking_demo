import { db } from "./db";
import { num, round2 } from "./money";

export type Quote = {
  serviceId: string;
  serviceName: string;
  weight: number;
  baseCharge: number;
  additionalCharge: number;
  gstPercent: number;
  gst: number;
  total: number;
};

/**
 * Server-side charge calculation. Never trust amounts sent by the browser.
 * - The pricing rule slab containing the weight gives the base price.
 * - If the weight exceeds every slab, the highest slab applies and
 *   additional_price is charged per started kg above that slab's maximum.
 */
export async function calculateCharges(serviceId: string, weight: number): Promise<Quote> {
  if (!Number.isFinite(weight) || weight <= 0) throw new Error("Enter a valid weight");

  const service = await db.service.findFirst({
    where: { id: serviceId, status: "ACTIVE" },
    include: { pricingRules: { where: { status: "ACTIVE" }, orderBy: { minimumWeight: "asc" } } },
  });
  if (!service) throw new Error("Service not available");
  if (service.pricingRules.length === 0) throw new Error(`No pricing configured for ${service.name}`);

  const rules = service.pricingRules;
  let base = 0;
  let additional = 0;

  const matched = rules.find((r) => weight >= num(r.minimumWeight) && weight <= num(r.maximumWeight));
  if (matched) {
    base = num(matched.basePrice);
  } else {
    const top = rules[rules.length - 1];
    if (weight < num(rules[0].minimumWeight)) {
      base = num(rules[0].basePrice);
    } else {
      base = num(top.basePrice);
      const extraKg = Math.ceil(weight - num(top.maximumWeight));
      additional = round2(extraKg * num(top.additionalPrice));
    }
  }

  const settings = await db.companySettings.findFirst();
  const gstPercent = settings ? num(settings.gstPercent) : 18;
  const gst = round2(((base + additional) * gstPercent) / 100);
  const total = round2(base + additional + gst);

  return {
    serviceId,
    serviceName: service.name,
    weight,
    baseCharge: round2(base),
    additionalCharge: additional,
    gstPercent,
    gst,
    total,
  };
}
