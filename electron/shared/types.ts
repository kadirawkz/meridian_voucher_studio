export type VoucherType = "reservation" | "amendment" | "pptp";
export type TourType = string;
export type VoucherStatus = "draft" | "generated" | "sent";
export type DocumentFormat = "docx" | "pdf";

/* ---------- Reference data types ---------- */

export interface HotelRef {
  id: string;
  name: string;
  email?: string;
  is_active: boolean;
}

export interface MarketRef {
  id: string;
  code: string;
  name: string;
}

export interface RoomCategoryRef {
  id: string;
  name: string;
}

export interface CustomerRef {
  id: string;
  name: string;
  is_active: boolean;
}

export interface TourTypeRef {
  id: string;
  code: string;
  name: string;
}

export interface MealBasisRef {
  id: string;
  code: string;
  name: string;
}

export interface CurrencyRef {
  id: string;
  code: string;
  name: string;
}

/* ---------- Voucher types ---------- */

export interface VoucherLineItem {
  requiredDate: string;
  roomCategoryId?: string;
  roomCategory: string; // read-only, populated by JOIN
  basis: string;
  singleRooms: number;
  doubleRooms: number;
  twinRooms: number;
  tripleRooms: number;
  child2_5?: number;
  child2_5Sharing?: number;
  child2_5Bed?: number;
  child2_5OwnRoom?: number;
  child6_11?: number;
  child6_11Sharing?: number;
  child6_11Bed?: number;
  child6_11OwnRoom?: number;
  guide?: number;
  guideBasis?: string;
  arrivingFor: string;
  supplementary?: string[];
}

export interface VoucherPayload {
  id?: string;
  status?: VoucherStatus;
  voucherType: VoucherType;
  tourType: TourType;
  pageNumber: string;
  date: string;
  voucherTitle?: string;
  hotelId?: string;
  hotelName: string; // read-only on load, resolved from hotelId
  hotelEmail?: string; // read-only on load, resolved from hotelId
  marketId?: string;
  market?: string; // read-only on load, resolved from marketId
  customerId?: string;
  customerName: string; // read-only on load, resolved from customerId
  requisitionNo: string;
  tourNo: string;
  tourName: string;
  confirmedBy: string;
  rateApplicable: number;
  ratePeriod?: string;
  totalPax?: number;
  employeeName: string; // read-only, populated from employee_profiles via created_by
  employeeEmail: string; // read-only, populated from employee_profiles via created_by
  billingInstructions?: string;
  remarks?: string;
  lineItems: VoucherLineItem[];
  matchedHotelRateId?: string;
  rateApplicableText?: string;
  guideText?: string;
  surchargeText?: string;
  eventSupplementText?: string;
  rateStructure?: "detailed" | "grouped";
  manuallyEdited?: boolean;
}

export interface GeneratedDocument {
  id?: string;
  voucherId?: string;
  docxPath: string;
  pdfPath?: string;
  format?: DocumentFormat;
  createdAt?: string;
}

export interface VoucherDocumentRecord {
  id: string;
  voucherId: string;
  format: DocumentFormat;
  docxPath: string;
  pdfPath?: string;
  createdAt: string;
  requisitionNo: string;
  tourNo: string;
  tourName: string;
  hotelName: string;
  customerName: string;
  voucherDate: string;
}

export interface VoucherRecord {
  id: string;
  voucherType: VoucherType;
  tourType: TourType;
  status: VoucherStatus;
  voucherDate: string;
  requisitionNo: string;
  tourNo: string;
  tourName: string;
  hotelName: string;
  customerName: string;
  createdAt: string;
}

export interface VoucherRevisionRecord {
  id: string;
  voucherId: string;
  versionNumber: number;
  status: VoucherStatus;
  changedBy: string;
  snapshotSummary: string;
  createdAt: string;
}

export interface WorkspaceSearchResult {
  vouchers: VoucherRecord[];
  documents: VoucherDocumentRecord[];
}

export interface VoucherListFilters {
  status?: VoucherStatus | "all";
  dateFrom?: string;
  dateTo?: string;
  query?: string;
}

export interface AccountProfile {
  id?: string;
  employeeName: string;
  employeeEmail: string;
  role?: "employee" | "manager" | "admin";
  isActive?: boolean;
}

export interface AuthCredentials {
  email: string;
  password: string;
  employeeName?: string;
  rememberMe?: boolean;
}

export interface AuthState {
  isAuthenticated: boolean;
  profile: AccountProfile | null;
  message?: string;
}

/* ---------- Hotel rate master (NORMALIZED) types ---------- */

export type SectionStatus = "Empty" | "Completed" | "Skipped";

export type HotelRateRoomRate = {
  id?: string;
  from: string;
  to: string;
  room_category_id?: string;
  room_category: string; // read-only, populated by JOIN
  basis: string;
  sgl?: number | null;
  dbl?: number | null;
  twn?: number | null;
  tpl?: number | null;
};

