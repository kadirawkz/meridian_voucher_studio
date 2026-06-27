import path from "node:path";
import { fileURLToPath } from "node:url";
import { URLSearchParams } from "node:url";
import fs from "node:fs";
import { Buffer } from "node:buffer";
import dotenv from "dotenv";
import {
  app,
  BrowserWindow,
  ipcMain,
  shell,
  dialog,
  nativeTheme,
} from "electron";
import isDev from "electron-is-dev";
import { createNativeMenu } from "./menu.js";
import { createVoucherServer } from "./server.js";
import {
  getAccountProfile,
  getAuthState,
  resetPassword,
  signIn,
  signOut,
  signUp,
  updateProfile,
} from "./lib/auth.js";
import type { AuthCredentials } from "../shared/types.js";
import type {
  DocumentFormat,
  HotelRateRecord,
  VoucherPayload,
} from "../shared/types.js";
import {
  selectToursFolder,
  getToursFolder,
  getToursFolderTree,
  revealInExplorer,
  migrateVouchersToTours,
} from "./lib/toursFolder.js";
import { getAllSettings, updateSettings } from "./config.js";
import {
  validateTemplate,
  buildTemplateData,
} from "./lib/documentGenerator.js";
import { renderHtmlTemplate } from "./lib/pdfGenerator.js";
import {
  getVoucherTemplate,
  upsertVoucherTemplate,
  listVoucherTemplates,
  deleteVoucherTemplate,
  clearTemplateMemoryCache,
} from "./lib/supabase.js";

let mainWindow: BrowserWindow | null = null;
let serverUrl = "";
const __dirname = path.dirname(fileURLToPath(import.meta.url));

let toursFolderWatcher: fs.FSWatcher | null = null;
let currentWatchedFolder: string | null = null;

function setupToursFolderWatcher(): void {
  const folderPath = getToursFolder();

  if (currentWatchedFolder === folderPath) {
    return;
  }

  if (toursFolderWatcher) {
    toursFolderWatcher.close();
    toursFolderWatcher = null;
  }

  currentWatchedFolder = folderPath;
  if (!folderPath || !fs.existsSync(folderPath)) {
    return;
  }

  try {
    let debounceTimeout: ReturnType<typeof setTimeout> | null = null;
    toursFolderWatcher = fs.watch(folderPath, { recursive: true }, () => {
      if (debounceTimeout) {
        globalThis.clearTimeout(debounceTimeout);
      }
      debounceTimeout = setTimeout(() => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send("tours-folder:changed");
        }
      }, 300);
    });
  } catch (err) {
    console.error("[watcher] Failed to watch tours folder:", err);
  }
}

type PublicRuntimeConfig = {
  supabaseUrl?: string;
  supabaseAnonKey?: string;
  voucherApiPort?: number;
};

function loadEnvironmentFile(): void {
  const candidatePaths = [
    path.join(process.cwd(), ".env"),
    path.join(path.dirname(process.execPath), ".env"),
    path.join(process.resourcesPath, ".env"),
  ];

  // Clear any stale Supabase env vars so .env values take precedence
  delete process.env.SUPABASE_URL;
  delete process.env.SUPABASE_ANON_KEY;

  for (const envPath of candidatePaths) {
    if (fs.existsSync(envPath)) {
      dotenv.config({ path: envPath, override: false });
      break;
    }
  }
}

function loadRuntimeConfigFile(): void {
  const candidatePaths = [
    path.join(path.dirname(process.execPath), "config.json"),
    path.join(app.getPath("userData"), "config.json"),
    path.join(process.resourcesPath, "config.json"),
  ];

  for (const configPath of candidatePaths) {
    if (!fs.existsSync(configPath)) {
      continue;
    }

    try {
      const raw = fs.readFileSync(configPath, "utf8");
      const config = JSON.parse(raw) as PublicRuntimeConfig;

      process.env.SUPABASE_URL ||= config.supabaseUrl || "";
      process.env.SUPABASE_ANON_KEY ||= config.supabaseAnonKey || "";
      process.env.VOUCHER_API_PORT ||= String(config.voucherApiPort ?? 0);
      break;
    } catch {
      // Ignore malformed config file and continue to the next candidate.
    }
  }
}

