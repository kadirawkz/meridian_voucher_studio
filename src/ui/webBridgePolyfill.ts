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
    generateDocuments: (voucher: any) =>
      makePost("/api/vouchers/generate", { voucher, format: "pdf" }),
    generateDocx: (voucher: any, customOutputDir?: string) =>
      makePost("/api/vouchers/generate", {
        voucher,
        format: "docx",
        customOutputDir,
      }),
    generatePdf: (voucher: any, customOutputDir?: string) =>
      makePost("/api/vouchers/generate", {
        voucher,
        format: "pdf",
        customOutputDir,
      }),
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
    uploadDatabaseTemplate: (name: string, docxPath: string, htmlPath: string) => Promise.resolve(),
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
    selectToursFolder: () => Promise.resolve(null),
    getToursFolder: () => Promise.resolve(null),
    getToursFolderTree: () => Promise.resolve([]),
    revealInExplorer: () => Promise.resolve(),
    migrateVouchersToTours: () =>
      Promise.resolve({ moved: 0, failed: 0, errors: [] }),
    openDocument: () => Promise.resolve(),
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
