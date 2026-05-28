import type { IpcRendererEvent } from "electron";
import type { AppApi, AuthCredentials, FolderTreeNode, HotelRateRecord, MigrationResult, VoucherListFilters, VoucherPayload, VoucherStatus } from "../shared/types.js";

const { contextBridge, ipcRenderer } = require("electron") as typeof import("electron");

const api: AppApi = {
  signIn: (credentials: AuthCredentials) => ipcRenderer.invoke("auth:sign-in", credentials),
  signUp: (credentials: AuthCredentials) => ipcRenderer.invoke("auth:sign-up", credentials),
  resetPassword: (email: string) => ipcRenderer.invoke("auth:reset-password", email),
  signOut: () => ipcRenderer.invoke("auth:sign-out"),
  getAuthState: () => ipcRenderer.invoke("auth:state"),
  updateProfile: (updates: { employeeName?: string; employeeEmail?: string }) => ipcRenderer.invoke("auth:update-profile", updates),
  saveVoucher: (voucher: VoucherPayload) => ipcRenderer.invoke("voucher:save", voucher),
  generateDocuments: (voucher: VoucherPayload) => ipcRenderer.invoke("voucher:generate", { voucher, format: "pdf" }),
  generateDocx: (voucher: VoucherPayload, customOutputDir?: string) => ipcRenderer.invoke("voucher:generate", { voucher, format: "docx", customOutputDir }),
  generatePdf: (voucher: VoucherPayload, customOutputDir?: string) => ipcRenderer.invoke("voucher:generate", { voucher, format: "pdf", customOutputDir }),
  listVoucherDocuments: () => ipcRenderer.invoke("voucher-documents:list"),
  listVouchers: (filters?: VoucherListFilters) => ipcRenderer.invoke("vouchers:list", filters),
  getVoucher: (voucherId: string) => ipcRenderer.invoke("voucher:get", voucherId),
  listVoucherRevisions: (voucherId: string) => ipcRenderer.invoke("voucher:revisions", voucherId),
  updateVoucherStatus: (voucherId: string, status: VoucherStatus) => ipcRenderer.invoke("voucher:status", { voucherId, status }),
  searchWorkspace: (query: string) => ipcRenderer.invoke("workspace:search", query),
  openDocument: (filePath: string) => ipcRenderer.invoke("document:open", filePath),
  getAccountProfile: () => ipcRenderer.invoke("account:profile"),
  getAppVersion: () => ipcRenderer.invoke("app:version"),
  onMenuNavigate: (callback: (view: string) => void) => {
    const listener = (_: any, view: string) => callback(view);
    ipcRenderer.on("menu:navigate", listener);
    return () => ipcRenderer.removeListener("menu:navigate", listener);
  },
  onMenuSearchFocus: (callback: () => void) => {
    const listener = () => callback();
    ipcRenderer.on("menu:search-focus", listener);
    return () => ipcRenderer.removeListener("menu:search-focus", listener);
  },
  onMenuSaveVoucher: (callback: () => void) => {
    const listener = () => callback();
    ipcRenderer.on("menu:save-voucher", listener);
    return () => ipcRenderer.removeListener("menu:save-voucher", listener);
  },
  onMenuGeneratePdf: (callback: () => void) => {
    const listener = () => callback();
    ipcRenderer.on("menu:generate-pdf", listener);
    return () => ipcRenderer.removeListener("menu:generate-pdf", listener);
  },
  onMenuGenerateDocx: (callback: () => void) => {
    const listener = () => callback();
    ipcRenderer.on("menu:generate-docx", listener);
    return () => ipcRenderer.removeListener("menu:generate-docx", listener);
  },
  onMenuSignOut: (callback: () => void) => {
    const listener = () => callback();
    ipcRenderer.on("menu:sign-out", listener);
    return () => ipcRenderer.removeListener("menu:sign-out", listener);
  },
  onMenuAccount: (callback: (action: string) => void) => {
    const listener = (_: any, action: string) => callback(action);
    ipcRenderer.on("menu:account", listener);
    return () => ipcRenderer.removeListener("menu:account", listener);
  },
  saveHotelRates: (record: HotelRateRecord) => ipcRenderer.invoke("rate-master:save", record),
  deleteHotelRate: (hotelRateId: string) => ipcRenderer.invoke("rate-master:delete", hotelRateId),
  listInactiveHotelRates: () => ipcRenderer.invoke("rate-master:list-inactive"),
  restoreHotelRate: (hotelRateId: string) => ipcRenderer.invoke("rate-master:restore", hotelRateId),
  listHotelRates: (hotelName?: string) => ipcRenderer.invoke("rate-master:list", hotelName),
  getAllHotelRates: () => ipcRenderer.invoke("rate-master:all"),
  getHotelRates: (hotelRateId: string) => ipcRenderer.invoke("rate-master:get", hotelRateId),
  listHotelsFromRates: () => ipcRenderer.invoke("rate-master:hotels"),
  listHotels: () => ipcRenderer.invoke("reference:hotels"),
  listMarkets: () => ipcRenderer.invoke("reference:markets"),
  listRoomCategories: () => ipcRenderer.invoke("reference:room-categories"),
  listCustomers: () => ipcRenderer.invoke("reference:customers"),
  listTourTypes: () => ipcRenderer.invoke("reference:tour-types"),
  saveTourType: (ref: { code: string; name: string }) => ipcRenderer.invoke("reference:save-tour-type", ref),
  deleteTourType: (id: string) => ipcRenderer.invoke("reference:delete-tour-type", id),
  listMealBasis: () => ipcRenderer.invoke("reference:meal-basis"),
  saveMealBasis: (ref: { code: string; name: string }) => ipcRenderer.invoke("reference:save-meal-basis", ref),
  deleteMealBasis: (id: string) => ipcRenderer.invoke("reference:delete-meal-basis", id),
  saveMarket: (ref: { code: string; name: string }) => ipcRenderer.invoke("reference:save-market", ref),
  deleteMarket: (id: string) => ipcRenderer.invoke("reference:delete-market", id),
  saveCustomer: (ref: { name: string; is_active?: boolean }) => ipcRenderer.invoke("reference:save-customer", ref),
  deleteCustomer: (id: string) => ipcRenderer.invoke("reference:delete-customer", id),
  saveRoomCategory: (ref: { name: string }) => ipcRenderer.invoke("reference:save-room-category", ref),
  deleteRoomCategory: (id: string) => ipcRenderer.invoke("reference:delete-room-category", id),
  listCurrencies: () => ipcRenderer.invoke("reference:currencies"),
  saveCurrency: (ref: { code: string; name: string }) => ipcRenderer.invoke("reference:save-currency", ref),
  deleteCurrency: (id: string) => ipcRenderer.invoke("reference:delete-currency", id),
  listInactiveReferences: (table: string) => ipcRenderer.invoke("reference:list-inactive", table),
  restoreReference: (table: string, id: string) => ipcRenderer.invoke("reference:restore", { table, id }),
  autoFillVoucher: (voucher: VoucherPayload, contractId?: string) => ipcRenderer.invoke("rate-master:auto-fill", { voucher, contractId }),
  selectToursFolder: () => ipcRenderer.invoke("tours-folder:select"),
  getToursFolder: () => ipcRenderer.invoke("tours-folder:get"),
  getToursFolderTree: () => ipcRenderer.invoke("tours-folder:tree"),
  revealInExplorer: (filePath: string) => ipcRenderer.invoke("tours-folder:reveal", filePath),
  migrateVouchersToTours: () => ipcRenderer.invoke("tours-folder:migrate"),
  minimizeWindow: () => ipcRenderer.send("window:minimize"),
  maximizeWindow: () => ipcRenderer.send("window:maximize"),
  closeWindow: () => ipcRenderer.send("window:close"),
  navigateBack: () => ipcRenderer.send("window:back"),
  navigateForward: () => ipcRenderer.send("window:forward"),
  getSettings: () => ipcRenderer.invoke("settings:get"),
  saveSettings: (settings: Record<string, any>) => ipcRenderer.invoke("settings:set", settings),
  selectFolder: (options: { title?: string; defaultPath?: string }) => ipcRenderer.invoke("dialog:select-folder", options),
  selectFile: (options: { title?: string; defaultPath?: string; filters?: Array<{ name: string; extensions: string[] }> }) => ipcRenderer.invoke("dialog:select-file", options),
  listDatabaseTemplates: () => ipcRenderer.invoke("template-db:list"),
  uploadDatabaseTemplate: (name: string, filePath: string) => ipcRenderer.invoke("template-db:upload", { name, filePath }),
  downloadDatabaseTemplate: (name: string) => ipcRenderer.invoke("template-db:download", { name }),
  deleteDatabaseTemplate: (name: string) => ipcRenderer.invoke("template-db:delete", { name }),
};

contextBridge.exposeInMainWorld("meridian", api);

