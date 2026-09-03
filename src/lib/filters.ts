import { Prisma, ShipmentType, BookingStatus } from "@prisma/client";

export type BookingFilterParams = {
  q?: string; // booking id / receiver / tracking free text
  from?: string;
  to?: string;
  shipmentType?: string;
  serviceId?: string;
  status?: string;
  clientId?: string; // admin only
  mobile?: string; // admin only
  city?: string; // admin only
};

const SHIPMENT_TYPES = new Set(Object.values(ShipmentType));
const BOOKING_STATUSES = new Set(Object.values(BookingStatus));

export function buildBookingWhere(p: BookingFilterParams, forcedClientId?: string): Prisma.BookingWhereInput {
  const where: Prisma.BookingWhereInput = {};
  const and: Prisma.BookingWhereInput[] = [];

  if (forcedClientId) where.clientId = forcedClientId;
  else if (p.clientId) where.clientId = p.clientId;

  if (p.q?.trim()) {
    const q = p.q.trim();
    and.push({
      OR: [
        { bookingId: { contains: q, mode: "insensitive" } },
        { receiverName: { contains: q, mode: "insensitive" } },
        { trackingNumber: { contains: q, mode: "insensitive" } },
      ],
    });
  }
  if (p.from) {
    const d = new Date(p.from);
    if (!isNaN(d.getTime())) and.push({ bookingDate: { gte: d } });
  }
  if (p.to) {
    const d = new Date(p.to);
    if (!isNaN(d.getTime())) {
      d.setHours(23, 59, 59, 999);
      and.push({ bookingDate: { lte: d } });
    }
  }
  if (p.shipmentType && SHIPMENT_TYPES.has(p.shipmentType as ShipmentType)) {
    where.shipmentType = p.shipmentType as ShipmentType;
  }
  if (p.serviceId) where.serviceId = p.serviceId;
  if (p.status && BOOKING_STATUSES.has(p.status as BookingStatus)) {
    where.bookingStatus = p.status as BookingStatus;
  }
  if (p.mobile?.trim()) {
    and.push({
      OR: [
        { senderMobile: { contains: p.mobile.trim() } },
        { receiverMobile: { contains: p.mobile.trim() } },
      ],
    });
  }
  if (p.city?.trim()) {
    and.push({
      OR: [
        { senderCity: { contains: p.city.trim(), mode: "insensitive" } },
        { receiverCity: { contains: p.city.trim(), mode: "insensitive" } },
      ],
    });
  }
  if (and.length) where.AND = and;
  return where;
}

export function paramsFromSearch(sp: Record<string, string | string[] | undefined>): BookingFilterParams {
  const g = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : undefined);
  return {
    q: g("q"),
    from: g("from"),
    to: g("to"),
    shipmentType: g("shipmentType"),
    serviceId: g("serviceId"),
    status: g("status"),
    clientId: g("clientId"),
    mobile: g("mobile"),
    city: g("city"),
  };
}