function loadEnvironmentConfig(): void {
  loadEnvironmentFile();
  loadRuntimeConfigFile();
}

loadEnvironmentConfig();
console.log(
  "[electron] active SUPABASE_URL=",
  process.env.SUPABASE_URL || "<not set>",
);

async function createWindow(): Promise<void> {
  const settings = getAllSettings();
  let isDarkTheme = false;
  if (settings.theme === "dark") {
    isDarkTheme = true;
  } else if (settings.theme === "system" || !settings.theme) {
    isDarkTheme = nativeTheme.shouldUseDarkColors;
  }
  const initialBgColor = isDarkTheme ? "#090d16" : "#f6f8fb";

  mainWindow = new BrowserWindow({
    width: 1440,
    height: 940,
    minWidth: 900,
    minHeight: 640,
    title: "",
    backgroundColor: initialBgColor,
    show: false,
    titleBarStyle: "hidden",
    icon: path.join(__dirname, "../../build-resources/icon.png"),
    webPreferences: {
      preload: path.join(__dirname, "../preload/index.cjs"),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
    },
  });

  // Show window gracefully after content is ready (avoids flash of white)
  mainWindow.once("ready-to-show", () => {
    mainWindow?.show();
  });

  // Handle external links by opening them in the system browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("http:") || url.startsWith("https:")) {
      void shell.openExternal(url);
      return { action: "deny" };
    }
    return { action: "allow" };
  });

  createNativeMenu(mainWindow);

  if (isDev && process.env.VITE_DEV_SERVER_URL) {
    await mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    await mainWindow.loadFile(path.join(__dirname, "../../dist/index.html"));
  }
  setupToursFolderWatcher();
}