export type HotelRateChildRate = {
  id?: string;
  from: string;
  to: string;
  room_category_id?: string;
  room_category: string; // read-only, populated by JOIN
  basis: string;
  age_2_5_99_sharing?: string | null;
  age_2_5_99_extra_bed?: string | null;
  age_2_5_99_own_room?: string | null;
  age_6_11_99_sharing?: string | null;
  age_6_11_99_extra_bed?: string | null;
  age_6_11_99_own_room?: string | null;
};

export type HotelRateSeasonalSurcharge = {
  id?: string;
  name: string;
  amount?: number | null;
  date_from?: string | null;
  date_to?: string | null;
  applies_to?: string | null;
};

export type HotelRateCompulsoryEvent = {
  id?: string;
  event_date: string;
  event_name: string;
  bb_rate?: number | null;
  hb_rate?: number | null;
  fb_rate?: number | null;
  per?: string | null;
  mandatory?: boolean | null;
};

export type HotelRateFocRules = {
  enabled: boolean;
  applies_to?: "Guide" | string | null;
  minimum_persons?: number | null;
  foc_quantity?: number | null;
  basis?: string | null;
  count_adults?: boolean | null;
  count_child_2_5_99?: boolean | null;
  count_child_6_11_99?: boolean | null;
  pax_custom_text?: string | null;
  guide_custom_text?: string | null;
};

export type HotelRateGuidePrice = {
  id?: string;
  basis: string;
  rate: number | null;
};

export type HotelRateGuideRates = Record<string, number | null>;

export type HotelRateRoomSupplement = {
  id?: string;
  room_category_id?: string;
  room_category: string; // read-only, populated by JOIN
  supplement_name: string;
  supplement_amount: number;
  per: string; // e.g. "per room per night"
};

export interface HotelRateRecord {
  id?: string;
  hotel_id?: string;
  hotel_name: string; // read-only, populated by JOIN
  market_id?: string;
  market: string; // read-only, populated by JOIN
  currency: string;
  contract_name: string;
  valid_from: string;
  valid_to: string;
  room_rates: HotelRateRoomRate[];
  child_rates?: HotelRateChildRate[];
  room_supplements?: HotelRateRoomSupplement[];
  seasonal_surcharges: HotelRateSeasonalSurcharge[];
  compulsory_events: HotelRateCompulsoryEvent[];
  foc_rules: HotelRateFocRules;
  billing_instruction: string;
  skipped_sections?: string[];
  guide_rates?: HotelRateGuideRates | null;
  guide_prices?: HotelRateGuidePrice[];
  created_at?: string;
  updated_at?: string;
  is_active?: boolean;
}

export type HotelRateRecordSummary = Pick<
  HotelRateRecord,
  | "id"
  | "hotel_name"
  | "market"
  | "contract_name"
  | "valid_from"
  | "valid_to"
  | "currency"
>;

export type AutoFillStatus = "matched" | "no-match" | "multiple";

export interface AutoFillResult {
  status: AutoFillStatus;
  warnings: string[];
  matchedHotelRateId?: string;
  rateApplicableText?: string;
  guideText?: string;
  surchargeText?: string;
  eventSupplementText?: string;
  billingInstructions?: string;
  candidateHotelRates?: HotelRateRecordSummary[];
}

export interface FolderTreeNode {
  name: string;
  path: string;
  type: "folder" | "file";
  children?: FolderTreeNode[];
}

export interface MigrationResult {
  moved: number;
  failed: number;
  errors: string[];
}

export interface AppSettings {
  toursFolderRoot?: string;
  exportDirectory?: string;
  theme?: "light" | "dark" | "system";
  activeTemplateName?: string;
}

export interface VoucherTemplateInfo {
  id?: string;
  name: string;
  created_at?: string;
  updated_at?: string;
}

