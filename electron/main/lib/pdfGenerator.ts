import fs from "node:fs/promises";
import type { VoucherPayload } from "../../shared/types.js";
import { buildTemplateData } from "./documentGenerator.js";

// Safe import of Electron to support standalone server mode
let BrowserWindow: (typeof import("electron"))["BrowserWindow"] | undefined;
try {
  const electron = await import("electron");
  BrowserWindow = electron.BrowserWindow;
} catch {
  // Headless container mode: operations utilizing GUI features will fail gracefully
}

function escapeHtml(value: unknown): string {
  if (value == null) return "";
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function getNestedValue(data: Record<string, unknown>, path: string): unknown {
  return path.split(".").reduce<unknown>((acc, prop) => {
    if (acc && typeof acc === "object" && prop in acc) {
      return (acc as Record<string, unknown>)[prop];
    }
    return undefined;
  }, data);
}

export function renderHtmlTemplate(
  html: string,
  data: Record<string, unknown>,
  isRoot = true,
): string {
  let processedHtml = html;

  // Auto-fix legacy HTML templates that use line item variables but lack a {#lineItems} loop
  if (isRoot && !processedHtml.includes("{#lineItems}")) {
    const trRegex = /<tr[^>]*>(?:(?!<\/tr>)[\s\S])*?\{(?:required_date|requiredDate|RequiredDate|requiredDateDisplay)\}[\s\S]*?<\/tr>/gi;
    processedHtml = processedHtml.replace(trRegex, (match) => {
      return `{#lineItems}${match}{/lineItems}`;
    });
  }

  // 1. Process loops: {#lineItems} ... {/lineItems}
  const loopRegex = /\{#([a-zA-Z0-9_]+)\}([\s\S]*?)\{\/\1\}/g;
  let rendered = processedHtml.replace(loopRegex, (match, key, content) => {
    const list = data[key];
    if (Array.isArray(list)) {
      return list
        .map((item) => {
          const mergedContext = { ...data, ...item };
          return renderHtmlTemplate(content, mergedContext, false);
        })
        .join("");
    }
    return "";
  });

  // 2. Process variables: {variableName}
  const varRegex = /\{([a-zA-Z0-9_\-.]+)\}/g;
  rendered = rendered.replace(varRegex, (match, key) => {
    const val = getNestedValue(data, key);
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

  if (!BrowserWindow) {
    throw new Error("Electron BrowserWindow is unavailable in this runtime.");
  }

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