app.whenReady().then(async () => {
  const server = await createVoucherServer();
  serverUrl = server.url;

  ipcMain.on("window:minimize", () => mainWindow?.minimize());
  ipcMain.on("window:maximize", () => {
    if (mainWindow?.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow?.maximize();
    }
  });
  ipcMain.on("window:close", () => mainWindow?.close());
  ipcMain.on("window:back", () => mainWindow?.webContents.goBack());
  ipcMain.on("window:forward", () => mainWindow?.webContents.goForward());

  ipcMain.handle("auth:sign-in", async (_event, credentials: AuthCredentials) =>
    signIn(credentials),
  );
  ipcMain.handle("auth:sign-up", async (_event, credentials: AuthCredentials) =>
    signUp(credentials),
  );
  ipcMain.handle("auth:reset-password", async (_event, email: string) =>
    resetPassword(email),
  );
  ipcMain.handle("auth:sign-out", async () => signOut());
  ipcMain.handle("auth:state", async () => getAuthState());
  ipcMain.handle(
    "auth:update-profile",
    async (
      _event,
      updates: { employeeName?: string; employeeEmail?: string },
    ) => updateProfile(updates),
  );

  ipcMain.handle("voucher:save", async (_event, voucher: VoucherPayload) => {
    const response = await fetch(`${serverUrl}/api/vouchers`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(voucher),
    });

    if (!response.ok) {
      throw new Error(await response.text());
    }

    return response.json();
  });

  ipcMain.handle(
    "voucher:generate",
    async (
      _event,
      payload: { voucher: VoucherPayload; format: DocumentFormat },
    ) => {
      const response = await fetch(`${serverUrl}/api/vouchers/generate`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      return response.json();
    },
  );

  function renderFallbackPageHtml(
    title: string,
    message: string,
    subMessage: string,
    iconSvg: string,
    badgeText: string,
    statusType: "info" | "warning" | "error",
  ): string {
    const borderColors = {
      info: "#e2e8f0",
      warning: "#fef3c7",
      error: "#fee2e2",
    };
    const titleColors = {
      info: "#0f172a",
      warning: "#b45309",
      error: "#991b1b",
    };
    const badgeClasses = {
      info: "info",
      warning: "warning",
      error: "error",
    };

    return `<!DOCTYPE html>
<html>
<head>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      background-color: #f6f8fb;
      color: #334155;
      display: flex;
      align-items: center;
      justify-content: center;
      height: 100vh;
      margin: 0;
      padding: 24px;
      box-sizing: border-box;
    }
    .card {
      background: #ffffff;
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      padding: 40px 32px;
      border-radius: 20px;
      box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.05), 0 8px 16px -6px rgba(0, 0, 0, 0.05);
      max-width: 400px;
      width: 100%;
      text-align: center;
      border: 1px solid ${borderColors[statusType]};
    }
    .icon-container {
      width: 64px;
      height: 64px;
      border-radius: 16px;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 24px auto;
    }
    .icon-container.info { background-color: #f1f5f9; }
    .icon-container.warning { background-color: #fffbeb; }
    .icon-container.error { background-color: #fef2f2; }
    
    h2 {
      margin: 0 0 12px 0;
      color: ${titleColors[statusType]};
      font-size: 20px;
      font-weight: 700;
      letter-spacing: -0.025em;
    }
    p {
      margin: 0 0 24px 0;
      color: #64748b;
      font-size: 14px;
      line-height: 1.6;
    }
    strong {
      color: #0f172a;
    }
    .sub-text {
      font-size: 12px;
      margin-top: -16px;
      color: #64748b;
      line-height: 1.5;
    }
    .badge {
      display: inline-flex;
      align-items: center;
      padding: 6px 14px;
      border-radius: 9999px;
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 0.05em;
      text-transform: uppercase;
    }
    .badge.info {
      background-color: #f1f5f9;
      color: #475569;
      border: 1px solid #e2e8f0;
    }
    .badge.warning {
      background-color: #fffbeb;
      color: #d97706;
      border: 1px solid #fef3c7;
    }
    .badge.error {
      background-color: #fef2f2;
      color: #ef4444;
      border: 1px solid #fee2e2;
    }

    @media (prefers-color-scheme: dark) {
      body {
        background-color: #1c2537;
        color: #94a3b8;
      }
      .card {
        background: #131926;
        border-color: ${statusType === "info" ? "#25354e" : statusType === "warning" ? "#78350f" : "#991b1b"};
        box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.4), 0 8px 16px -6px rgba(0, 0, 0, 0.4);
      }
      .icon-container.info { background-color: rgba(241, 245, 249, 0.05); }
      .icon-container.warning { background-color: rgba(217, 119, 6, 0.1); }
      .icon-container.error { background-color: rgba(239, 68, 68, 0.15); }
      
      h2 {
        color: ${statusType === "info" ? "#f8fafc" : statusType === "warning" ? "#fbbf24" : "#f87171"};
      }
      p {
        color: #94a3b8;
      }
      strong {
        color: #f1f5f9;
      }
      .sub-text {
        color: #64748b;
      }
      .badge.info {
        background-color: rgba(241, 245, 249, 0.05);
        color: #94a3b8;
        border-color: #1f2937;
      }
      .badge.warning {
        background-color: rgba(217, 119, 6, 0.1);
        color: #fbbf24;
        border-color: #78350f;
      }
      .badge.error {
        background-color: rgba(239, 68, 68, 0.15);
        color: #f87171;
        border-color: #991b1b;
      }
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon-container ${badgeClasses[statusType]}">
      ${iconSvg}
    </div>
    <h2>${title}</h2>
    <p>${message}</p>
    ${subMessage ? `<p class="sub-text">${subMessage}</p>` : ""}
    <div class="badge ${badgeClasses[statusType]}">${badgeText}</div>
  </div>
</body>
</html>`;
  }

  ipcMain.handle(
    "voucher:render-html",
    async (_event, voucher: VoucherPayload) => {
      const settings = getAllSettings();
      if (!settings.activeTemplateName) {
        return renderFallbackPageHtml(
          "No Template Selected",
          "Please select an active voucher template in Settings to generate documents and view live previews.",
          "",
          `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#64748b" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"></path>
            <polyline points="14 2 14 8 20 8"></polyline>
          </svg>`,
          "Configuration Required",
          "info",
        );
      }
      try {
        const dbTemplate = await getVoucherTemplate(
          settings.activeTemplateName,
        );
        if (!dbTemplate || !dbTemplate.html_data) {
          throw new Error("TEMPLATE_INCOMPLETE_OR_MISSING");
        }
        const data = buildTemplateData(voucher);
        return renderHtmlTemplate(dbTemplate.html_data, data);
      } catch (err) {
        const errMsg = (err as Error).message;
        if (errMsg === "TEMPLATE_NOT_FOUND_IN_DB") {
          return renderFallbackPageHtml(
            "Template Not Found",
            `The active template <strong>${settings.activeTemplateName}</strong> could not be found.`,
            "Please check the name or select a different active template in Settings.",
            `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"></path>
              <polyline points="14 2 14 8 20 8"></polyline>
              <line x1="9" y1="15" x2="15" y2="15"></line>
              <line x1="9" y1="19" x2="13" y2="19"></line>
            </svg>`,
            "Template Missing",
            "error",
          );
        }

        if (errMsg === "OFFLINE_AND_NOT_CACHED") {
          return renderFallbackPageHtml(
            "Template Not Cached",
            `The active template <strong>${settings.activeTemplateName}</strong> is not available offline.`,
            "Please connect to the internet to load and automatically cache this template.",
            `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#d97706" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
              <line x1="12" y1="9" x2="12" y2="13"></line>
              <line x1="12" y1="17" x2="12.01" y2="17"></line>
            </svg>`,
            "Offline Limit",
            "warning",
          );
        }

        // General error
        return renderFallbackPageHtml(
          "Failed to Load Template",
          errMsg.includes("missing in the database")
            ? errMsg
            : `An error occurred while loading active template '${settings.activeTemplateName}'.`,
          "",
          `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="8" x2="12" y2="12"></line>
            <line x1="12" y1="16" x2="12.01" y2="16"></line>
          </svg>`,
          "Error Details",
          "error",
        );
      }
    },
  );

  ipcMain.handle("voucher-documents:list", async () => {
    const response = await fetch(`${serverUrl}/api/voucher-documents`);

    if (!response.ok) {
      throw new Error(await response.text());
    }

    return response.json();
  });

  ipcMain.handle(
    "vouchers:list",
    async (
      _event,
      filters?: {
        status?: string;
        dateFrom?: string;
        dateTo?: string;
        query?: string;
      },
    ) => {
      const searchParams = new URLSearchParams();
      if (filters?.status) {
        searchParams.set("status", filters.status);
      }
      if (filters?.dateFrom) {
        searchParams.set("dateFrom", filters.dateFrom);
      }
      if (filters?.dateTo) {
        searchParams.set("dateTo", filters.dateTo);
      }
      if (filters?.query) {
        searchParams.set("query", filters.query);
      }

      const response = await fetch(
        `${serverUrl}/api/vouchers?${searchParams.toString()}`,
      );

      if (!response.ok) {
        throw new Error(await response.text());
      }

      return response.json();
    },
  );

  ipcMain.handle("voucher:get", async (_event, voucherId: string) => {
    const response = await fetch(`${serverUrl}/api/vouchers/${voucherId}`);

    if (!response.ok) {
      throw new Error(await response.text());
    }

    return response.json();
  });

  ipcMain.handle("voucher:revisions", async (_event, voucherId: string) => {
    const response = await fetch(
      `${serverUrl}/api/vouchers/${voucherId}/revisions`,
    );

    if (!response.ok) {
      throw new Error(await response.text());
    }

    return response.json();
  });

  ipcMain.handle(
    "voucher:status",
    async (_event, payload: { voucherId: string; status: string }) => {
      const response = await fetch(
        `${serverUrl}/api/vouchers/${payload.voucherId}/status`,
        {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ status: payload.status }),
        },
      );

      if (!response.ok) {
        throw new Error(await response.text());
      }

      return response.json();
    },
  );

  ipcMain.handle(
    "voucher:open-email-client",
    async (_event, payload: { voucherId: string; pdfPath: string }) => {
      const response = await fetch(
        `${serverUrl}/api/vouchers/${payload.voucherId}`,
      );
      if (!response.ok) {
        throw new Error(await response.text());
      }
      const voucher = await response.json();
      const hotelEmail = voucher.hotelEmail || "";
      const subject = encodeURIComponent(
        `Voucher: ${voucher.requisitionNo || voucher.tourNo || ""} - ${voucher.tourName || ""}`,
      );
      const body = encodeURIComponent(
        `Dear ${voucher.hotelName || "Reservations Team"},\n\n` +
          `Please find the attached voucher details for Requisition: ${voucher.requisitionNo || "N/A"}.\n\n` +
          `Tour Number: ${voucher.tourNo || "N/A"}\n` +
          `Tour Name: ${voucher.tourName || "N/A"}\n\n` +
          `Please confirm receipt and booking details.\n\n` +
          `Best regards,\n` +
          `${voucher.employeeName || "Meridian Operations"}\n` +
          `${voucher.employeeEmail || ""}`,
      );

      const mailtoUrl = `mailto:${hotelEmail}?subject=${subject}&body=${body}`;

      // Open the system's default email client
      await shell.openExternal(mailtoUrl);

      // Reveal the generated PDF in the system file explorer
      if (payload.pdfPath && fs.existsSync(payload.pdfPath)) {
        shell.showItemInFolder(payload.pdfPath);
      }

      // Update voucher status to "sent" using the server API
      const statusResponse = await fetch(
        `${serverUrl}/api/vouchers/${payload.voucherId}/status`,
        {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ status: "sent" }),
        },
      );
      if (!statusResponse.ok) {
        console.error(
          "Failed to automatically update voucher status to sent:",
          await statusResponse.text(),
        );
      }
    },
  );

  ipcMain.handle("workspace:search", async (_event, query: string) => {
    const searchParams = new URLSearchParams({ q: query });
    const response = await fetch(
      `${serverUrl}/api/search?${searchParams.toString()}`,
    );

    if (!response.ok) {
      throw new Error(await response.text());
    }

    return response.json();
  });

  ipcMain.handle("document:open", async (_event, filePath: string) => {
    await shell.openPath(filePath);
  });

  ipcMain.handle("account:profile", () => {
    return getAccountProfile();
  });

  ipcMain.handle("app:version", () => app.getVersion());

  /* ---------- Reference Data IPC handlers ---------- */

  ipcMain.handle("reference:hotels", async () => {
    const response = await fetch(`${serverUrl}/api/reference/hotels`);
    if (!response.ok) throw new Error(await response.text());
    return response.json();
  });

  ipcMain.handle("reference:save-hotel", async (_event, ref) => {
    const response = await fetch(`${serverUrl}/api/reference/hotels`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(ref),
    });
    if (!response.ok) throw new Error(await response.text());
    return response.json();
  });

  ipcMain.handle("reference:delete-hotel", async (_event, id) => {
    const response = await fetch(`${serverUrl}/api/reference/hotels/${id}`, {
      method: "DELETE",
    });
    if (!response.ok) throw new Error(await response.text());
    return response.json();
  });

  ipcMain.handle("reference:markets", async () => {
    const response = await fetch(`${serverUrl}/api/reference/markets`);
    if (!response.ok) throw new Error(await response.text());
    return response.json();
  });

  ipcMain.handle("reference:room-categories", async () => {
    const response = await fetch(`${serverUrl}/api/reference/room-categories`);
    if (!response.ok) throw new Error(await response.text());
    return response.json();
  });

  ipcMain.handle("reference:customers", async () => {
    const response = await fetch(`${serverUrl}/api/reference/customers`);
    if (!response.ok) throw new Error(await response.text());
    return response.json();
  });

  ipcMain.handle("reference:tour-types", async () => {
    const response = await fetch(`${serverUrl}/api/reference/tour-types`);
    if (!response.ok) throw new Error(await response.text());
    return response.json();
  });

  ipcMain.handle("reference:save-tour-type", async (_event, ref) => {
    const response = await fetch(`${serverUrl}/api/reference/tour-types`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(ref),
    });
    if (!response.ok) throw new Error(await response.text());
    return response.json();
  });

  ipcMain.handle("reference:delete-tour-type", async (_event, id) => {
    const response = await fetch(
      `${serverUrl}/api/reference/tour-types/${id}`,
      {
        method: "DELETE",
      },
    );
    if (!response.ok) throw new Error(await response.text());
    return response.json();
  });

  ipcMain.handle("reference:meal-basis", async () => {
    const response = await fetch(`${serverUrl}/api/reference/meal-basis`);
    if (!response.ok) throw new Error(await response.text());
    return response.json();
  });

  ipcMain.handle("reference:save-meal-basis", async (_event, ref) => {
    const response = await fetch(`${serverUrl}/api/reference/meal-basis`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(ref),
    });
    if (!response.ok) throw new Error(await response.text());
    return response.json();
  });

  ipcMain.handle("reference:delete-meal-basis", async (_event, id) => {
    const response = await fetch(
      `${serverUrl}/api/reference/meal-basis/${id}`,
      {
        method: "DELETE",
      },
    );
    if (!response.ok) throw new Error(await response.text());
    return response.json();
  });

  ipcMain.handle("reference:save-market", async (_event, ref) => {
    const response = await fetch(`${serverUrl}/api/reference/markets`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(ref),
    });
    if (!response.ok) throw new Error(await response.text());
    return response.json();
  });

  ipcMain.handle("reference:delete-market", async (_event, id) => {
    const response = await fetch(`${serverUrl}/api/reference/markets/${id}`, {
      method: "DELETE",
    });
    if (!response.ok) throw new Error(await response.text());
    return response.json();
  });

  ipcMain.handle("reference:save-customer", async (_event, ref) => {
    const response = await fetch(`${serverUrl}/api/reference/customers`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(ref),
    });
    if (!response.ok) throw new Error(await response.text());
    return response.json();
  });

  ipcMain.handle("reference:delete-customer", async (_event, id) => {
    const response = await fetch(`${serverUrl}/api/reference/customers/${id}`, {
      method: "DELETE",
    });
    if (!response.ok) throw new Error(await response.text());
    return response.json();
  });

  ipcMain.handle("reference:save-room-category", async (_event, ref) => {
    const response = await fetch(`${serverUrl}/api/reference/room-categories`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(ref),
    });
    if (!response.ok) throw new Error(await response.text());
    return response.json();
  });

  ipcMain.handle("reference:delete-room-category", async (_event, id) => {
    const response = await fetch(
      `${serverUrl}/api/reference/room-categories/${id}`,
      {
        method: "DELETE",
      },
    );
    if (!response.ok) throw new Error(await response.text());
    return response.json();
  });

  ipcMain.handle("reference:currencies", async () => {
    const response = await fetch(`${serverUrl}/api/reference/currencies`);
    if (!response.ok) throw new Error(await response.text());
    return response.json();
  });

  ipcMain.handle("reference:save-currency", async (_event, ref) => {
    const response = await fetch(`${serverUrl}/api/reference/currencies`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(ref),
    });
    if (!response.ok) throw new Error(await response.text());
    return response.json();
  });

  ipcMain.handle("reference:delete-currency", async (_event, id) => {
    const response = await fetch(
      `${serverUrl}/api/reference/currencies/${id}`,
      {
        method: "DELETE",
      },
    );
    if (!response.ok) throw new Error(await response.text());
    return response.json();
  });

  ipcMain.handle("reference:list-inactive", async (_event, table: string) => {
    const response = await fetch(
      `${serverUrl}/api/reference/${table}/inactive`,
    );
    if (!response.ok) throw new Error(await response.text());
    return response.json();
  });

  ipcMain.handle(
    "reference:restore",
    async (_event, payload: { table: string; id: string }) => {
      const response = await fetch(
        `${serverUrl}/api/reference/${payload.table}/${payload.id}/restore`,
        {
          method: "PATCH",
        },
      );
      if (!response.ok) throw new Error(await response.text());
      return response.json();
    },
  );

  /* ---------- Rate Master IPC handlers ---------- */

  ipcMain.handle(
    "rate-master:save",
    async (_event, contract: HotelRateRecord) => {
      const response = await fetch(`${serverUrl}/api/rate-master`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(contract),
      });
      if (!response.ok) throw new Error(await response.text());
      return response.json();
    },
  );

  ipcMain.handle("rate-master:delete", async (_event, id: string) => {
    const response = await fetch(`${serverUrl}/api/rate-master/${id}`, {
      method: "DELETE",
    });
    if (!response.ok) throw new Error(await response.text());
    return response.json();
  });

  ipcMain.handle("rate-master:list-inactive", async () => {
    const response = await fetch(`${serverUrl}/api/rate-master/inactive`);
    if (!response.ok) throw new Error(await response.text());
    return response.json();
  });

  ipcMain.handle("rate-master:restore", async (_event, id: string) => {
    const response = await fetch(`${serverUrl}/api/rate-master/${id}/restore`, {
      method: "PATCH",
    });
    if (!response.ok) throw new Error(await response.text());
    return response.json();
  });

  ipcMain.handle("rate-master:all", async () => {
    const response = await fetch(`${serverUrl}/api/rate-master/all`);
    if (!response.ok) throw new Error(await response.text());
    return response.json();
  });

  ipcMain.handle("rate-master:list", async (_event, hotelName?: string) => {
    const params = new URLSearchParams();
    if (hotelName) params.set("hotelName", hotelName);
    const response = await fetch(
      `${serverUrl}/api/rate-master?${params.toString()}`,
    );
    if (!response.ok) throw new Error(await response.text());
    return response.json();
  });

  ipcMain.handle("rate-master:get", async (_event, contractId: string) => {
    const response = await fetch(`${serverUrl}/api/rate-master/${contractId}`);
    if (!response.ok) throw new Error(await response.text());
    return response.json();
  });

  ipcMain.handle("rate-master:hotels", async () => {
    const response = await fetch(`${serverUrl}/api/rate-master/hotels`);
    if (!response.ok) throw new Error(await response.text());
    return response.json();
  });

  ipcMain.handle(
    "rate-master:auto-fill",
    async (
      _event,
      payload: { voucher: VoucherPayload; contractId?: string },
    ) => {
      const response = await fetch(`${serverUrl}/api/rate-master/auto-fill`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) throw new Error(await response.text());
      return response.json();
    },
  );

  /* ---------- Tours Folder IPC handlers ---------- */

  ipcMain.handle("tours-folder:select", async () => {
    const result = await selectToursFolder(mainWindow);
    if (result) {
      setupToursFolderWatcher();
    }
    return result;
  });

  ipcMain.handle("tours-folder:get", async () => {
    return getToursFolder();
  });

  ipcMain.handle("tours-folder:tree", async () => {
    return getToursFolderTree();
  });

  ipcMain.handle("tours-folder:reveal", async (_event, filePath: string) => {
    return revealInExplorer(filePath);
  });

  ipcMain.handle("tours-folder:migrate", async () => {
    return migrateVouchersToTours();
  });

  /* ---------- Settings IPC handlers ---------- */

  ipcMain.handle("settings:get", async () => {
    return getAllSettings();
  });

  ipcMain.handle(
    "settings:set",
    async (_event, settings: Record<string, unknown>) => {
      if (settings.activeTemplateName !== undefined) {
        clearTemplateMemoryCache();
      }
      const result = updateSettings(settings);
      if (settings.toursFolderRoot !== undefined) {
        setupToursFolderWatcher();
      }
      if (settings.activeTemplateName) {
        // Pre-cache the template file for offline support
        getVoucherTemplate(settings.activeTemplateName as string).catch(
          (err) => {
            console.warn(
              `Failed to pre-cache active template '${settings.activeTemplateName}':`,
              err,
            );
          },
        );
      }
      return result;
    },
  );

  ipcMain.handle("dialog:check-path", async (_event, folderPath: string) => {
    if (!folderPath) return false;
    try {
      const stats = await fs.promises.stat(folderPath);
      return stats.isDirectory();
    } catch {
      return false;
    }
  });

  ipcMain.handle(
    "dialog:select-folder",
    async (_event, options: { title?: string; defaultPath?: string }) => {
      const result = await dialog.showOpenDialog(mainWindow!, {
        title: options.title || "Select Folder",
        defaultPath: options.defaultPath || app.getPath("home"),
        properties: ["openDirectory"],
      });
      return result.canceled ? null : result.filePaths[0] || null;
    },
  );

  ipcMain.handle(
    "dialog:select-file",
    async (
      _event,
      options: {
        title?: string;
        defaultPath?: string;
        filters?: Array<{ name: string; extensions: string[] }>;
      },
    ) => {
      const result = await dialog.showOpenDialog(mainWindow!, {
        title: options.title || "Select File",
        defaultPath: options.defaultPath || app.getPath("home"),
        properties: ["openFile"],
        filters: options.filters,
      });
      return result.canceled ? null : result.filePaths[0] || null;
    },
  );

  ipcMain.handle("template-db:list", async () => {
    return listVoucherTemplates();
  });

  ipcMain.handle(
    "template-db:upload",
    async (
      _event,
      {
        name,
        docxPath,
        htmlPath,
      }: { name: string; docxPath: string; htmlPath: string },
    ) => {
      await validateTemplate(docxPath);
      const docxContent = await fs.promises.readFile(docxPath);
      const docxBase64 = docxContent.toString("base64");
      let htmlContent = await fs.promises.readFile(htmlPath, "utf8");

      // Auto-inline images referenced in the HTML
      const htmlDir = path.dirname(htmlPath);
      const srcRegex = /src=(["'])(.*?)\1/gi;
      const replacements: Array<{
        quote: string;
        original: string;
        base64Uri: string;
      }> = [];

      const matches = [...htmlContent.matchAll(srcRegex)];
      for (const m of matches) {
        const quote = m[1];
        const originalSrc = m[2];
        if (
          !originalSrc.startsWith("http://") &&
          !originalSrc.startsWith("https://") &&
          !originalSrc.startsWith("data:")
        ) {
          const relativePath = decodeURIComponent(originalSrc);
          const absoluteImagePath = path.resolve(htmlDir, relativePath);
          try {
            const imageBuffer = await fs.promises.readFile(absoluteImagePath);
            const ext = path
              .extname(absoluteImagePath)
              .toLowerCase()
              .replace(".", "");
            const mimeType =
              ext === "svg"
                ? "image/svg+xml"
                : `image/${ext === "jpg" ? "jpeg" : ext}`;
            const base64Uri = `data:${mimeType};base64,${imageBuffer.toString("base64")}`;
            replacements.push({ quote, original: originalSrc, base64Uri });
          } catch (err) {
            console.warn(
              `Failed to auto-inline template image at ${absoluteImagePath}:`,
              err,
            );
          }
        }
      }

      for (const r of replacements) {
        htmlContent = htmlContent.replace(
          `src=${r.quote}${r.original}${r.quote}`,
          `src=${r.quote}${r.base64Uri}${r.quote}`,
        );
      }

      await upsertVoucherTemplate(name, docxBase64, htmlContent);
    },
  );

  ipcMain.handle(
    "template-db:download",
    async (_event, { name }: { name: string }) => {
      const template = await getVoucherTemplate(name);
      if (!template?.docx_data) {
        throw new Error(`Template '${name}' not found or empty.`);
      }

      const result = await dialog.showSaveDialog(mainWindow!, {
        title: "Save Template",
        defaultPath: path.join(app.getPath("downloads"), `${name}.docx`),
        filters: [{ name: "Word Documents", extensions: ["docx"] }],
      });

      if (result.canceled || !result.filePath) {
        return false;
      }

      const buffer = Buffer.from(template.docx_data, "base64");
      await fs.promises.writeFile(result.filePath, buffer);
      return true;
    },
  );

  ipcMain.handle(
    "template-db:delete",
    async (_event, { name }: { name: string }) => {
      await deleteVoucherTemplate(name);
    },
  );

  await createWindow();

  app.on("activate", async () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      await createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