export interface AppApi {
  signIn: (credentials: AuthCredentials) => Promise<AuthState>;
  signUp: (credentials: AuthCredentials) => Promise<AuthState>;
  resetPassword: (email: string) => Promise<{ message: string }>;
  signOut: () => Promise<AuthState>;
  getAuthState: () => Promise<AuthState>;
  updateProfile: (updates: {
    employeeName?: string;
    employeeEmail?: string;
  }) => Promise<AccountProfile>;
  saveVoucher: (
    voucher: VoucherPayload,
  ) => Promise<{ id: string; status: VoucherStatus }>;
  generateDocuments?: (voucher: VoucherPayload) => Promise<GeneratedDocument>;
  generateDocx: (
    voucher: VoucherPayload,
    customOutputDir?: string,
  ) => Promise<GeneratedDocument>;
  generatePdf: (
    voucher: VoucherPayload,
    customOutputDir?: string,
  ) => Promise<GeneratedDocument>;
  listVoucherDocuments: () => Promise<VoucherDocumentRecord[]>;
  listVouchers: (filters?: VoucherListFilters) => Promise<VoucherRecord[]>;
  getVoucher: (voucherId: string) => Promise<VoucherPayload>;
  listVoucherRevisions: (voucherId: string) => Promise<VoucherRevisionRecord[]>;
  updateVoucherStatus: (
    voucherId: string,
    status: VoucherStatus,
  ) => Promise<{ id: string; status: VoucherStatus }>;
  searchWorkspace: (query: string) => Promise<WorkspaceSearchResult>;
  openDocument: (filePath: string) => Promise<void>;
  getAccountProfile: () => Promise<AccountProfile>;
  getAppVersion: () => Promise<string>;
  onMenuNavigate: (callback: (view: string) => void) => () => void;
  onMenuSearchFocus: (callback: () => void) => () => void;
  onMenuSaveVoucher: (callback: () => void) => () => void;
  onMenuGeneratePdf: (callback: () => void) => () => void;
  onMenuGenerateDocx: (callback: () => void) => () => void;
  onMenuSignOut: (callback: () => void) => () => void;
  onMenuAccount: (callback: (action: string) => void) => () => void;
  onToursFolderChanged?: (callback: () => void) => () => void;
  saveHotelRates: (record: HotelRateRecord) => Promise<{ id: string }>;
  deleteHotelRate: (hotelRateId: string) => Promise<void>;
  listInactiveHotelRates: () => Promise<HotelRateRecord[]>;
  restoreHotelRate: (hotelRateId: string) => Promise<void>;
  listHotelRates: (hotelName?: string) => Promise<HotelRateRecordSummary[]>;
  getAllHotelRates: () => Promise<HotelRateRecord[]>;
  getHotelRates: (hotelRateId: string) => Promise<HotelRateRecord>;
  listHotelsFromRates: () => Promise<string[]>;
  listHotels: () => Promise<HotelRef[]>;
  saveHotel: (ref: {
    id?: string;
    name: string;
    email?: string;
    is_active?: boolean;
  }) => Promise<void>;
  deleteHotel: (id: string) => Promise<void>;
  openEmailClient: (options: {
    voucherId: string;
    pdfPath: string;
  }) => Promise<void>;
  listMarkets: () => Promise<MarketRef[]>;
  listRoomCategories: () => Promise<RoomCategoryRef[]>;
  listCustomers: () => Promise<CustomerRef[]>;
  listTourTypes: () => Promise<TourTypeRef[]>;
  saveTourType: (ref: { code: string; name: string }) => Promise<void>;
  deleteTourType: (id: string) => Promise<void>;
  listMealBasis: () => Promise<MealBasisRef[]>;
  saveMealBasis: (ref: { code: string; name: string }) => Promise<void>;
  deleteMealBasis: (id: string) => Promise<void>;
  saveMarket: (ref: { code: string; name: string }) => Promise<void>;
  deleteMarket: (id: string) => Promise<void>;
  saveCustomer: (ref: { name: string; is_active?: boolean }) => Promise<void>;
  deleteCustomer: (id: string) => Promise<void>;
  saveRoomCategory: (ref: { name: string }) => Promise<void>;
  deleteRoomCategory: (id: string) => Promise<void>;
  listCurrencies: () => Promise<CurrencyRef[]>;
  saveCurrency: (ref: { code: string; name: string }) => Promise<void>;
  deleteCurrency: (id: string) => Promise<void>;
  listInactiveReferences: (table: string) => Promise<Record<string, unknown>[]>;
  restoreReference: (table: string, id: string) => Promise<void>;
  autoFillVoucher: (
    voucher: VoucherPayload,
    contractId?: string,
  ) => Promise<AutoFillResult>;
  selectToursFolder: () => Promise<{ path: string } | null>;
  getToursFolder: () => Promise<string | null>;
  getToursFolderTree: () => Promise<FolderTreeNode[]>;
  revealInExplorer: (filePath: string) => Promise<void>;
  migrateVouchersToTours: () => Promise<MigrationResult>;
  minimizeWindow: () => void;
  maximizeWindow: () => void;
  closeWindow: () => void;
  navigateBack: () => void;
  navigateForward: () => void;
  getSettings: () => Promise<Record<string, unknown>>;
  saveSettings: (
    settings: Record<string, unknown>,
  ) => Promise<Record<string, unknown>>;
  selectFolder: (options: {
    title?: string;
    defaultPath?: string;
  }) => Promise<string | null>;
  selectFile: (options: {
    title?: string;
    defaultPath?: string;
    filters?: Array<{ name: string; extensions: string[] }>;
  }) => Promise<string | null>;
  listDatabaseTemplates: () => Promise<VoucherTemplateInfo[]>;
  uploadDatabaseTemplate: (
    name: string,
    docxPath: string,
    htmlPath: string,
  ) => Promise<void>;
  downloadDatabaseTemplate: (name: string) => Promise<boolean>;
  deleteDatabaseTemplate: (name: string) => Promise<void>;
  renderVoucherHtml: (voucher: VoucherPayload) => Promise<string>;
}
