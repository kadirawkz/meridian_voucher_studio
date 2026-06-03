import fs from "node:fs/promises";
import type { VoucherPayload } from "../../shared/types.js";
import { buildTemplateData } from "./documentGenerator.js";

// Safe import of Electron to support standalone server mode
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let BrowserWindow: any;
try {
  const electron = await import("electron");
  BrowserWindow = electron.BrowserWindow;
} catch {
  // Headless container mode: operations utilizing GUI features will fail gracefully
}

function escapeHtml(value: string | number | undefined | null): string {
  if (value == null) return "";
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function renderHtmlTemplate(html: string, data: Record<string, any>): string {
  // 1. Process loops: {#lineItems} ... {/lineItems}
  const loopRegex = /\{#([a-zA-Z0-9_]+)\}([\s\S]*?)\{\/\1\}/g;
  let rendered = html.replace(loopRegex, (match, key, content) => {
    const list = data[key];
    if (Array.isArray(list)) {
      return list
        .map((item) => {
          const mergedContext = { ...data, ...item };
          return renderHtmlTemplate(content, mergedContext);
        })
        .join("");
    }
    return "";
  });

  // 2. Process variables: {variableName}
  const varRegex = /\{([a-zA-Z0-9_\-.]+)\}/g;
  rendered = rendered.replace(varRegex, (match, key) => {
    const val = key.split('.').reduce((acc: any, prop: string) => acc?.[prop], data);
    if (val !== undefined && val !== null) {
      return escapeHtml(val).replace(/\n/g, "<br/>");
    }
    return match; // Keep the original string (e.g. for CSS rules or unrecognized variables)
  });

  return rendered;
}

export async function generatePdf(
  voucher: VoucherPayload,
  outputPath: string,
  htmlTemplate: string,
): Promise<void> {
  const data = buildTemplateData(voucher);
  const htmlContent = renderHtmlTemplate(htmlTemplate, data);

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
