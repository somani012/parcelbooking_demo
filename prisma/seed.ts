/**
 * Demo data seed.
 *
 * Logins created:
 *   Admin : admin@portal.test  / Admin@123
 *   Client: client1@portal.test / Client@123  (Shree Traders, Surat)
 *   Client: client2@portal.test / Client@123  (Om Textiles, Ahmedabad)
 *
 * Run with: npm run db:seed  (or npm run setup for generate + push + seed)
 */
import { PrismaClient, Prisma, BookingStatus, ShipmentType } from "@prisma/client";
import bcrypt from "bcryptjs";

const db = new PrismaClient();

const GST = 18;
const round2 = (n: number) => Math.round(n * 100) / 100;

type Slab = { min: number; max: number; base: number; extra: number };
const PRICING: Record<string, Slab[]> = {
  "Speed Post": [
    { min: 0, max: 0.5, base: 60, extra: 0 },
    { min: 0.5, max: 1, base: 90, extra: 0 },
    { min: 1, max: 5, base: 250, extra: 40 },
  ],
  "Registered Post": [
    { min: 0, max: 0.5, base: 45, extra: 0 },
    { min: 0.5, max: 1, base: 70, extra: 0 },
    { min: 1, max: 5, base: 180, extra: 30 },
  ],
  Courier: [
    { min: 0, max: 1, base: 80, extra: 0 },
    { min: 1, max: 5, base: 220, extra: 0 },
    { min: 5, max: 20, base: 600, extra: 35 },
  ],
  "Local Delivery": [
    { min: 0, max: 5, base: 50, extra: 0 },
    { min: 5, max: 20, base: 120, extra: 10 },
  ],
};

function charges(serviceName: string, weight: number) {
  const slabs = PRICING[serviceName];
  const matched = slabs.find((s) => weight >= s.min && weight <= s.max);
  let base: number;
  let additional = 0;
  if (matched) base = matched.base;
  else {
    const top = slabs[slabs.length - 1];
    base = top.base;
    additional = round2(Math.ceil(weight - top.max) * top.extra);
  }
  const gst = round2(((base + additional) * GST) / 100);
  return { base, additional, gst, total: round2(base + additional + gst) };
}

// Sequential ID helpers (counters are written at the end)
const year = new Date().getFullYear();
let bkN = 0, payN = 0, txnN = 0, clN = 0;
const bkId = () => `BK-${year}-${String(++bkN).padStart(5, "0")}`;
const payId = () => `PAY-${year}-${String(++payN).padStart(5, "0")}`;
const txnId = () => `TXN-${year}-${String(++txnN).padStart(5, "0")}`;
const clId = () => `CL-${String(++clN).padStart(4, "0")}`;

function daysAgo(n: number, hour = 11) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(hour, 0, 0, 0);
  return d;
}

