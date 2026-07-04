/**
 * Print a receipt — generates 2 pages (Customer Copy + Store Copy)
 * with a clean, professional layout matching the checkout receipt style.
 *
 * Can be called two ways:
 *  1. printReceiptElement(root)  — legacy: clones the .receipt-card from DOM
 *  2. printReceiptFromData(data) — preferred: builds receipt HTML from data
 */

import { formatCurrency, formatKhr } from "@/lib/utils";
import { format } from "date-fns";

// ─── Data-driven receipt printing ─────────────────────────────

export interface PrintReceiptItem {
  productName: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

export interface PrintReceiptPayload {
  storeName?: string;
  storeSubtitle?: string;
  orderNumber: string;
  createdAt: string;
  customerName: string;
  cashierName: string;
  paymentMethod: "cash" | "card" | "qr" | string;
  items: PrintReceiptItem[];
  subtotal: number;
  tax: number;
  taxRate: number; // e.g. 0.10 for 10%
  discount: number;
  shipping?: number | null;
  total: number;
  cashReceived?: number | null;
  changeGiven?: number | null;
  notes?: string | null;
  /** KHR exchange rate. 0 or undefined = hide KHR */
  khrRate?: number;
}

function escapeHtml(str: string) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function fmtDate(value: string) {
  return format(new Date(value), "h:mm a '·' MMM d, yyyy");
}

function paymentLabel(method: string) {
  switch (method) {
    case "cash":
    case "cash_on_delivery":
      return "Cash";
    case "card":
    case "bank_transfer":
      return "Card";
    case "qr":
      return "QR";
    default:
      return "";
  }
}

function buildReceiptHtml(data: PrintReceiptPayload, copyLabel: string): string {
  const storeName = data.storeName ?? "TISA POS";
  const storeSubtitle = data.storeSubtitle ?? "Counter Register";
  const showKhr = (data.khrRate ?? 0) > 0;
  const khr = data.khrRate ?? 0;
  const taxPercent = Math.round(data.taxRate * 100);
  const pLabel = paymentLabel(data.paymentMethod);

  let html = "";

  // Copy label
  html += `<div style="text-align:center;font-size:16px;font-weight:700;letter-spacing:0.18em;text-transform:uppercase;padding:3mm 0 4mm;margin:0;font-family:'Courier New',monospace;border-bottom:1px solid #000;">☆ ${escapeHtml(copyLabel)}</div>`;

  // Store header
  html += `<div style="text-align:center;margin:0 0 1mm;">`;
  html += `<div style="font-family:'Courier New',monospace;font-size:16px;font-weight:700;letter-spacing:0.12em;">${escapeHtml(storeName)}</div>`;
  html += `<div style="font-size:13px;margin-top:1mm;">${escapeHtml(storeSubtitle)}</div>`;
  html += `</div>`;

  // Line after header
  html += `<div style="border-top:1px solid #000;margin:3mm 0 0;"></div>`;

  // Items
  for (const item of data.items) {
    const lineTotal = item.lineTotal;
    html += `<div style="display:flex;justify-content:space-between;align-items:flex-start;margin:2mm 0 0;">`;
    html += `<div style="font-size:14px;font-weight:600;flex:1;min-width:0;">${escapeHtml(item.productName)}</div>`;
    html += `<div style="text-align:right;white-space:nowrap;margin-left:4mm;">`;
    html += `<div style="font-family:'Courier New',monospace;font-size:14px;font-weight:600;">${formatCurrency(lineTotal)}</div>`;
    if (showKhr) {
      html += `<div style="font-family:'Courier New',monospace;font-size:12px;color:#0d7377;">${formatKhr(lineTotal, khr)}</div>`;
    }
    html += `</div></div>`;
    html += `<div style="font-size:12px;color:#666;margin:0.5mm 0 1mm;">x${item.quantity}</div>`;
  }

  // Line before summary
  html += `<div style="border-top:1px solid #000;margin:3mm 0 2mm;"></div>`;

  // Summary rows
  const summaryRow = (label: string, usd: number, prefix = "") => {
    let row = `<div style="display:flex;justify-content:space-between;align-items:flex-start;margin:1.5mm 0;">`;
    row += `<div style="font-size:14px;">${escapeHtml(label)}</div>`;
    row += `<div style="text-align:right;font-family:'Courier New',monospace;">`;
    row += `<div style="font-size:14px;">${prefix}${formatCurrency(Math.abs(usd))}</div>`;
    if (showKhr) {
      row += `<div style="font-size:12px;color:#0d7377;">${prefix}${formatKhr(Math.abs(usd), khr)}</div>`;
    }
    row += `</div></div>`;
    return row;
  };

  html += summaryRow("Subtotal", data.subtotal);
  html += summaryRow(`Tax (${taxPercent}%)`, data.tax);
  if (data.discount > 0) {
    html += summaryRow("Discount", data.discount, "-");
  }
  if (data.shipping != null) {
    html += summaryRow("Delivery", data.shipping);
  }

  // Line before TOTAL
  html += `<div style="border-top:1px solid #000;margin:3mm 0 2mm;"></div>`;

  html += `<div style="display:flex;justify-content:space-between;align-items:flex-start;margin:1mm 0;">`;
  html += `<div style="font-family:'Courier New',monospace;font-size:18px;font-weight:700;letter-spacing:0.12em;">TOTAL</div>`;
  html += `<div style="text-align:right;font-family:'Courier New',monospace;">`;
  html += `<div style="font-size:18px;font-weight:700;">${formatCurrency(data.total)}</div>`;
  if (showKhr) {
    html += `<div style="font-size:15px;font-weight:700;color:#0d7377;">${formatKhr(data.total, khr)}</div>`;
  }
  html += `</div></div>`;

  // Payment details
  if (data.paymentMethod === "cash") {
    if (data.cashReceived != null) {
      html += summaryRow("Cash received", data.cashReceived);
    }
    if (data.changeGiven != null) {
      html += summaryRow("Change", data.changeGiven);
    }
  } else {
    html += `<div style="font-size:13px;margin:2mm 0 0;color:#444;">${pLabel ? `${pLabel} payment confirmed` : "Payment confirmed"}</div>`;
  }

  // Line before footer
  html += `<div style="border-top:1px solid #000;margin:3mm 0 2mm;"></div>`;

  html += `<div style="font-size:13px;color:#333;margin:1mm 0;">Cashier: ${escapeHtml(data.cashierName)}</div>`;
  html += `<div style="font-size:13px;color:#333;margin:1mm 0;">Customer: ${escapeHtml(data.customerName)}</div>`;
  html += `<div style="font-size:13px;color:#333;margin:1mm 0;">Time: ${fmtDate(data.createdAt)}</div>`;
  if (data.notes) {
    html += `<div style="font-size:12px;color:#555;margin:1mm 0;">Notes: ${escapeHtml(data.notes)}</div>`;
  }

  // Exchange rate box
  if (showKhr) {
    html += `<div style="margin:3mm 0 1mm;padding:2mm 3mm;border:1px solid #b2dfdb;border-radius:4px;background:#e0f2f1;text-align:center;font-family:'Courier New',monospace;font-size:12px;color:#00695c;">Exchange Rate: 1 USD = ៛${khr.toLocaleString()}</div>`;
  }

  return html;
}

function createPrintContainer() {
  const container = document.createElement("div");
  container.id = "print-receipt-container";
  container.setAttribute(
    "style",
    [
      "position:fixed",
      "left:-10000px",
      "top:0",
      "z-index:99999",
      "width:90mm",
      "background:#fff",
      "color:#000",
      "pointer-events:none",
    ].join(";"),
  );

  return container;
}

function printReceiptContainer(container: HTMLElement) {
  document.body.appendChild(container);

  let cleaned = false;
  const cleanup = () => {
    if (cleaned) {
      return;
    }

    cleaned = true;
    window.removeEventListener("afterprint", cleanup);
    container.remove();
  };

  window.addEventListener("afterprint", cleanup);

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      window.print();

      // Some browsers do not reliably fire `afterprint`; wait long enough that
      // Save as PDF has already captured the print DOM before removing it.
      window.setTimeout(cleanup, 60_000);
    });
  });
}

