export type VoucherType = "reservation" | "amendment" | "pptp";
export type TourType = "SL" | "ASL" | "WSL" | "FSS" | "CSL" | "DSL" | "SLH";
export type VoucherStatus = "draft" | "generated" | "sent";
export type DocumentFormat = "docx" | "pdf";

export interface VoucherLineItem {
  requiredDate: string;
  roomCategory: string;
  basis: string;
  singleRooms: number;
  doubleRooms: number;
  twinRooms: number;
  tripleRooms: number;
  guide?: number;
  guideBasis?: string;
  arrivingFor: string;
}

export interface VoucherPayload {
  id?: string;
  voucherType: VoucherType;
  tourType: TourType;
  pageNumber: string;
  date: string;
  voucherTitle?: string;
  hotelName: string;
  market?: string;
  requisitionNo: string;
  tourNo: string;
  tourName: string;
  customerName: string;
  confirmedBy: string;
  rateApplicable: number;
  ratePeriod?: string;
  totalPax?: number;
  employeeName: string;
  employeeEmail: string;
  billingInstructions?: string;
  remarks?: string;
  lineItems: VoucherLineItem[];
  matchedHotelRateId?: string;
  rateApplicableText?: string;
  guideText?: string;
  surchargeText?: string;
  eventSupplementText?: string;
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

/* ---------- Hotel rate master (one-table) types ---------- */

export type SectionStatus = "Empty" | "Completed" | "Skipped";

export type HotelRateRoomRate = {
  from: string;
  to: string;
  room_category: string;
  basis: string;
  sgl?: number | null;
  dbl?: number | null;
  twn?: number | null;
  tpl?: number | null;
};

export type HotelRateChildRate = {
  from: string;
  to: string;
  room_category: string;
  basis: string;
  age2_6?: number | null;
  age6_12?: number | null;
  extra_bed?: number | null;
  own_room?: number | null;
};



export type HotelRateSeasonalSurcharge = {
  name: string;
  amount?: number | null;
  date_from?: string | null;
  date_to?: string | null;
  applies_to?: string | null;
};

export type HotelRateCompulsoryEvent = {
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
};

export type HotelRateGuideRates = Record<string, number | null>;

export interface HotelRateRecord {
  id?: string;
  hotel_name: string;
  market: string;
  currency: string;
  contract_name: string;
  valid_from: string;
  valid_to: string;
  room_rates: HotelRateRoomRate[];
  child_rates?: HotelRateChildRate[];
  seasonal_surcharges: HotelRateSeasonalSurcharge[];
  compulsory_events: HotelRateCompulsoryEvent[];
  foc_rules: HotelRateFocRules;
  billing_instruction: string;
  skipped_sections?: string[];
  guide_rates?: HotelRateGuideRates | null;
  created_at?: string;
  updated_at?: string;
}

export type HotelRateRecordSummary = Pick<
  HotelRateRecord,
  "id" | "hotel_name" | "market" | "contract_name" | "valid_from" | "valid_to" | "currency"
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
  type: 'folder' | 'file';
  children?: FolderTreeNode[];
}

export interface MigrationResult {
  moved: number;
  failed: number;
  errors: string[];
}

export interface AppApi {
  signIn: (credentials: AuthCredentials) => Promise<AuthState>;
  signUp: (credentials: AuthCredentials) => Promise<AuthState>;
  resetPassword: (email: string) => Promise<{ message: string }>;
  signOut: () => Promise<AuthState>;
  getAuthState: () => Promise<AuthState>;
  updateProfile: (updates: { employeeName?: string; employeeEmail?: string }) => Promise<AccountProfile>;
  saveVoucher: (voucher: VoucherPayload) => Promise<{ id: string; status: VoucherStatus }>;
  generateDocuments?: (voucher: VoucherPayload) => Promise<GeneratedDocument>;
  generateDocx: (voucher: VoucherPayload) => Promise<GeneratedDocument>;
  generatePdf: (voucher: VoucherPayload) => Promise<GeneratedDocument>;
  listVoucherDocuments: () => Promise<VoucherDocumentRecord[]>;
  listVouchers: (filters?: VoucherListFilters) => Promise<VoucherRecord[]>;
  getVoucher: (voucherId: string) => Promise<VoucherPayload>;
  listVoucherRevisions: (voucherId: string) => Promise<VoucherRevisionRecord[]>;
  updateVoucherStatus: (voucherId: string, status: VoucherStatus) => Promise<{ id: string; status: VoucherStatus }>;
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
  saveHotelRates: (record: HotelRateRecord) => Promise<{ id: string }>;
  deleteHotelRate: (hotelRateId: string) => Promise<void>;
  listHotelRates: (hotelName?: string) => Promise<HotelRateRecordSummary[]>;
  getAllHotelRates: () => Promise<HotelRateRecord[]>;
  getHotelRates: (hotelRateId: string) => Promise<HotelRateRecord>;
  listHotelsFromRates: () => Promise<string[]>;
  autoFillVoucher: (voucher: VoucherPayload, contractId?: string) => Promise<AutoFillResult>;
  seedRateMaster: () => Promise<{ seeded: number; ids: string[] }>;
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
  getSettings: () => Promise<Record<string, any>>;
  saveSettings: (settings: Record<string, any>) => Promise<Record<string, any>>;
  selectFolder: (options: { title?: string; defaultPath?: string }) => Promise<string | null>;
}
