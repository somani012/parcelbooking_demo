import PDFDocument from "pdfkit";
import { Booking, Client, CompanySettings, Service } from "@prisma/client";
import { num, fmtDate, label } from "./money";

type FullBooking = Booking & { client: Client; service: Service };

// Standard PDF fonts don't include the rupee glyph, so amounts use "Rs."
function rs(v: unknown): string {
  return "Rs. " + Number(String(v)).toLocaleString("en-IN", { minimumFractionDigits: 2 });
}

export function bookingSlipPdf(booking: FullBooking, settings: CompanySettings): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 48 });
    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const left = 48;
    const right = 547;
    const ink = "#1C2422";
    const teal = "#0E5A53";
    const grey = "#6B7370";

    // Header
    let headerX = left;
    if (settings.logo && settings.logoMime?.startsWith("image/")) {
      try {
        doc.image(Buffer.from(settings.logo), left, 44, { fit: [56, 56] });
        headerX = left + 70;
      } catch {
        /* unsupported image format - skip logo */
      }
    }
    doc.fillColor(teal).font("Helvetica-Bold").fontSize(18).text(settings.companyName, headerX, 48);
    doc.fillColor(grey).font("Helvetica").fontSize(9);
    if (settings.address) doc.text(settings.address, headerX, doc.y + 2, { width: right - headerX });
    const contact = [settings.phone, settings.email].filter(Boolean).join("  |  ");
    if (contact) doc.text(contact, headerX, doc.y + 1);

    doc.moveTo(left, 116).lineTo(right, 116).lineWidth(1.5).strokeColor(teal).stroke();
    doc.fillColor(ink).font("Helvetica-Bold").fontSize(13).text("BOOKING SLIP", left, 126);

    // Booking info line
    doc.font("Helvetica").fontSize(10).fillColor(ink);
    const infoY = 148;
    doc.font("Helvetica-Bold").text("Booking ID: ", left, infoY, { continued: true }).font("Helvetica").text(booking.bookingId);
    doc.font("Helvetica-Bold").text("Booking Date: ", 320, infoY, { continued: true }).font("Helvetica").text(fmtDate(booking.bookingDate));
    doc.font("Helvetica-Bold").text("Tracking / AWB: ", left, infoY + 16, { continued: true }).font("Helvetica").text(booking.trackingNumber || "-");
    doc.font("Helvetica-Bold").text("Status: ", 320, infoY + 16, { continued: true }).font("Helvetica").text(label(booking.bookingStatus));

    // Sender / Receiver boxes
    const boxTop = 196;
    const boxH = 118;
    const colW = (right - left - 12) / 2;
    for (const [i, title, name, company, addr, cityLine, mobile] of [
      [0, "SENDER", booking.senderName, booking.senderCompany, booking.senderAddress, `${booking.senderCity}, ${booking.senderState} - ${booking.senderPin}`, booking.senderMobile],
      [1, "RECEIVER", booking.receiverName, booking.receiverCompany, booking.receiverAddress, `${booking.receiverCity}, ${booking.receiverState} - ${booking.receiverPin}`, booking.receiverMobile],
    ] as const) {
      const x = left + i * (colW + 12);
      doc.rect(x, boxTop, colW, boxH).lineWidth(0.8).strokeColor("#C9CFCC").stroke();
      doc.fillColor(teal).font("Helvetica-Bold").fontSize(8).text(title, x + 10, boxTop + 8);
      doc.fillColor(ink).font("Helvetica-Bold").fontSize(10).text(name, x + 10, boxTop + 20, { width: colW - 20 });
      doc.font("Helvetica").fontSize(9).fillColor(ink);
      if (company) doc.text(company, x + 10, doc.y + 1, { width: colW - 20 });
      doc.fillColor(grey).text(addr, x + 10, doc.y + 2, { width: colW - 20, height: 34, ellipsis: true });
      doc.text(cityLine, x + 10, doc.y + 1, { width: colW - 20 });
      doc.fillColor(ink).text(`Mobile: ${mobile}`, x + 10, doc.y + 2);
    }

    // Shipment details
    let y = boxTop + boxH + 18;
    doc.fillColor(teal).font("Helvetica-Bold").fontSize(10).text("SHIPMENT", left, y);
    y += 16;
    const dims =
      booking.length && booking.width && booking.height
        ? `${num(booking.length)} x ${num(booking.width)} x ${num(booking.height)} cm`
        : "-";
    const rows: [string, string][] = [
      ["Shipment Type", label(booking.shipmentType)],
      ["Service", booking.service.name],
      ["Weight", `${num(booking.weight)} kg`],
      ["Quantity", String(booking.quantity)],
      ["Dimensions", dims],
      ["Contents", booking.description || "-"],
    ];
    doc.fontSize(9.5);
    for (const [k, v] of rows) {
      doc.fillColor(grey).font("Helvetica").text(k, left, y, { width: 130 });
      doc.fillColor(ink).font("Helvetica").text(v, left + 140, y, { width: right - left - 140 });
      y = Math.max(doc.y, y + 14) + 2;
    }

    // Charges table
    y += 10;
    doc.fillColor(teal).font("Helvetica-Bold").fontSize(10).text("CHARGES", left, y);
    y += 16;
    const charge = (k: string, v: string, bold = false) => {
      doc.font(bold ? "Helvetica-Bold" : "Helvetica").fontSize(10);
      doc.fillColor(bold ? ink : grey).text(k, left, y);
      doc.fillColor(ink).text(v, right - 160, y, { width: 160, align: "right" });
      y += 16;
    };
    charge("Base Charge", rs(booking.baseCharge));
    charge("Additional Charges", rs(booking.additionalCharge));
    charge("GST", rs(booking.gst));
    doc.moveTo(right - 200, y).lineTo(right, y).lineWidth(0.8).strokeColor("#C9CFCC").stroke();
    y += 6;
    charge("Total Amount", rs(booking.totalAmount), true);
    charge("Payment", booking.paymentStatus);

    // Footer
    doc.moveTo(left, 760).lineTo(right, 760).lineWidth(0.5).strokeColor("#C9CFCC").stroke();
    doc.fillColor(grey).font("Helvetica").fontSize(8);
    doc.text(
      settings.terms
        ? settings.terms
        : "This is a computer-generated booking slip and does not require a signature.",
      left,
      768,
      { width: right - left }
    );

    doc.end();
  });
}
