import ExcelJS from "exceljs";
import { Booking, Client, Service } from "@prisma/client";
import { num, label } from "./money";

type Row = Booking & { client: Client; service: Service };

export async function bookingsXlsx(bookings: Row[]): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Bookings");
  ws.columns = [
    { header: "Booking ID", key: "bookingId", width: 16 },
    { header: "Booking Date", key: "bookingDate", width: 13 },
    { header: "Client", key: "client", width: 22 },
    { header: "Sender Name", key: "senderName", width: 20 },
    { header: "Sender Mobile", key: "senderMobile", width: 14 },
    { header: "Receiver Name", key: "receiverName", width: 20 },
    { header: "Receiver Mobile", key: "receiverMobile", width: 14 },
    { header: "Receiver Address", key: "receiverAddress", width: 30 },
    { header: "Receiver City", key: "receiverCity", width: 15 },
    { header: "Receiver State", key: "receiverState", width: 15 },
    { header: "Receiver PIN", key: "receiverPin", width: 12 },
    { header: "Shipment Type", key: "shipmentType", width: 14 },
    { header: "Service Type", key: "serviceType", width: 16 },
    { header: "Weight (kg)", key: "weight", width: 11 },
    { header: "Length", key: "length", width: 9 },
    { header: "Width", key: "width", width: 9 },
    { header: "Height", key: "height", width: 9 },
    { header: "Tracking/AWB", key: "tracking", width: 18 },
    { header: "Base Charge", key: "base", width: 12 },
    { header: "Additional Charge", key: "additional", width: 15 },
    { header: "GST", key: "gst", width: 10 },
    { header: "Total Amount", key: "total", width: 13 },
    { header: "Booking Status", key: "bookingStatus", width: 14 },
    { header: "Payment Status", key: "paymentStatus", width: 18 },
  ];
  ws.getRow(1).font = { bold: true };

  for (const b of bookings) {
    ws.addRow({
      bookingId: b.bookingId,
      bookingDate: new Date(b.bookingDate).toISOString().slice(0, 10),
      client: b.client.companyName,
      senderName: b.senderName,
      senderMobile: b.senderMobile,
      receiverName: b.receiverName,
      receiverMobile: b.receiverMobile,
      receiverAddress: b.receiverAddress,
      receiverCity: b.receiverCity,
      receiverState: b.receiverState,
      receiverPin: b.receiverPin,
      shipmentType: label(b.shipmentType),
      serviceType: b.service.name,
      weight: num(b.weight),
      length: b.length ? num(b.length) : "",
      width: b.width ? num(b.width) : "",
      height: b.height ? num(b.height) : "",
      tracking: b.trackingNumber || "",
      base: num(b.baseCharge),
      additional: num(b.additionalCharge),
      gst: num(b.gst),
      total: num(b.totalAmount),
      bookingStatus: label(b.bookingStatus),
      paymentStatus: b.paymentStatus,
    });
  }
  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf);
}

export async function reportXlsx(
  title: string,
  summary: [string, string | number][],
  monthly: { month: string; bookings: number; amount: number }[]
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Report");
  ws.addRow([title]).font = { bold: true, size: 14 };
  ws.addRow([]);
  for (const [k, v] of summary) ws.addRow([k, v]);
  ws.addRow([]);
  const head = ws.addRow(["Month", "Bookings", "Amount"]);
  head.font = { bold: true };
  for (const m of monthly) ws.addRow([m.month, m.bookings, m.amount]);
  ws.getColumn(1).width = 26;
  ws.getColumn(2).width = 14;
  ws.getColumn(3).width = 16;
  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf);
}
