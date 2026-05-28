import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { dialog, shell, BrowserWindow } from "electron";
import {
  getToursFolderRoot,
  setToursFolderRoot,
  getOutputDirectory,
} from "../config.js";
import type { FolderTreeNode, MigrationResult } from "../../shared/types.js";

const VOUCHER_EXTENSIONS = new Set([".docx", ".pdf"]);

/**
 * Open a native folder-picker dialog and persist the chosen path.
 */
export async function selectToursFolder(
  parentWindow: BrowserWindow | null,
): Promise<{ path: string } | null> {
  const result = await dialog.showOpenDialog(
    parentWindow ?? BrowserWindow.getFocusedWindow()!,
    {
      title: "Select or Create Tours Root Folder",
      properties: ["openDirectory", "createDirectory"],
      buttonLabel: "Select Folder",
    },
  );

  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }

  const folderPath = result.filePaths[0];
  setToursFolderRoot(folderPath);
  return { path: folderPath };
}

/**
 * Get the currently configured Tours root folder path.
 */
export function getToursFolder(): string | null {
  return getToursFolderRoot();
}

/**
 * Recursively scan the Tours root folder and return a tree structure.
 */
export async function getToursFolderTree(): Promise<FolderTreeNode[]> {
  const root = getToursFolderRoot();

  if (!root) {
    return [];
  }

  if (!fs.existsSync(root)) {
    throw new Error(`Tours root folder does not exist at: ${root}`);
  }

  return buildTreeFromDirectory(root);
}

async function buildTreeFromDirectory(
  dirPath: string,
): Promise<FolderTreeNode[]> {
  let entries: fs.Dirent[];

  try {
    entries = await fsp.readdir(dirPath, { withFileTypes: true });
  } catch {
    return [];
  }

  // Sort: folders first, then files, both alphabetically
  entries.sort((a, b) => {
    if (a.isDirectory() && !b.isDirectory()) return -1;
    if (!a.isDirectory() && b.isDirectory()) return 1;
    return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
  });

  const nodes: FolderTreeNode[] = [];

  for (const entry of entries) {
    // Skip hidden files/folders and Word temporary owner/lock files
    if (entry.name.startsWith(".") || entry.name.startsWith("~$")) continue;

    const fullPath = path.join(dirPath, entry.name);

    if (entry.isDirectory()) {
      const children = await buildTreeFromDirectory(fullPath);
      nodes.push({
        name: entry.name,
        path: fullPath,
        type: "folder",
        children,
      });
    } else if (VOUCHER_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) {
      nodes.push({
        name: entry.name,
        path: fullPath,
        type: "file",
      });
    }
  }

  return nodes;
}

/**
 * Open a file's containing folder in the system file explorer.
 */
export async function revealInExplorer(filePath: string): Promise<void> {
  try {
    const stat = await fsp.stat(filePath);
    if (stat.isDirectory()) {
      await shell.openPath(filePath);
    } else {
      shell.showItemInFolder(filePath);
    }
  } catch {
    shell.showItemInFolder(filePath);
  }
}

/**
 * Migrate existing vouchers from the flat output directory into the Tours folder structure.
 * Uses the filename pattern: <date>-<type>-<requisitionNo>-<hotelName>.docx
 * to infer the tour type and hotel for placement.
 *
 * Voucher filenames follow: date-voucherType-requisitionNo-hotelname.docx
 * Tour type is not in the filename, so we read the database via the callback, or
 * we place them in an "Uncategorized" folder grouped by hotel.
 */
export async function migrateVouchersToTours(
  lookupVoucherMeta?: (
    filename: string,
  ) => Promise<{ tourType: string; hotelName: string } | null>,
): Promise<MigrationResult> {
  const toursRoot = getToursFolderRoot();

  if (!toursRoot) {
    return { moved: 0, failed: 0, errors: ["No Tours folder configured"] };
  }

  const legacyDir = getOutputDirectory();

  if (!fs.existsSync(legacyDir)) {
    return { moved: 0, failed: 0, errors: [] };
  }

  let entries: fs.Dirent[];

  try {
    entries = await fsp.readdir(legacyDir, { withFileTypes: true });
  } catch {
    return {
      moved: 0,
      failed: 0,
      errors: ["Unable to read legacy output directory"],
    };
  }

  const result: MigrationResult = { moved: 0, failed: 0, errors: [] };
  const sanitize = (name: string) =>
    name
      .replace(/[<>:"/\\|?*]+/g, "-")
      .replace(/^-|-$/g, "")
      .trim();

  for (const entry of entries) {
    if (!entry.isFile()) continue;
    // Skip hidden files/folders and Word temporary owner/lock files
    if (entry.name.startsWith(".") || entry.name.startsWith("~$")) continue;

    const ext = path.extname(entry.name).toLowerCase();
    if (!VOUCHER_EXTENSIONS.has(ext)) continue;

    const sourcePath = path.join(legacyDir, entry.name);

    // Try to extract hotel name from filename: date-type-reqNo-hotelname.ext
    // Example: 2026-05-01-reservation-REQ001-heritance-kandalama---dambulla.docx
    let tourType = "Uncategorized";
    let hotelName = "Unknown Hotel";

    if (lookupVoucherMeta) {
      try {
        const meta = await lookupVoucherMeta(entry.name);
        if (meta) {
          tourType = meta.tourType || "Uncategorized";
          hotelName = meta.hotelName || "Unknown Hotel";
        }
      } catch {
        // Fall through to filename parsing
      }
    }

    // If no lookup or lookup failed, try to parse from filename
    if (hotelName === "Unknown Hotel") {
      const baseName = path.basename(entry.name, ext);
      const parts = baseName.split("-");
      // Pattern 1 (New): YYYY-MM-DD-type-tourType-market-reqNo-hotelName
      if (parts.length >= 8) {
        tourType = parts[4] || "Uncategorized";
        const hotelParts = parts.slice(7);
        if (hotelParts.length > 0) {
          hotelName = hotelParts.join("-");
        }
      }
      // Pattern 2 (Legacy): YYYY-MM-DD-type-reqNo-hotelName
      else if (parts.length >= 6) {
        const hotelParts = parts.slice(5);
        if (hotelParts.length > 0) {
          hotelName = hotelParts.join("-");
        }
      }
    }

    const destDir = path.join(
      toursRoot,
      sanitize(tourType),
      sanitize(hotelName),
    );
    const destPath = path.join(destDir, entry.name);

    // Don't overwrite if already exists in destination
    if (fs.existsSync(destPath)) {
      continue;
    }

    try {
      await fsp.mkdir(destDir, { recursive: true });
      await fsp.copyFile(sourcePath, destPath);
      result.moved++;
    } catch (err) {
      result.failed++;
      result.errors.push(
        `Failed to migrate ${entry.name}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  return result;
}
