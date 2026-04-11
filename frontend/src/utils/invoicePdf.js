import { jsPDF } from "jspdf";

/** Template palette (teal invoice style — company-branded). */
const TEAL = [0, 90, 124];
const TABLE_HEADER_GREY = [200, 200, 200];
const ROW_STRIPE = [224, 224, 224];
const TOTAL_BAND = [217, 234, 247];

const DEFAULT_ORG = {
  name: "Paropakar VendorNet",
  addressLine1: "Paropakar — Procurement Office",
  addressLine2: "Nayagau, Pokhara",
  addressLine3: "",
  phone: "9713680380",
  email: "admin@paropakar.org",
};

function fmtMoney(n) {
  return new Intl.NumberFormat("en-NP", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(n) || 0);
}

function fmtDate(d) {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return "—";
  }
}

function fitText(doc, text, maxWidthMm) {
  const raw = String(text ?? "");
  if (!raw) return "—";
  if (doc.getTextWidth(raw) <= maxWidthMm) return raw;
  let s = raw;
  while (s.length > 1 && doc.getTextWidth(`${s}…`) > maxWidthMm) {
    s = s.slice(0, -1);
  }
  return `${s}…`;
}

/**
 * Teal header/footer invoice PDF (company issuer — Paropakar VendorNet).
 * @param {Record<string, unknown>} invoice
 * @param {{ organization?: Partial<typeof DEFAULT_ORG> }} [options]
 */
