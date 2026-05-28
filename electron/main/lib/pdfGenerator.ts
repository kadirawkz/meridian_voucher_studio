import { BrowserWindow } from "electron";
import fs from "node:fs/promises";
import type { VoucherPayload } from "../../shared/types.js";

function escapeHtml(value: string | number | undefined | null): string {
  if (value == null) return "";
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formatDisplayDate(value: string): string {
  if (!value) return "";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  })
    .format(date)
    .replace(/ /g, "-");
}

function generateVoucherHtml(voucher: VoucherPayload): string {
  const totalRooms = voucher.lineItems.reduce(
    (total, item) =>
      total +
      (item.singleRooms || 0) +
      (item.doubleRooms || 0) +
      (item.twinRooms || 0) +
      (item.tripleRooms || 0),
    0,
  );

  const totalChildren = voucher.lineItems.reduce(
    (total, item) =>
      total +
      (item.child2_5Sharing || 0) +
      (item.child2_5Bed || 0) +
      (item.child2_5OwnRoom || 0) +
      (item.child6_11Sharing || 0) +
      (item.child6_11Bed || 0) +
      (item.child6_11OwnRoom || 0),
    0,
  );

  const title =
    voucher.voucherType === "amendment"
      ? "AMENDMENT VOUCHER"
      : voucher.voucherType === "pptp"
        ? "PPTP VOUCHER"
        : "HOTEL RESERVATION VOUCHER";

  const rowsHtml = voucher.lineItems
    .map((item, index) => {
      const guideStr = item.guide
        ? `${item.guide} ${item.guideBasis ? `(${item.guideBasis})` : ""}`.trim()
        : "-";
      const roomsStr =
        [
          item.singleRooms ? `${item.singleRooms} SGL` : "",
          item.doubleRooms ? `${item.doubleRooms} DBL` : "",
          item.twinRooms ? `${item.twinRooms} TWN` : "",
          item.tripleRooms ? `${item.tripleRooms} TPL` : "",
        ]
          .filter(Boolean)
          .join(", ") || "-";

      const childParts: string[] = [];
      if (item.child2_5Sharing || item.child2_5Bed || item.child2_5OwnRoom) {
        const parts = [
          item.child2_5Sharing ? `${item.child2_5Sharing} Shg` : "",
          item.child2_5Bed ? `${item.child2_5Bed} Bed` : "",
          item.child2_5OwnRoom ? `${item.child2_5OwnRoom} Own` : "",
        ]
          .filter(Boolean)
          .join("/");
        childParts.push(`2-5y: ${parts}`);
      }
      if (item.child6_11Sharing || item.child6_11Bed || item.child6_11OwnRoom) {
        const parts = [
          item.child6_11Sharing ? `${item.child6_11Sharing} Shg` : "",
          item.child6_11Bed ? `${item.child6_11Bed} Bed` : "",
          item.child6_11OwnRoom ? `${item.child6_11OwnRoom} Own` : "",
        ]
          .filter(Boolean)
          .join("/");
        childParts.push(`6-11y: ${parts}`);
      }
      const childStr = childParts.join("<br/>") || "-";

      return `
      <tr>
        <td style="text-align: center;">${index + 1}</td>
        <td>${escapeHtml(formatDisplayDate(item.requiredDate))}</td>
        <td>${escapeHtml(item.roomCategory)}</td>
        <td style="text-align: center; font-weight: 600;">${escapeHtml(item.basis)}</td>
        <td>${escapeHtml(roomsStr)}</td>
        <td>${guideStr}</td>
        <td>${escapeHtml(item.arrivingFor || "-")}</td>
        <td style="font-size: 11px; line-height: 1.2;">${childStr}</td>
      </tr>
    `;
    })
    .join("");

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Voucher - ${escapeHtml(voucher.requisitionNo)}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&display=swap');
    
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    
    body {
      font-family: 'Outfit', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
      color: #1e293b;
      line-height: 1.5;
      padding: 40px;
      font-size: 13px;
      background: #ffffff;
    }
    
    /* Header branding container */
    .header-container {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 2px solid #0f172a;
      padding-bottom: 20px;
      margin-bottom: 25px;
    }
    
    .brand-logo {
      display: flex;
      flex-direction: column;
    }
    
    .brand-name {
      font-size: 26px;
      font-weight: 700;
      letter-spacing: -0.5px;
      color: #0f172a;
      line-height: 1.1;
    }
    
    .brand-subtitle {
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 2px;
      color: #64748b;
      margin-top: 4px;
      font-weight: 600;
    }
    
    .voucher-title-badge {
      text-align: right;
    }
    
    .voucher-badge {
      background: #0f172a;
      color: #ffffff;
      padding: 6px 14px;
      font-size: 12px;
      font-weight: 600;
      border-radius: 4px;
      display: inline-block;
      letter-spacing: 0.5px;
    }
    
    .voucher-date {
      font-size: 12px;
      color: #64748b;
      margin-top: 6px;
      font-weight: 500;
    }
    
    /* Two-column info grid */
    .info-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 30px;
      margin-bottom: 25px;
    }
    
    .info-card {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 16px;
    }
    
    .info-card-title {
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 1px;
      color: #64748b;
      font-weight: 700;
      margin-bottom: 10px;
      border-bottom: 1px solid #e2e8f0;
      padding-bottom: 4px;
    }
    
    .info-row {
      display: flex;
      margin-bottom: 8px;
      font-size: 13px;
    }
    
    .info-row:last-child {
      margin-bottom: 0;
    }
    
    .info-label {
      width: 120px;
      color: #64748b;
      font-weight: 500;
    }
    
    .info-value {
      flex: 1;
      font-weight: 600;
      color: #0f172a;
    }
    
    /* Tables styling */
    .table-container {
      margin-bottom: 25px;
    }
    
    .line-items-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 12px;
    }
    
    .line-items-table th {
      background: #f1f5f9;
      color: #475569;
      font-weight: 600;
      text-transform: uppercase;
      font-size: 10px;
      letter-spacing: 0.5px;
      padding: 10px 12px;
      border: 1px solid #e2e8f0;
      text-align: left;
    }
    
    .line-items-table td {
      padding: 10px 12px;
      border: 1px solid #e2e8f0;
      color: #334155;
    }
    
    .line-items-table tr:nth-child(even) td {
      background: #f8fafc;
    }
    
    /* Summary totals bar */
    .summary-bar {
      display: flex;
      justify-content: flex-end;
      gap: 30px;
      padding: 12px 20px;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      margin-bottom: 25px;
      font-size: 12px;
    }
    
    .summary-item {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    
    .summary-label {
      color: #64748b;
      font-weight: 500;
    }
    
    .summary-val {
      font-weight: 700;
      color: #0f172a;
    }
    
    /* Notes, remarks & instructions sections */
    .details-section {
      display: grid;
      grid-template-columns: 1fr;
      gap: 15px;
      margin-bottom: 30px;
    }
    
    .details-box {
      border: 1px dashed #cbd5e1;
      border-radius: 8px;
      padding: 14px;
      background: #fff;
    }
    
    .details-box-title {
      font-weight: 600;
      color: #475569;
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 6px;
    }
    
    .details-box-content {
      color: #334155;
      white-space: pre-wrap;
      font-size: 12px;
      line-height: 1.4;
    }
    
    /* Signoff footer */
    .footer-section {
      margin-top: auto;
      border-top: 1px solid #e2e8f0;
      padding-top: 18px;
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
    }
    
    .operator-info {
      font-size: 12px;
      color: #475569;
    }
    
    .operator-label {
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #94a3b8;
      margin-bottom: 4px;
      font-weight: 600;
    }
    
    .operator-name {
      font-weight: 600;
      color: #0f172a;
    }
    
    .system-stamp {
      text-align: right;
      font-size: 10px;
      color: #94a3b8;
      font-weight: 500;
    }
    
    @media print {
      body {
        padding: 0;
        font-size: 12px;
      }
      .info-card {
        background: transparent !important;
      }
      .summary-bar {
        background: transparent !important;
      }
      .line-items-table th {
        background: #f1f5f9 !important;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
      .line-items-table tr:nth-child(even) td {
        background: #f8fafc !important;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
    }
  </style>
</head>
<body>

  <div class="header-container">
    <div class="brand-logo">
      <span class="brand-name">MERIDIAN</span>
      <span class="brand-subtitle">Voucher Studio</span>
    </div>
    <div class="voucher-title-badge">
      <div class="voucher-badge">${escapeHtml(title)}</div>
      <div class="voucher-date">Date: ${escapeHtml(formatDisplayDate(voucher.date))}</div>
    </div>
  </div>

  <div class="info-grid">
    <div class="info-card">
      <div class="info-card-title">Voucher Details</div>
      <div class="info-row">
        <div class="info-label">Requisition No:</div>
        <div class="info-value">${escapeHtml(voucher.requisitionNo)}</div>
      </div>
      <div class="info-row">
        <div class="info-label">Tour No:</div>
        <div class="info-value">${escapeHtml(voucher.tourNo)}</div>
      </div>
      <div class="info-row">
        <div class="info-label">Tour Name:</div>
        <div class="info-value">${escapeHtml(voucher.tourName)}</div>
      </div>
      <div class="info-row">
        <div class="info-label">Tour Type:</div>
        <div class="info-value">${escapeHtml(voucher.tourType || "-")}</div>
      </div>
    </div>

    <div class="info-card">
      <div class="info-card-title">Service Provider & Client</div>
      <div class="info-row">
        <div class="info-label">Hotel Name:</div>
        <div class="info-value" style="color: #0f172a; font-size: 14px;">${escapeHtml(voucher.hotelName)}</div>
      </div>
      <div class="info-row">
        <div class="info-label">Customer Name:</div>
        <div class="info-value">${escapeHtml(voucher.customerName)}</div>
      </div>
      <div class="info-row">
        <div class="info-label">Market:</div>
        <div class="info-value">${escapeHtml(voucher.market || "-")}</div>
      </div>
      <div class="info-row">
        <div class="info-label">Confirmed By:</div>
        <div class="info-value">${escapeHtml(voucher.confirmedBy || "-")}</div>
      </div>
    </div>
  </div>

  <div class="table-container">
    <table class="line-items-table">
      <thead>
        <tr>
          <th style="width: 40px; text-align: center;">#</th>
          <th style="width: 100px;">Required Date</th>
          <th>Room Category</th>
          <th style="width: 60px; text-align: center;">Basis</th>
          <th style="width: 150px;">Rooms / Allocation</th>
          <th>Guide Details</th>
          <th>Arriving For</th>
          <th style="width: 120px;">Children Allocation</th>
        </tr>
      </thead>
      <tbody>
        ${rowsHtml}
      </tbody>
    </table>
  </div>

  <div class="summary-bar">
    <div class="summary-item">
      <span class="summary-label">Total Rooms:</span>
      <span class="summary-val">${totalRooms}</span>
    </div>
    <div class="summary-item">
      <span class="summary-label">Total Children:</span>
      <span class="summary-val">${totalChildren}</span>
    </div>
    <div class="summary-item">
      <span class="summary-label">Total Pax:</span>
      <span class="summary-val">${escapeHtml(voucher.totalPax) || "-"}</span>
    </div>
  </div>

  <div class="details-section">
    <div class="details-box">
      <div class="details-box-title">Rate & Financial Applicable</div>
      <div class="details-box-content" style="font-weight: 500;">${escapeHtml(voucher.rateApplicableText || (voucher.rateApplicable != null ? String(voucher.rateApplicable) : "Nil"))}</div>
    </div>

    ${
      voucher.remarks
        ? `
    <div class="details-box">
      <div class="details-box-title">Special Remarks & Notes</div>
      <div class="details-box-content">${escapeHtml(voucher.remarks)}</div>
    </div>
    `
        : ""
    }

    ${
      voucher.billingInstructions
        ? `
    <div class="details-box">
      <div class="details-box-title">Billing & Invoicing Instructions</div>
      <div class="details-box-content">${escapeHtml(voucher.billingInstructions)}</div>
    </div>
    `
        : ""
    }
  </div>

  <div class="footer-section">
    <div class="operator-info">
      <div class="operator-label">Issued By</div>
      <div class="operator-name">${escapeHtml(voucher.employeeName)}</div>
      <div style="font-size: 11px; color: #64748b; margin-top: 2px;">Email: ${escapeHtml(voucher.employeeEmail)}</div>
    </div>
    <div class="system-stamp">
      <div>Generated via Meridian Voucher Studio</div>
      <div style="margin-top: 2px; font-size: 9px; color: #cbd5e1;">Timestamp: ${new Date().toLocaleString()}</div>
    </div>
  </div>

</body>
</html>
  `;
}

export async function generatePdf(
  voucher: VoucherPayload,
  outputPath: string,
): Promise<void> {
  const htmlContent = generateVoucherHtml(voucher);

  const win = new BrowserWindow({
    show: false,
    webPreferences: {
      offscreen: true,
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  try {
    await win.loadURL(
      `data:text/html;charset=utf-8,${encodeURIComponent(htmlContent)}`,
    );

    // Print background is true so the styling background-colors are printed
    const pdfBuffer = await win.webContents.printToPDF({
      printBackground: true,
      pageSize: "A4",
      landscape: false,
    });

    await fs.writeFile(outputPath, pdfBuffer);
  } finally {
    win.close();
  }
}