/**
 * Print receipt from structured data (preferred).
 * Generates 2 pages: Customer Copy + Store Copy.
 */
export function printReceiptFromData(data: PrintReceiptPayload) {
  const existingContainer = document.getElementById("print-receipt-container");
  existingContainer?.remove();

  const container = createPrintContainer();

  // Page 1 — Customer copy
  const page1 = document.createElement("div");
  page1.className = "receipt-print-page";
  page1.innerHTML = buildReceiptHtml(data, "Customer Copy");
  container.appendChild(page1);

  // Page 2 — Store copy
  const page2 = document.createElement("div");
  page2.className = "receipt-print-page";
  page2.innerHTML = buildReceiptHtml(data, "Store Copy");
  container.appendChild(page2);

  printReceiptContainer(container);
}

/**
 * Legacy: print by cloning the .receipt-card from the DOM.
 * Falls back to window.print() if no .receipt-card is found.
 */
export function printReceiptElement(root?: HTMLElement | null) {
  const source = root
    ? root.querySelector(".receipt-card") ?? root.closest(".receipt-card")
    : document.querySelector(".receipt-card");

  if (!source) {
    window.print();
    return;
  }

  const existingContainer = document.getElementById("print-receipt-container");
  existingContainer?.remove();

  const container = createPrintContainer();

  function createCopyPage(label: string) {
    const wrapper = document.createElement("div");
    wrapper.className = "receipt-print-page";

    const labelEl = document.createElement("div");
    labelEl.className = "receipt-copy-label";
    labelEl.textContent = label;
    wrapper.appendChild(labelEl);

    const clone = source!.cloneNode(true) as HTMLElement;
    clone.classList.add("receipt-card");
    wrapper.appendChild(clone);

    return wrapper;
  }

  container.appendChild(createCopyPage("☆ Customer Copy"));
  container.appendChild(createCopyPage("☆ Store Copy"));

  printReceiptContainer(container);
}