export function downloadInvoicePdf(invoice, options = {}) {
  if (!invoice) return;

  const org = { ...DEFAULT_ORG, ...options.organization };
  const doc = new jsPDF({ unit: "mm", format: "a4", compress: true });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const m = 14;
  const footerH = 12;
  const contentBottom = pageH - footerH - 6;
  const headerH = 24;

  /* —— Top teal bar —— */
  doc.setFillColor(...TEAL);
  doc.rect(0, 0, pageW, headerH, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.text("INVOICE", m, 15);

  doc.setFontSize(9);
  const rightLines = [
    org.name,
    org.addressLine1,
    org.addressLine2,
    org.addressLine3,
    `Phone: ${org.phone}`,
    org.email,
  ];
  let ry = 9;
  rightLines.forEach((line, i) => {
    doc.setFont("helvetica", i === 0 ? "bold" : "normal");
    doc.setFontSize(i === 0 ? 9.5 : 7.5);
    doc.text(line, pageW - m, ry, { align: "right" });
    ry += i === 0 ? 4.2 : 3.4;
  });

  let y = headerH + 10;
  doc.setTextColor(30, 41, 59);
  const midX = m + 72;

  /* —— Invoice meta + Bill to —— */
  const yStart = y;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);

  const leftRows = [
    ["Invoice No.", String(invoice.invoiceNumber || "—")],
    ["Date of Issue", fmtDate(invoice.issueDate)],
    ["Due Date", fmtDate(invoice.dueDate)],
    [
      "PO / tender ref.",
      String(
        invoice.purchaseOrder?.orderNumber ||
          invoice.purchaseOrderNumber ||
          invoice.tender?.referenceNumber ||
          invoice.tender?.title ||
          "—"
      ),
    ],
    ["Status", String(invoice.status || "—").toUpperCase()],
  ];

  let yL = yStart;
  leftRows.forEach(([lab, val]) => {
    doc.setFont("helvetica", "bold");
    doc.text(lab + ":", m, yL);
    doc.setFont("helvetica", "normal");
    doc.text(val, m + 38, yL);
    yL += 5.2;
  });

  let yR = yStart;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text("Bill To", midX, yR);
  yR += 5;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.5);
  doc.text(String(invoice.vendorName || "Vendor"), midX, yR);
  yR += 4.5;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text("Vendor account on VendorNet", midX, yR);
  yR += 3.8;
  doc.text(`Email / address: as registered with the organization`, midX, yR, {
    maxWidth: pageW - midX - m,
  });
  yR += 8;

  y = Math.max(yL, yR) + 4;
  doc.setTextColor(30, 41, 59);

  const items =
    Array.isArray(invoice.items) && invoice.items.length > 0
      ? invoice.items
      : [
          {
            itemName: "—",
            description: "No line items",
            quantity: 1,
            unit: "",
            unitPrice: 0,
            totalPrice: Number(invoice.totalAmount) || 0,
          },
        ];

  const displayedVatRate = 13;
  const lineItemsTotal = items.reduce(
    (s, it) => s + (Number(it.totalPrice) || 0),
    0,
  );
  const discount = 0;
  const total = Number(invoice.totalAmount) || lineItemsTotal;
  // Quotation flow uses VAT 13%; show invoice math consistently from final total.
  const subtotal = total / (1 + displayedVatRate / 100);
  const taxAmt = total - subtotal;

  /* —— Table —— */
  const tableW = pageW - 2 * m;
  const c0 = m;
  const c1 = m + 9;
  const c2 = m + 32;
  const c3 = m + 98;
  const c4 = m + 118;
  const c5 = m + 148;
  const rowH = 7;
  const headerRowH = 8;

  const drawTableHeader = (yy) => {
    doc.setFillColor(...TABLE_HEADER_GREY);
    doc.rect(m, yy, tableW, headerRowH, "F");
    doc.setDrawColor(120, 120, 120);
    doc.setLineWidth(0.15);
    doc.rect(m, yy, tableW, headerRowH, "S");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(0, 0, 0);
    doc.text("#", c0 + 1, yy + 5.2);
    doc.text("Item", c1 + 1, yy + 5.2);
    doc.text("Description", c2 + 1, yy + 5.2);
    doc.text("Qty", c3 + 1, yy + 5.2);
    doc.text("Rate (NPR)", c4 + 1, yy + 5.2);
    doc.text("Amount (NPR)", c5 + 1, yy + 5.2);
    return yy + headerRowH;
  };

  y = drawTableHeader(y);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);

  items.forEach((it, idx) => {
    if (y + rowH > contentBottom) {
      doc.addPage();
      y = m;
      y = drawTableHeader(y);
    }
    const fill = idx % 2 === 0 ? [255, 255, 255] : ROW_STRIPE;
    doc.setFillColor(...fill);
    doc.rect(m, y, tableW, rowH, "F");
    doc.setDrawColor(180, 180, 180);
    doc.rect(m, y, tableW, rowH, "S");
    doc.setTextColor(30, 41, 59);

    const desc = [it.description, it.specifications].filter(Boolean).join(" · ");
    const descShort = fitText(doc, desc || "—", c3 - c2 - 2);
    const nameOne = fitText(doc, String(it.itemName || "—"), c2 - c1 - 2);

    doc.text(String(idx + 1), c0 + 1, y + 4.8);
    doc.text(nameOne, c1 + 1, y + 4.8);
    doc.text(descShort, c2 + 1, y + 4.8);
    doc.text(
      `${it.quantity ?? "—"} ${it.unit || ""}`.trim(),
      c3 + 1,
      y + 4.8,
    );
    doc.text(fmtMoney(it.unitPrice), c4 + 1, y + 4.8);
    doc.text(fmtMoney(it.totalPrice), c5 + 1, y + 4.8);

    y += rowH;
  });

  /* Pad rows for template feel */
  const minDataRows = 4;
  for (let i = items.length; i < minDataRows; i++) {
    if (y + rowH > contentBottom) break;
    const fill = i % 2 === 0 ? [255, 255, 255] : ROW_STRIPE;
    doc.setFillColor(...fill);
    doc.rect(m, y, tableW, rowH, "F");
    doc.setDrawColor(200, 200, 200);
    doc.rect(m, y, tableW, rowH, "S");
    y += rowH;
  }

  y += 6;

  /* —— Terms + totals —— */
  if (y + 42 > contentBottom) {
    doc.addPage();
    y = m;
  }

  const totalsX = pageW - m - 62;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(30, 41, 59);
  doc.text("Terms", m, y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  const terms = doc.splitTextToSize(
    "Payment due by the due date above. NPR amounts. Questions: contact procurement using the header details.",
    totalsX - m - 8,
  );
  doc.text(terms, m, y + 4);

  let ty = y;
  const line = (label, value, bold = false) => {
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(30, 41, 59);
    doc.text(label, totalsX, ty);
    doc.text(value, pageW - m, ty, { align: "right" });
    ty += 5.5;
  };

  line("Subtotal", `NPR ${fmtMoney(subtotal)}`);
  line("Discount", `NPR ${fmtMoney(discount)}`);
  line("VAT rate", `${displayedVatRate.toFixed(2)}%`);
  line("Tax", `NPR ${fmtMoney(taxAmt)}`);

  ty += 1;
  doc.setFillColor(...TOTAL_BAND);
  doc.rect(totalsX - 2, ty - 3, pageW - totalsX + m - 12, 9, "F");
  doc.setDrawColor(160, 180, 200);
  doc.rect(totalsX - 2, ty - 3, pageW - totalsX + m - 12, 9, "S");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(0, 90, 124);
  doc.text("Total", totalsX, ty + 2.8);
  doc.text(`NPR ${fmtMoney(total)}`, pageW - m, ty + 2.8, { align: "right" });

  /* —— Footer bar —— */
  doc.setFillColor(...TEAL);
  doc.rect(0, pageH - footerH, pageW, footerH, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text("Thank you for your business!", pageW / 2, pageH - footerH / 2 + 2, {
    align: "center",
  });

  doc.setFontSize(6.5);
  doc.setTextColor(200, 200, 200);
  doc.text(
    `Generated ${new Date().toLocaleString()} · Paropakar VendorNet`,
    pageW / 2,
    pageH - 3,
    { align: "center" },
  );

  const fname = `${String(invoice.invoiceNumber || "invoice").replace(/[^\w.-]+/g, "_")}.pdf`;
  doc.save(fname);
}
