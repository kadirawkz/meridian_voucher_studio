import path from "node:path";
import fs from "node:fs";
import { app } from "electron";

export function getTemplatePath(): string {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, "templates", "voucher-template.docx");
  }

  return path.join(process.cwd(), "templates", "voucher-template.docx");
}

export function getOutputDirectory(): string {
  return path.join(app.getPath("documents"), "Meridian Voucher Studio");
}

/* ---------- Tours folder persistence ---------- */

interface AppSettings {
  toursFolderRoot?: string;
  exportDirectory?: string;
}

function getSettingsPath(): string {
  return path.join(app.getPath("userData"), "meridian-settings.json");
}

function readSettings(): AppSettings {
  const settingsPath = getSettingsPath();

  if (!fs.existsSync(settingsPath)) {
    return {};
  }

  try {
    return JSON.parse(fs.readFileSync(settingsPath, "utf8")) as AppSettings;
  } catch {
    return {};
  }
}

function writeSettings(settings: AppSettings): void {
  fs.writeFileSync(getSettingsPath(), JSON.stringify(settings, null, 2), "utf8");
}

export function getToursFolderRoot(): string | null {
  const root = readSettings().toursFolderRoot;

  if (!root || !fs.existsSync(root)) {
    return null;
  }

  return root;
}

export function setToursFolderRoot(folderPath: string): void {
  const settings = readSettings();
  settings.toursFolderRoot = folderPath;
  writeSettings(settings);
}

/**
 * Resolve the output directory for a voucher.
 * If a Tours root is configured, use the structured path: <root>/<tourType>/<hotelName>/
 * Otherwise, fall back to the flat Documents folder.
 */
export function resolveVoucherOutputDirectory(tourType: string, hotelName: string): string {
  const toursRoot = getToursFolderRoot();

  if (toursRoot) {
    const sanitize = (name: string) => name.replace(/[<>:"/\\|?*]+/g, "-").replace(/^-|-$/g, "").trim();
    return path.join(toursRoot, sanitize(tourType), sanitize(hotelName));
  }

  return getOutputDirectory();
}

export function getAllSettings(): AppSettings {
  return readSettings();
}

export function updateSettings(updates: Partial<AppSettings>): AppSettings {
  const current = readSettings();
  const updated = { ...current, ...updates };
  writeSettings(updated);
  return updated;
}
