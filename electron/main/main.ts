import path from "node:path";
import { fileURLToPath } from "node:url";
import { URLSearchParams } from "node:url";
import fs from "node:fs";
import dotenv from "dotenv";
import { app, BrowserWindow, ipcMain, shell, dialog } from "electron";
import isDev from "electron-is-dev";
import { createNativeMenu } from "./menu.js";
import { createVoucherServer } from "./server.js";
import { getAccountProfile, getAuthState, resetPassword, signIn, signOut, signUp, updateProfile } from "./lib/auth.js";
import type { AuthCredentials } from "../shared/types.js";
import type { DocumentFormat, HotelRateRecord, VoucherPayload } from "../shared/types.js";
import { selectToursFolder, getToursFolder, getToursFolderTree, revealInExplorer, migrateVouchersToTours } from "./lib/toursFolder.js";
import { getAllSettings, updateSettings } from "./config.js";

let mainWindow: BrowserWindow | null = null;
let serverUrl = "";
const __dirname = path.dirname(fileURLToPath(import.meta.url));

type PublicRuntimeConfig = {
  supabaseUrl?: string;
  supabaseAnonKey?: string;
  voucherApiPort?: number;
  libreOfficePath?: string;
};

function loadEnvironmentFile(): void {
  const candidatePaths = [
    path.join(process.cwd(), ".env"),
    path.join(path.dirname(process.execPath), ".env"),
    path.join(process.resourcesPath, ".env")
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
    path.join(process.resourcesPath, "config.json")
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
      process.env.LIBREOFFICE_PATH ||= config.libreOfficePath || "";
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
console.log("[electron] active SUPABASE_URL=", process.env.SUPABASE_URL || "<not set>");

async function createWindow(): Promise<void> {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 940,
    minWidth: 900,
    minHeight: 640,
    title: "",
    backgroundColor: "#f6f8fb",
    show: false,
    titleBarStyle: 'hidden',
    icon: path.join(__dirname, "../../build-resources/icon.png"),
    webPreferences: {
      preload: path.join(__dirname, "../preload/index.cjs"),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true
    }
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

  ipcMain.handle("auth:sign-in", async (_event, credentials: AuthCredentials) => signIn(credentials));
  ipcMain.handle("auth:sign-up", async (_event, credentials: AuthCredentials) => signUp(credentials));
  ipcMain.handle("auth:reset-password", async (_event, email: string) => resetPassword(email));
  ipcMain.handle("auth:sign-out", async () => signOut());
  ipcMain.handle("auth:state", async () => getAuthState());
  ipcMain.handle("auth:update-profile", async (_event, updates: { employeeName?: string; employeeEmail?: string }) => updateProfile(updates));

  ipcMain.handle("voucher:save", async (_event, voucher: VoucherPayload) => {
    const response = await fetch(`${serverUrl}/api/vouchers`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(voucher)
    });

    if (!response.ok) {
      throw new Error(await response.text());
    }

    return response.json();
  });

  ipcMain.handle("voucher:generate", async (_event, payload: { voucher: VoucherPayload; format: DocumentFormat }) => {
    const response = await fetch(`${serverUrl}/api/vouchers/generate`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error(await response.text());
    }

    return response.json();
  });

  ipcMain.handle("voucher-documents:list", async () => {
    const response = await fetch(`${serverUrl}/api/voucher-documents`);

    if (!response.ok) {
      throw new Error(await response.text());
    }

    return response.json();
  });

  ipcMain.handle("vouchers:list", async (_event, filters?: { status?: string; dateFrom?: string; dateTo?: string; query?: string }) => {
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

    const response = await fetch(`${serverUrl}/api/vouchers?${searchParams.toString()}`);

    if (!response.ok) {
      throw new Error(await response.text());
    }

    return response.json();
  });

  ipcMain.handle("voucher:get", async (_event, voucherId: string) => {
    const response = await fetch(`${serverUrl}/api/vouchers/${voucherId}`);

    if (!response.ok) {
      throw new Error(await response.text());
    }

    return response.json();
  });

  ipcMain.handle("voucher:revisions", async (_event, voucherId: string) => {
    const response = await fetch(`${serverUrl}/api/vouchers/${voucherId}/revisions`);

    if (!response.ok) {
      throw new Error(await response.text());
    }

    return response.json();
  });

  ipcMain.handle("voucher:status", async (_event, payload: { voucherId: string; status: string }) => {
    const response = await fetch(`${serverUrl}/api/vouchers/${payload.voucherId}/status`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status: payload.status })
    });

    if (!response.ok) {
      throw new Error(await response.text());
    }

    return response.json();
  });

  ipcMain.handle("workspace:search", async (_event, query: string) => {
    const searchParams = new URLSearchParams({ q: query });
    const response = await fetch(`${serverUrl}/api/search?${searchParams.toString()}`);

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
      body: JSON.stringify(ref)
    });
    if (!response.ok) throw new Error(await response.text());
    return response.json();
  });

  ipcMain.handle("reference:delete-tour-type", async (_event, id) => {
    const response = await fetch(`${serverUrl}/api/reference/tour-types/${id}`, {
      method: "DELETE"
    });
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
      body: JSON.stringify(ref)
    });
    if (!response.ok) throw new Error(await response.text());
    return response.json();
  });

  ipcMain.handle("reference:delete-meal-basis", async (_event, id) => {
    const response = await fetch(`${serverUrl}/api/reference/meal-basis/${id}`, {
      method: "DELETE"
    });
    if (!response.ok) throw new Error(await response.text());
    return response.json();
  });

  ipcMain.handle("reference:save-market", async (_event, ref) => {
    const response = await fetch(`${serverUrl}/api/reference/markets`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(ref)
    });
    if (!response.ok) throw new Error(await response.text());
    return response.json();
  });

  ipcMain.handle("reference:delete-market", async (_event, id) => {
    const response = await fetch(`${serverUrl}/api/reference/markets/${id}`, {
      method: "DELETE"
    });
    if (!response.ok) throw new Error(await response.text());
    return response.json();
  });

  ipcMain.handle("reference:save-customer", async (_event, ref) => {
    const response = await fetch(`${serverUrl}/api/reference/customers`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(ref)
    });
    if (!response.ok) throw new Error(await response.text());
    return response.json();
  });

  ipcMain.handle("reference:delete-customer", async (_event, id) => {
    const response = await fetch(`${serverUrl}/api/reference/customers/${id}`, {
      method: "DELETE"
    });
    if (!response.ok) throw new Error(await response.text());
    return response.json();
  });

  ipcMain.handle("reference:save-room-category", async (_event, ref) => {
    const response = await fetch(`${serverUrl}/api/reference/room-categories`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(ref)
    });
    if (!response.ok) throw new Error(await response.text());
    return response.json();
  });

  ipcMain.handle("reference:delete-room-category", async (_event, id) => {
    const response = await fetch(`${serverUrl}/api/reference/room-categories/${id}`, {
      method: "DELETE"
    });
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
      body: JSON.stringify(ref)
    });
    if (!response.ok) throw new Error(await response.text());
    return response.json();
  });

  ipcMain.handle("reference:delete-currency", async (_event, id) => {
    const response = await fetch(`${serverUrl}/api/reference/currencies/${id}`, {
      method: "DELETE"
    });
    if (!response.ok) throw new Error(await response.text());
    return response.json();
  });

  ipcMain.handle("reference:list-inactive", async (_event, table: string) => {
    const response = await fetch(`${serverUrl}/api/reference/${table}/inactive`);
    if (!response.ok) throw new Error(await response.text());
    return response.json();
  });

  ipcMain.handle("reference:restore", async (_event, payload: { table: string; id: string }) => {
    const response = await fetch(`${serverUrl}/api/reference/${payload.table}/${payload.id}/restore`, {
      method: "PATCH"
    });
    if (!response.ok) throw new Error(await response.text());
    return response.json();
  });

  /* ---------- Rate Master IPC handlers ---------- */

  ipcMain.handle("rate-master:save", async (_event, contract: HotelRateRecord) => {
    const response = await fetch(`${serverUrl}/api/rate-master`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(contract),
    });
    if (!response.ok) throw new Error(await response.text());
    return response.json();
  });

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
    const response = await fetch(`${serverUrl}/api/rate-master?${params.toString()}`);
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

  ipcMain.handle("rate-master:auto-fill", async (_event, payload: { voucher: VoucherPayload; contractId?: string }) => {
    const response = await fetch(`${serverUrl}/api/rate-master/auto-fill`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!response.ok) throw new Error(await response.text());
    return response.json();
  });

  /* ---------- Tours Folder IPC handlers ---------- */

  ipcMain.handle("tours-folder:select", async () => {
    return selectToursFolder(mainWindow);
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

  ipcMain.handle("settings:set", async (_event, settings: Record<string, unknown>) => {
    return updateSettings(settings);
  });

  ipcMain.handle("dialog:select-folder", async (_event, options: { title?: string; defaultPath?: string }) => {
    const result = await dialog.showOpenDialog(mainWindow!, {
      title: options.title || "Select Folder",
      defaultPath: options.defaultPath || app.getPath("home"),
      properties: ["openDirectory"]
    });
    return result.canceled ? null : result.filePaths[0] || null;
  });

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
