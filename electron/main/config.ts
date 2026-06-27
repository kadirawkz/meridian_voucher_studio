import path from "node:path";
import fs from "node:fs";
import os from "node:os";

// Safe import of Electron to support standalone server mode
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let app: any;
try {
  const electron = await import("electron");
  app = electron.app;
} catch {
  app = {
    isPackaged: false,
    getPath: (name: string) => {
      if (name === "userData") {
        const userDataPath = path.join(process.cwd(), "data");
        if (!fs.existsSync(userDataPath)) {
          fs.mkdirSync(userDataPath, { recursive: true });
        }
        return userDataPath;
      }
      if (name === "documents") {
        const docsPath = path.join(process.cwd(), "documents");
        if (!fs.existsSync(docsPath)) {
          fs.mkdirSync(docsPath, { recursive: true });
        }
        return docsPath;
      }
      return os.tmpdir();
    },
  };
}



export function getOutputDirectory(): string {
  const settings = readSettings();
  const dir = settings.exportDirectory || path.join(app.getPath("documents"), "Meridian Voucher Studio");
  if (!fs.existsSync(dir)) {
    try {
      fs.mkdirSync(dir, { recursive: true });
    } catch (e) {
      console.error("Failed to create export directory:", dir, e);
    }
  }
  return dir;
}

/* ---------- Tours folder persistence ---------- */

interface AppSettings {
  toursFolderRoot?: string;
  exportDirectory?: string;
  theme?: "light" | "dark" | "system";
  activeTemplateName?: string;
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
  fs.writeFileSync(
    getSettingsPath(),
    JSON.stringify(settings, null, 2),
    "utf8",
  );
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
export function resolveVoucherOutputDirectory(
  tourType: string,
  hotelName: string,
): string {
  const toursRoot = getToursFolderRoot();

  if (toursRoot) {
    const sanitize = (name: string) =>
      name
        .replace(/[<>:"/\\|?*]+/g, "-")
        .replace(/^-|-$/g, "")
        .trim();
    return path.join(toursRoot, sanitize(tourType), sanitize(hotelName));
  }

  return getOutputDirectory();
}

export function getAllSettings(): AppSettings {
  const settings = readSettings();
  if (!settings.exportDirectory) {
    return {
      ...settings,
      exportDirectory: getOutputDirectory(),
    };
  }
  return settings;
}

export function updateSettings(updates: Partial<AppSettings>): AppSettings {
  const current = readSettings();
  const updated = { ...current, ...updates };
  writeSettings(updated);
  return updated;
}
