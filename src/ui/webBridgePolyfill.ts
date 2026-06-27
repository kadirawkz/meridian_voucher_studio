/* eslint-disable @typescript-eslint/no-explicit-any */
/* global URLSearchParams */
// webBridgePolyfill.ts
// Exposes the `window.meridian` interface in standard web browsers by emulating Electron IPC events using HTTP requests.

const makePost = (url: string, body?: any) => {
  return fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  }).then(async (res) => {
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  });
};

const makeGet = (url: string) => {
  return fetch(url).then(async (res) => {
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  });
};

const makeDelete = (url: string) => {
  return fetch(url, { method: "DELETE" }).then(async (res) => {
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  });
};

const makePatch = (url: string, body?: any) => {
  return fetch(url, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  }).then(async (res) => {
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  });
};

// Check if running inside standard web browser context
if (typeof window !== "undefined" && !window.meridian) {
  console.log(
    "[Web Polyfill] Initializing web-bridge polyfill for browser environment...",
  );

  let toursDirectoryHandle: any = null;
  let toursDirectoryPath = "";

  async function buildTreeFromDirectoryHandle(
    dirHandle: any,
    parentPath = "",
  ): Promise<any[]> {
    const nodes: any[] = [];
    for await (const entry of dirHandle.values()) {
      if (entry.name.startsWith(".") || entry.name.startsWith("~$")) continue;
      const currentPath = parentPath
        ? `${parentPath}/${entry.name}`
        : entry.name;
      if (entry.kind === "directory") {
        const children = await buildTreeFromDirectoryHandle(entry, currentPath);
        nodes.push({
          name: entry.name,
          path: currentPath,
          type: "folder",
          children,
        });
      } else {
        const ext = entry.name.slice(entry.name.lastIndexOf(".")).toLowerCase();
        if (ext === ".docx" || ext === ".pdf") {
          nodes.push({
            name: entry.name,
            path: currentPath,
            type: "file",
          });
        }
      }
    }
    // Sort: folders first, then files, both alphabetically
    nodes.sort((a, b) => {
      if (a.type === "folder" && b.type !== "folder") return -1;
      if (a.type !== "folder" && b.type === "folder") return 1;
      return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
    });
    return nodes;
  }

  const writeToLocalToursFolder = async (
    voucher: any,
    result: any,
    format: string,
  ) => {
    if (!toursDirectoryHandle) return;
    try {
      const sanitize = (name: string) =>
        name
          .replace(/[<>:"/\\|?*]+/g, "-")
          .replace(/^-|-$/g, "")
          .trim();

      const tourTypeDir = sanitize(voucher.tourType || "Uncategorized");
      const hotelDir = sanitize(voucher.hotelName || "Unknown Hotel");

      // Ensure subdirectories exist
      const tourFolder = await toursDirectoryHandle.getDirectoryHandle(
        tourTypeDir,
        { create: true },
      );
      const hotelFolder = await tourFolder.getDirectoryHandle(hotelDir, {
        create: true,
      });

      // Fetch document blob from server
      const serverPath = format === "pdf" ? result.pdfPath : result.docxPath;
      if (!serverPath) return;

      const response = await fetch(
        `/api/documents/download?path=${encodeURIComponent(serverPath)}`,
      );
      const blob = await response.blob();

      const fileName =
        serverPath.split(/[/\\]/).pop() || `${Date.now()}.${format}`;
      const fileHandle = await hotelFolder.getFileHandle(fileName, {
        create: true,
      });
      const writable = await fileHandle.createWritable();
      await writable.write(blob);
      await writable.close();
      console.log(
        `[Web Polyfill] Successfully saved generated ${format} to local folder:`,
        fileName,
      );
    } catch (err) {
      console.error(
        "Failed to write generated document to local tours folder:",
        err,
      );
    }
  };

  const polyfill: any = {
    // Auth endpoints
    signIn: (credentials: any) => makePost("/api/auth/sign-in", credentials),
    signUp: (credentials: any) => makePost("/api/auth/sign-up", credentials),
    resetPassword: (email: string) =>
      makePost("/api/auth/reset-password", { email }),
    signOut: () => makePost("/api/auth/sign-out"),
    getAuthState: () => makeGet("/api/auth/state"),
    updateProfile: (updates: any) => makePatch("/api/auth/profile", updates),
    getAccountProfile: () => makeGet("/api/auth/profile"),
    getAppVersion: () => Promise.resolve("0.1.0-web"),

    // Vouchers endpoints
    saveVoucher: (voucher: any) => makePost("/api/vouchers", voucher),
    generateDocuments: async (voucher: any) => {
      const result = await makePost("/api/vouchers/generate", {
        voucher,
        format: "pdf",
      });
      await writeToLocalToursFolder(voucher, result, "pdf");
      return result;
    },
    generateDocx: async (voucher: any, customOutputDir?: string) => {
      const result = await makePost("/api/vouchers/generate", {
        voucher,
        format: "docx",
        customOutputDir,
      });
      await writeToLocalToursFolder(voucher, result, "docx");
      return result;
    },
    generatePdf: async (voucher: any, customOutputDir?: string) => {
      const result = await makePost("/api/vouchers/generate", {
        voucher,
        format: "pdf",
        customOutputDir,
      });
      await writeToLocalToursFolder(voucher, result, "pdf");
      return result;
    },
    renderVoucherHtml: (voucher: any) =>
      makePost("/api/vouchers/render-html", voucher),
    listVoucherDocuments: () => makeGet("/api/voucher-documents"),
    listVouchers: (filters?: any) => {
      const params = new URLSearchParams();
      if (filters?.status) params.set("status", filters.status);
      if (filters?.dateFrom) params.set("dateFrom", filters.dateFrom);
      if (filters?.dateTo) params.set("dateTo", filters.dateTo);
      if (filters?.query) params.set("query", filters.query);
      return makeGet(`/api/vouchers?${params.toString()}`);
    },
    getVoucher: (voucherId: string) => makeGet(`/api/vouchers/${voucherId}`),
    listVoucherRevisions: (voucherId: string) =>
      makeGet(`/api/vouchers/${voucherId}/revisions`),
    updateVoucherStatus: (voucherId: string, status: string) =>
      makePatch(`/api/vouchers/${voucherId}/status`, { status }),
    searchWorkspace: (query: string) =>
      makeGet(`/api/search?q=${encodeURIComponent(query)}`),

    // Rate Master
    saveHotelRates: (record: any) => makePost("/api/rate-master", record),
    deleteHotelRate: (hotelRateId: string) =>
      makeDelete(`/api/rate-master/${hotelRateId}`),
    listInactiveHotelRates: () => makeGet("/api/rate-master/inactive"),
    restoreHotelRate: (hotelRateId: string) =>
      makePatch(`/api/rate-master/${hotelRateId}/restore`),
    listHotelRates: (hotelName?: string) =>
      makeGet(
        `/api/rate-master${hotelName ? `?hotelName=${encodeURIComponent(hotelName)}` : ""}`,
      ),
    getAllHotelRates: () => makeGet("/api/rate-master/all"),
    getHotelRates: (hotelRateId: string) =>
      makeGet(`/api/rate-master/${hotelRateId}`),
    listHotelsFromRates: () => makeGet("/api/rate-master/hotels"),

    // Reference Lists
    listHotels: () => makeGet("/api/reference/hotels"),
    saveHotel: (ref: any) => makePost("/api/reference/hotels", ref),
    deleteHotel: (id: string) => makeDelete(`/api/reference/hotels/${id}`),
    openEmailClient: async (options: {
      voucherId: string;
      pdfPath: string;
    }) => {
      try {
        const voucher = await makeGet(`/api/vouchers/${options.voucherId}`);
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

        // Open local/browser default email client
        window.location.href = mailtoUrl;

        // Download the PDF so it's ready in browser downloads for drag-and-drop attachment
        if (options.pdfPath) {
          window.open(
            `/api/documents/download?path=${encodeURIComponent(options.pdfPath)}`,
            "_blank",
          );
        }

        // Update status to sent
        await makePatch(`/api/vouchers/${options.voucherId}/status`, {
          status: "sent",
        });
      } catch (err) {
        console.error("Failed to open email client in web mode:", err);
      }
    },
    listMarkets: () => makeGet("/api/reference/markets"),
    listRoomCategories: () => makeGet("/api/reference/room-categories"),
    listCustomers: () => makeGet("/api/reference/customers"),
    listTourTypes: () => makeGet("/api/reference/tour-types"),
    saveTourType: (ref: any) => makePost("/api/reference/tour-types", ref),
    deleteTourType: (id: string) =>
      makeDelete(`/api/reference/tour-types/${id}`),
    listMealBasis: () => makeGet("/api/reference/meal-basis"),
    saveMealBasis: (ref: any) => makePost("/api/reference/meal-basis", ref),
    deleteMealBasis: (id: string) =>
      makeDelete(`/api/reference/meal-basis/${id}`),
    saveMarket: (ref: any) => makePost("/api/reference/markets", ref),
    deleteMarket: (id: string) => makeDelete(`/api/reference/markets/${id}`),
    saveCustomer: (ref: any) => makePost("/api/reference/customers", ref),
    deleteCustomer: (id: string) =>
      makeDelete(`/api/reference/customers/${id}`),
    saveRoomCategory: (ref: any) =>
      makePost("/api/reference/room-categories", ref),
    deleteRoomCategory: (id: string) =>
      makeDelete(`/api/reference/room-categories/${id}`),
    listCurrencies: () => makeGet("/api/reference/currencies"),
    saveCurrency: (ref: any) => makePost("/api/reference/currencies", ref),
    deleteCurrency: (id: string) =>
      makeDelete(`/api/reference/currencies/${id}`),
    listInactiveReferences: (table: string) =>
      makeGet(`/api/reference/${table}/inactive`),
    restoreReference: (table: string, id: string) =>
      makePatch(`/api/reference/${table}/${id}/restore`),
    autoFillVoucher: (voucher: any, contractId?: string) =>
      makePost("/api/rate-master/auto-fill", { voucher, contractId }),

    // Templates DB
    listDatabaseTemplates: () => Promise.resolve([]),
    uploadDatabaseTemplate: (
      _name: string,
      _docxPath: string,
      _htmlPath: string,
    ) => Promise.resolve(),
    downloadDatabaseTemplate: () => Promise.resolve(false),
    deleteDatabaseTemplate: () => Promise.resolve(),

    // Electron specific window actions (No-ops in browser)
    minimizeWindow: () =>
      console.warn("Window action minimize is unsupported in web mode."),
    maximizeWindow: () =>
      console.warn("Window action maximize is unsupported in web mode."),
    closeWindow: () =>
      console.warn("Window action close is unsupported in web mode."),
    navigateBack: () => window.history.back(),
    navigateForward: () => window.history.forward(),

    // File/Directory actions (No-ops or simulated in browser)
    selectToursFolder: async () => {
      try {
        const handle = await (window as any).showDirectoryPicker();
        toursDirectoryHandle = handle;
        toursDirectoryPath = handle.name;
        return { path: toursDirectoryPath };
      } catch (err) {
        console.error("Directory picker canceled or failed:", err);
        return null;
      }
    },
    getToursFolder: () => Promise.resolve(toursDirectoryPath || null),
    getToursFolderTree: async () => {
      if (!toursDirectoryHandle) return [];
      try {
        const permission = await toursDirectoryHandle.queryPermission({
          mode: "readwrite",
        });
        if (permission !== "granted") {
          const request = await toursDirectoryHandle.requestPermission({
            mode: "readwrite",
          });
          if (request !== "granted") return [];
        }
        return await buildTreeFromDirectoryHandle(toursDirectoryHandle);
      } catch (err) {
        console.error("Failed to build directory tree:", err);
        return [];
      }
    },
    revealInExplorer: () => Promise.resolve(),
    migrateVouchersToTours: async () => {
      if (!toursDirectoryHandle) {
        return {
          moved: 0,
          failed: 0,
          errors: ["No local Tours folder selected"],
        };
      }
      try {
        const docs = await makeGet("/api/voucher-documents");
        let moved = 0;
        let failed = 0;
        const errors: string[] = [];

        for (const doc of docs) {
          try {
            if (doc.docxPath) {
              await writeToLocalToursFolder(
                {
                  tourType: doc.tourNo || "Uncategorized",
                  hotelName: doc.hotelName || "Unknown Hotel",
                },
                { docxPath: doc.docxPath },
                "docx",
              );
              moved++;
            }
            if (doc.pdfPath) {
              await writeToLocalToursFolder(
                {
                  tourType: doc.tourNo || "Uncategorized",
                  hotelName: doc.hotelName || "Unknown Hotel",
                },
                { pdfPath: doc.pdfPath },
                "pdf",
              );
              moved++;
            }
          } catch (err) {
            failed++;
            errors.push(err instanceof Error ? err.message : String(err));
          }
        }
        return { moved, failed, errors };
      } catch (err) {
        return {
          moved: 0,
          failed: 0,
          errors: [err instanceof Error ? err.message : String(err)],
        };
      }
    },
    openDocument: async (filePath: string) => {
      if (!filePath) return;

      // If it's a full backend server path, download it from the API
      if (filePath.includes(":") || filePath.startsWith("/")) {
        window.open(
          `/api/documents/download?path=${encodeURIComponent(filePath)}`,
          "_blank",
        );
        return;
      }

      // Otherwise, try to find it in the local toursDirectoryHandle
      if (toursDirectoryHandle) {
        try {
          const parts = filePath.split("/");
          let currentHandle: any = toursDirectoryHandle;
          for (let i = 0; i < parts.length - 1; i++) {
            currentHandle = await currentHandle.getDirectoryHandle(parts[i]);
          }
          const fileHandle = await currentHandle.getFileHandle(
            parts[parts.length - 1],
          );
          const file = await fileHandle.getFile();
          const url = window.URL.createObjectURL(file);
          window.open(url, "_blank");
          return;
        } catch (err) {
          console.error("Failed to open local document:", err);
        }
      }

      window.open(
        `/api/documents/download?path=${encodeURIComponent(filePath)}`,
        "_blank",
      );
    },
    checkPathExists: () => Promise.resolve(true),
    selectFolder: () => Promise.resolve(null),
    selectFile: () => Promise.resolve(null),

    // Settings (stored locally in localStorage in browser)
    getSettings: () => {
      try {
        const raw = localStorage.getItem("meridian-settings");
        return Promise.resolve(raw ? JSON.parse(raw) : {});
      } catch {
        return Promise.resolve({});
      }
    },
    saveSettings: (settings: any) => {
      try {
        localStorage.setItem("meridian-settings", JSON.stringify(settings));
        return Promise.resolve(settings);
      } catch {
        return Promise.resolve({});
      }
    },

    // Listener callbacks (simulated)
    onMenuNavigate: () => () => {},
    onMenuSearchFocus: () => () => {},
    onMenuSaveVoucher: () => () => {},
    onMenuGeneratePdf: () => () => {},
    onMenuGenerateDocx: () => () => {},
    onMenuSignOut: () => () => {},
    onMenuAccount: () => () => {},
  };

  (window as any).meridian = polyfill;
}
export {};