async function main() {
  console.log("Clearing existing data...");
  await db.$transaction([
    db.auditLog.deleteMany(),
    db.transaction.deleteMany(),
    db.payment.deleteMany(),
    db.booking.deleteMany(),
    db.pricingRule.deleteMany(),
    db.service.deleteMany(),
    db.user.deleteMany(),
    db.client.deleteMany(),
    db.companySettings.deleteMany(),
    db.counter.deleteMany(),
  ]);

  console.log("Company settings...");
  await db.companySettings.create({
    data: {
      id: 1,
      companyName: "Shree Parcel Services",
      address: "12 Ring Road, Varachha, Surat, Gujarat - 395006",
      phone: "+91 98765 00000",
      email: "office@shreeparcel.example",
      gstNumber: "24ABCDE1234F1Z5",
      gstPercent: GST,
      upiId: "shreeparcel@okhdfcbank",
      bankName: "HDFC Bank",
      accountName: "Shree Parcel Services",
      accountNumber: "50100123456789",
      ifsc: "HDFC0001234",
      branch: "Varachha, Surat",
      terms:
        "Goods are carried at owner's risk. Claims must be reported within 48 hours of delivery. This is a computer-generated slip.",
    },
  });

  console.log("Services and pricing...");
  const services: Record<string, string> = {};
  for (const [name, slabs] of Object.entries(PRICING)) {
    const svc = await db.service.create({
      data: {
        name,
        description:
          name === "Speed Post" ? "Fast delivery across India" :
          name === "Registered Post" ? "Economical with proof of delivery" :
          name === "Courier" ? "Door-to-door private courier" :
          "Same-city delivery",
        pricingRules: {
          create: slabs.map((s) => ({
            minimumWeight: s.min, maximumWeight: s.max, basePrice: s.base, additionalPrice: s.extra,
          })),
        },
      },
    });
    services[name] = svc.id;
  }

  console.log("Users and clients...");
  const adminPass = await bcrypt.hash("Admin@123", 10);
  const clientPass = await bcrypt.hash("Client@123", 10);

  const admin = await db.user.create({
    data: {
      name: "Portal Admin",
      email: "admin@portal.test",
      phone: "9000000001",
      passwordHash: adminPass,
      role: "ADMIN",
    },
  });

  const client1 = await db.client.create({
    data: {
      clientCode: clId(),
      companyName: "Shree Traders",
      contactPerson: "Rajesh Mehta",
      email: "client1@portal.test",
      phone: "9876543210",
      address: "45 Diamond Market, Varachha",
      city: "Surat",
      state: "Gujarat",
      pinCode: "395006",
      gstNumber: "24AAAAA0000A1Z5",
    },
  });
  const client2 = await db.client.create({
    data: {
      clientCode: clId(),
      companyName: "Om Textiles",
      contactPerson: "Priya Shah",
      email: "client2@portal.test",
      phone: "9123456780",
      address: "8 Textile Park, Narol",
      city: "Ahmedabad",
      state: "Gujarat",
      pinCode: "382405",
    },
  });
  await db.user.create({
    data: {
      name: "Rajesh Mehta", email: "client1@portal.test", phone: "9876543210",
      passwordHash: clientPass, role: "CLIENT", clientId: client1.id,
    },
  });
  await db.user.create({
    data: {
      name: "Priya Shah", email: "client2@portal.test", phone: "9123456780",
      passwordHash: clientPass, role: "CLIENT", clientId: client2.id,
    },
  });

  // ---- Ledger builder: replay events in order so balance_after is always consistent ----
  const balances: Record<string, number> = { [client1.id]: 0, [client2.id]: 0 };

  async function approvedPayment(clientId: string, amount: number, method: "UPI" | "BANK_TRANSFER", utr: string, when: Date) {
    const p = await db.payment.create({
      data: {
        paymentId: payId(), clientId, amount, paymentMethod: method, utrNumber: utr,
        paymentDate: when, status: "APPROVED", approvedBy: admin.id,
        approvedAt: new Date(when.getTime() + 3600_000), createdAt: when,
      },
    });
    balances[clientId] = round2(balances[clientId] + amount);
    await db.transaction.create({
      data: {
        transactionId: txnId(), clientId, transactionType: "PAYMENT_RECEIVED", amount,
        balanceAfter: balances[clientId], referenceId: p.paymentId,
        description: `Payment ${p.paymentId} approved (UTR ${utr})`,
        createdBy: admin.id, createdAt: new Date(when.getTime() + 3600_000),
      },
    });
    await db.auditLog.create({
      data: {
        userId: admin.id, userName: "Portal Admin", action: "PAYMENT_APPROVED",
        entity: "payment", entityId: p.paymentId, detail: `Amount ${amount}`,
        createdAt: new Date(when.getTime() + 3600_000),
      },
    });
  }

  type BookingSeed = {
    clientId: string;
    service: string;
    type: ShipmentType;
    weight: number;
    status: BookingStatus;
    when: Date;
    sender: { name: string; company?: string; mobile: string; address: string; city: string; state: string; pin: string };
    receiver: { name: string; company?: string; mobile: string; address: string; city: string; state: string; pin: string };
    tracking?: string;
    description?: string;
    dims?: [number, number, number];
  };

  async function book(b: BookingSeed) {
    const c = charges(b.service, b.weight);
    balances[b.clientId] = round2(balances[b.clientId] - c.total);
    const id = bkId();
    await db.booking.create({
      data: {
        bookingId: id, clientId: b.clientId,
        senderName: b.sender.name, senderCompany: b.sender.company ?? null, senderMobile: b.sender.mobile,
        senderAddress: b.sender.address, senderCity: b.sender.city, senderState: b.sender.state, senderPin: b.sender.pin,
        receiverName: b.receiver.name, receiverCompany: b.receiver.company ?? null, receiverMobile: b.receiver.mobile,
        receiverAddress: b.receiver.address, receiverCity: b.receiver.city, receiverState: b.receiver.state, receiverPin: b.receiver.pin,
        shipmentType: b.type, serviceId: services[b.service], weight: b.weight, quantity: 1,
        length: b.dims?.[0] ?? null, width: b.dims?.[1] ?? null, height: b.dims?.[2] ?? null,
        description: b.description ?? null, trackingNumber: b.tracking ?? null,
        bookingDate: b.when, baseCharge: c.base, additionalCharge: c.additional, gst: c.gst, totalAmount: c.total,
        bookingStatus: b.status, createdAt: b.when,
      },
    });
    await db.transaction.create({
      data: {
        transactionId: txnId(), clientId: b.clientId, transactionType: "BOOKING_DEDUCTION",
        amount: -c.total, balanceAfter: balances[b.clientId], referenceId: id,
        description: `Booking ${id} - ${b.service}, ${b.weight} kg`, createdAt: b.when,
      },
    });
  }

  const shreeSender = { name: "Rajesh Mehta", company: "Shree Traders", mobile: "9876543210", address: "45 Diamond Market, Varachha", city: "Surat", state: "Gujarat", pin: "395006" };
  const omSender = { name: "Priya Shah", company: "Om Textiles", mobile: "9123456780", address: "8 Textile Park, Narol", city: "Ahmedabad", state: "Gujarat", pin: "382405" };

  console.log("Payments and bookings (in chronological order)...");
  // -- Client 1: two months of activity
  await approvedPayment(client1.id, 5000, "UPI", "UTR100000000001", daysAgo(70));
  await book({ clientId: client1.id, service: "Speed Post", type: "DOCUMENT", weight: 0.4, status: "DELIVERED", when: daysAgo(65), sender: shreeSender, tracking: "EK101010101IN", description: "Purchase agreements", receiver: { name: "Amit Verma", company: "Verma & Co", mobile: "9811111111", address: "12 Connaught Place", city: "New Delhi", state: "Delhi", pin: "110001" } });
  await book({ clientId: client1.id, service: "Courier", type: "PARCEL", weight: 3.2, status: "DELIVERED", when: daysAgo(52), sender: shreeSender, tracking: "CR55001234", description: "Sample diamond boxes", dims: [30, 20, 15], receiver: { name: "Meena Jain", mobile: "9822222222", address: "5 MG Road", city: "Mumbai", state: "Maharashtra", pin: "400001" } });
  await book({ clientId: client1.id, service: "Registered Post", type: "DOCUMENT", weight: 0.8, status: "DELIVERED", when: daysAgo(38), sender: shreeSender, tracking: "RG77005678IN", description: "GST filings", receiver: { name: "CA Office", company: "Desai Associates", mobile: "9833333333", address: "2 Ashram Road", city: "Ahmedabad", state: "Gujarat", pin: "380009" } });
  await approvedPayment(client1.id, 3000, "BANK_TRANSFER", "UTR100000000002", daysAgo(30));
  await book({ clientId: client1.id, service: "Speed Post", type: "PARCEL", weight: 7, status: "IN_TRANSIT", when: daysAgo(6), sender: shreeSender, tracking: "EK20202020IN", description: "Fabric swatches", dims: [40, 30, 20], receiver: { name: "Suresh Kumar", mobile: "9844444444", address: "88 Brigade Road", city: "Bengaluru", state: "Karnataka", pin: "560001" } });
  await book({ clientId: client1.id, service: "Local Delivery", type: "OTHER", weight: 2, status: "DISPATCHED", when: daysAgo(2), sender: shreeSender, description: "Office stationery", receiver: { name: "Branch Office", company: "Shree Traders", mobile: "9876543211", address: "201 Ring Road", city: "Surat", state: "Gujarat", pin: "395002" } });
  await book({ clientId: client1.id, service: "Courier", type: "PARCEL", weight: 1.5, status: "BOOKED", when: daysAgo(0, 9), sender: shreeSender, description: "Gift hamper", dims: [25, 25, 25], receiver: { name: "Nita Mehta", mobile: "9855555555", address: "3 Lake View", city: "Pune", state: "Maharashtra", pin: "411001" } });

  // -- Client 2
  await approvedPayment(client2.id, 4000, "UPI", "UTR200000000001", daysAgo(45));
  await book({ clientId: client2.id, service: "Courier", type: "PARCEL", weight: 12, status: "DELIVERED", when: daysAgo(40), sender: omSender, tracking: "CR66009911", description: "Saree consignment", dims: [60, 40, 30], receiver: { name: "Lakshmi Silks", company: "Lakshmi Silks", mobile: "9866666666", address: "14 T Nagar", city: "Chennai", state: "Tamil Nadu", pin: "600017" } });
  await book({ clientId: client2.id, service: "Speed Post", type: "DOCUMENT", weight: 0.3, status: "PROCESSING", when: daysAgo(3), sender: omSender, description: "Export invoices", receiver: { name: "Port Office", mobile: "9877777777", address: "Kandla Port", city: "Gandhidham", state: "Gujarat", pin: "370201" } });
  await book({ clientId: client2.id, service: "Registered Post", type: "LETTER", weight: 0.2, status: "BOOKED", when: daysAgo(1), sender: omSender, description: "Legal notice", receiver: { name: "Adv. Patel", mobile: "9888888888", address: "High Court Road", city: "Ahmedabad", state: "Gujarat", pin: "380014" } });
  // A cancelled booking with refund
  {
    const c = charges("Courier", 2.5);
    balances[client2.id] = round2(balances[client2.id] - c.total);
    const id = bkId();
    await db.booking.create({
      data: {
        bookingId: id, clientId: client2.id,
        senderName: omSender.name, senderCompany: omSender.company, senderMobile: omSender.mobile,
        senderAddress: omSender.address, senderCity: omSender.city, senderState: omSender.state, senderPin: omSender.pin,
        receiverName: "Cancelled Buyer", receiverMobile: "9899999999", receiverAddress: "1 Market Yard",
        receiverCity: "Rajkot", receiverState: "Gujarat", receiverPin: "360001",
        shipmentType: "PARCEL", serviceId: services["Courier"], weight: 2.5, quantity: 1,
        bookingDate: daysAgo(20), baseCharge: c.base, additionalCharge: c.additional, gst: c.gst, totalAmount: c.total,
        bookingStatus: "CANCELLED", paymentStatus: "Refunded to balance", createdAt: daysAgo(20),
      },
    });
    await db.transaction.create({
      data: {
        transactionId: txnId(), clientId: client2.id, transactionType: "BOOKING_DEDUCTION",
        amount: -c.total, balanceAfter: balances[client2.id], referenceId: id,
        description: `Booking ${id} - Courier, 2.5 kg`, createdAt: daysAgo(20),
      },
    });
    balances[client2.id] = round2(balances[client2.id] + c.total);
    await db.transaction.create({
      data: {
        transactionId: txnId(), clientId: client2.id, transactionType: "REFUND",
        amount: c.total, balanceAfter: balances[client2.id], referenceId: id,
        description: `Refund for cancelled booking ${id}`, createdBy: admin.id, createdAt: daysAgo(19),
      },
    });
    await db.auditLog.create({
      data: {
        userId: admin.id, userName: "Portal Admin", action: "BOOKING_CANCELLED",
        entity: "booking", entityId: id, detail: `Refund ${c.total}`, createdAt: daysAgo(19),
      },
    });
  }

  // Pending + rejected payments (no balance effect)
  await db.payment.create({
    data: {
      paymentId: payId(), clientId: client1.id, amount: 2500, paymentMethod: "UPI",
      utrNumber: "UTR100000000003", paymentDate: daysAgo(0, 8), status: "PENDING", createdAt: daysAgo(0, 8),
    },
  });
  await db.payment.create({
    data: {
      paymentId: payId(), clientId: client2.id, amount: 1500, paymentMethod: "BANK_TRANSFER",
      utrNumber: "UTR200000000002", paymentDate: daysAgo(10), status: "REJECTED",
      rejectionReason: "Amount not found in bank statement. Please re-check the UTR.",
      approvedBy: admin.id, approvedAt: daysAgo(9), createdAt: daysAgo(10),
    },
  });

  console.log("Syncing balances and counters...");
  await db.client.update({ where: { id: client1.id }, data: { balance: balances[client1.id] } });
  await db.client.update({ where: { id: client2.id }, data: { balance: balances[client2.id] } });
  await db.counter.createMany({
    data: [
      { key: `BK-${year}`, value: bkN },
      { key: `PAY-${year}`, value: payN },
      { key: `TXN-${year}`, value: txnN },
      { key: "CL", value: clN },
    ],
  });

  console.log(`Seeded: ${bkN} bookings, ${payN} payments, ${txnN} transactions.`);
  console.log(`Balances -> Shree Traders: ${balances[client1.id]}, Om Textiles: ${balances[client2.id]}`);
  console.log("\nLogins:\n  admin@portal.test / Admin@123\n  client1@portal.test / Client@123\n  client2@portal.test / Client@123");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
