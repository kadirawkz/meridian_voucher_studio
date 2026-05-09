import type {
  DocumentFormat,
  GeneratedDocument,
  VoucherListFilters,
  VoucherDocumentRecord,
  VoucherPayload,
  VoucherRevisionRecord,
  VoucherRecord,
  VoucherStatus,
  WorkspaceSearchResult
} from "../../shared/types.js";
import { getAuthenticatedSupabaseClient, getCurrentEmployeeProfile, getCurrentUser } from "./auth.js";

type VoucherRow = {
  id?: string;
  voucher_type: string;
  tour_type: string;
  status: VoucherStatus;
  created_by: string;
  voucher_date: string;
  requisition_no: string;
  tour_no: string;
  tour_name: string;
  hotel_name: string;
  customer_name: string;
  payload: VoucherPayload;
};

type VoucherDocumentRow = {
  id?: string;
  voucher_id: string;
  created_by: string;
  format: DocumentFormat;
  docx_path: string;
  pdf_path: string | null;
};

type VoucherDocumentQueryRow = {
  id: string;
  voucher_id: string;
  format: DocumentFormat;
  docx_path: string;
  pdf_path: string | null;
  created_at: string;
  vouchers: Array<{
    requisition_no: string | null;
    tour_no: string | null;
    tour_name: string | null;
    hotel_name: string | null;
    customer_name: string | null;
    voucher_date: string | null;
  }> | null;
};

type VoucherRevisionRow = {
  id?: string;
  voucher_id: string;
  version_number: number;
  status: VoucherStatus;
  changed_by: string;
  payload: VoucherPayload;
};

type VoucherRevisionQueryRow = {
  id: string;
  voucher_id: string;
  version_number: number;
  status: VoucherStatus;
  changed_by: string;
  created_at: string;
};

type VoucherQueryRow = {
  id: string;
  voucher_type: VoucherRecord["voucherType"];
  tour_type: VoucherRecord["tourType"];
  status: VoucherStatus;
  voucher_date: string | null;
  requisition_no: string | null;
  tour_no: string | null;
  tour_name: string | null;
  hotel_name: string | null;
  customer_name: string | null;
  created_at: string;
};

async function requireCurrentUserId(message: string): Promise<string> {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error(message);
  }

  return user.id;
}

async function getActiveSupabaseClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;

  if (!url || !key) {
    return null;
  }

  const supabase = getAuthenticatedSupabaseClient();
  if (!supabase) {
    throw new Error("Supabase is not configured");
  }

  const user = await getCurrentUser();
  if (!user) {
    throw new Error("Please log in first.");
  }

  const employeeProfile = await getCurrentEmployeeProfile(user);
  if (!employeeProfile?.isActive) {
    throw new Error("Your employee account is inactive. Contact an administrator.");
  }

  return supabase;
}

async function getNextVoucherVersionNumber(supabase: NonNullable<Awaited<ReturnType<typeof getActiveSupabaseClient>>>, voucherId: string): Promise<number> {
  const { data, error } = await supabase
    .from("voucher_revisions")
    .select("version_number")
    .eq("voucher_id", voucherId)
    .order("version_number", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`Unable to determine voucher version: ${error.message}`);
  }

  return (data?.version_number ?? 0) + 1;
}

async function createVoucherRevision(
  supabase: NonNullable<Awaited<ReturnType<typeof getActiveSupabaseClient>>>,
  voucherId: string,
  changedBy: string,
  status: VoucherStatus,
  payload: VoucherPayload
): Promise<void> {
  const nextVersionNumber = await getNextVoucherVersionNumber(supabase, voucherId);
  const revision: VoucherRevisionRow = {
    voucher_id: voucherId,
    version_number: nextVersionNumber,
    status,
    changed_by: changedBy,
    payload
  };

  const { error } = await supabase.from("voucher_revisions").insert(revision);

  if (error) {
    throw new Error(`Unable to create voucher revision: ${error.message}`);
  }
}

export async function saveVoucher(voucher: VoucherPayload): Promise<{ id: string; status: VoucherStatus }> {
  const supabase = await getActiveSupabaseClient();
  if (!supabase) {
    return {
      id: voucher.id ?? crypto.randomUUID(),
      status: "draft"
    };
  }

  const userId = await requireCurrentUserId("Please log in before saving vouchers.");
  let nextStatus: VoucherStatus = "draft";

  if (voucher.id) {
    const { data: existingVoucher, error: existingVoucherError } = await supabase
      .from("vouchers")
      .select("status")
      .eq("id", voucher.id)
      .maybeSingle();

    if (existingVoucherError) {
      throw new Error(`Unable to save voucher: ${existingVoucherError.message}`);
    }

    nextStatus = existingVoucher?.status ?? "draft";
  }

  const row: VoucherRow = {
    id: voucher.id,
    voucher_type: voucher.voucherType,
    tour_type: voucher.tourType,
    status: nextStatus,
    created_by: userId,
    voucher_date: voucher.date,
    requisition_no: voucher.requisitionNo,
    tour_no: voucher.tourNo,
    tour_name: voucher.tourName,
    hotel_name: voucher.hotelName,
    customer_name: voucher.customerName,
    payload: voucher
  };

  const { data, error } = await supabase.from("vouchers").upsert(row).select("id,status").single();

  if (error) {
    throw new Error(`Unable to save voucher: ${error.message}`);
  }

  await createVoucherRevision(supabase, data.id, userId, data.status, { ...voucher, id: data.id });

  return { id: data.id, status: data.status };
}

export async function saveGeneratedDocumentRecord(
  voucherId: string,
  format: DocumentFormat,
  document: GeneratedDocument
): Promise<GeneratedDocument> {
  const supabase = await getActiveSupabaseClient();
  if (!supabase) {
    return {
      ...document,
      voucherId,
      format
    };
  }

  const userId = await requireCurrentUserId("Please log in before generating documents.");

  const row: VoucherDocumentRow = {
    voucher_id: voucherId,
    created_by: userId,
    format,
    docx_path: document.docxPath,
    pdf_path: document.pdfPath ?? null
  };

  const { data, error } = await supabase
    .from("voucher_documents")
    .insert(row)
    .select("id,created_at")
    .single();

  if (error) {
    throw new Error(`Unable to save generated document history: ${error.message}`);
  }

  const { error: voucherStatusError } = await supabase.from("vouchers").update({ status: "generated" }).eq("id", voucherId);

  if (voucherStatusError) {
    throw new Error(`Unable to update voucher status: ${voucherStatusError.message}`);
  }

  const { data: savedVoucher, error: savedVoucherError } = await supabase
    .from("vouchers")
    .select("payload,status")
    .eq("id", voucherId)
    .single();

  if (savedVoucherError) {
    throw new Error(`Unable to load saved voucher for revision history: ${savedVoucherError.message}`);
  }

  await createVoucherRevision(supabase, voucherId, userId, savedVoucher.status, {
    ...(savedVoucher.payload as VoucherPayload),
    id: voucherId
  });

  return {
    ...document,
    id: data.id,
    voucherId,
    format,
    createdAt: data.created_at
  };
}

export async function listVoucherDocuments(): Promise<VoucherDocumentRecord[]> {
  const supabase = await getActiveSupabaseClient();
  if (!supabase) {
    return [];
  }

  const { data, error } = await supabase
    .from("voucher_documents")
    .select(
      "id,voucher_id,format,docx_path,pdf_path,created_at,vouchers(requisition_no,tour_no,tour_name,hotel_name,customer_name,voucher_date)"
    )
    .order("created_at", { ascending: false })
    .limit(25);

  if (error) {
    throw new Error(`Unable to load document history: ${error.message}`);
  }

  return (data as VoucherDocumentQueryRow[]).map((row) => {
    const voucher = row.vouchers?.[0];

    return {
      id: row.id,
      voucherId: row.voucher_id,
      format: row.format,
      docxPath: row.docx_path,
      pdfPath: row.pdf_path ?? undefined,
      createdAt: row.created_at,
      requisitionNo: voucher?.requisition_no ?? "",
      tourNo: voucher?.tour_no ?? "",
      tourName: voucher?.tour_name ?? "",
      hotelName: voucher?.hotel_name ?? "",
      customerName: voucher?.customer_name ?? "",
      voucherDate: voucher?.voucher_date ?? ""
    };
  });
}

export async function listVouchers(filters: VoucherListFilters = {}): Promise<VoucherRecord[]> {
  const supabase = await getActiveSupabaseClient();
  if (!supabase) {
    return [];
  }

  let query = supabase
    .from("vouchers")
    .select("id,voucher_type,tour_type,status,voucher_date,requisition_no,tour_no,tour_name,hotel_name,customer_name,created_at")
    .order("voucher_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(50);

  if (filters.status && filters.status !== "all") {
    query = query.eq("status", filters.status);
  }

  if (filters.dateFrom) {
    query = query.gte("voucher_date", filters.dateFrom);
  }

  if (filters.dateTo) {
    query = query.lte("voucher_date", filters.dateTo);
  }

  const trimmedQuery = filters.query?.trim();
  if (trimmedQuery) {
    const escapedQuery = trimmedQuery.replace(/[%_,]/g, (character) => `\\${character}`);
    const ilikeQuery = `%${escapedQuery}%`;
    query = query.or(
      [
        `requisition_no.ilike.${ilikeQuery}`,
        `tour_no.ilike.${ilikeQuery}`,
        `tour_name.ilike.${ilikeQuery}`,
        `hotel_name.ilike.${ilikeQuery}`,
        `customer_name.ilike.${ilikeQuery}`
      ].join(",")
    );
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Unable to load vouchers: ${error.message}`);
  }

  return (data as VoucherQueryRow[]).map((row) => ({
    id: row.id,
    voucherType: row.voucher_type,
    tourType: row.tour_type,
    status: row.status,
    voucherDate: row.voucher_date ?? "",
    requisitionNo: row.requisition_no ?? "",
    tourNo: row.tour_no ?? "",
    tourName: row.tour_name ?? "",
    hotelName: row.hotel_name ?? "",
    customerName: row.customer_name ?? "",
    createdAt: row.created_at
  }));
}

export async function getVoucher(voucherId: string): Promise<VoucherPayload> {
  const supabase = await getActiveSupabaseClient();
  if (!supabase) {
    throw new Error("Supabase is not configured");
  }

  const { data, error } = await supabase.from("vouchers").select("payload").eq("id", voucherId).single();

  if (error) {
    throw new Error(`Unable to load voucher: ${error.message}`);
  }

  return data.payload as VoucherPayload;
}

export async function listVoucherRevisions(voucherId: string): Promise<VoucherRevisionRecord[]> {
  const supabase = await getActiveSupabaseClient();
  if (!supabase) {
    return [];
  }

  const { data, error } = await supabase
    .from("voucher_revisions")
    .select("id,voucher_id,version_number,status,changed_by,created_at")
    .eq("voucher_id", voucherId)
    .order("version_number", { ascending: false });

  if (error) {
    throw new Error(`Unable to load voucher revisions: ${error.message}`);
  }

  return (data as VoucherRevisionQueryRow[]).map((row) => ({
    id: row.id,
    voucherId: row.voucher_id,
    versionNumber: row.version_number,
    status: row.status,
    changedBy: row.changed_by,
    createdAt: row.created_at
  }));
}

export async function updateVoucherStatus(voucherId: string, status: VoucherStatus): Promise<{ id: string; status: VoucherStatus }> {
  const supabase = await getActiveSupabaseClient();
  if (!supabase) {
    return { id: voucherId, status };
  }

  const userId = await requireCurrentUserId("Please log in before updating voucher status.");
  const { data, error } = await supabase.from("vouchers").update({ status }).eq("id", voucherId).select("id,status").single();

  if (error) {
    throw new Error(`Unable to update voucher status: ${error.message}`);
  }

  const { data: savedVoucher, error: savedVoucherError } = await supabase
    .from("vouchers")
    .select("payload,status")
    .eq("id", voucherId)
    .single();

  if (savedVoucherError) {
    throw new Error(`Unable to load saved voucher for revision history: ${savedVoucherError.message}`);
  }

  await createVoucherRevision(supabase, voucherId, userId, savedVoucher.status, {
    ...(savedVoucher.payload as VoucherPayload),
    id: voucherId
  });

  return { id: data.id, status: data.status };
}

export async function searchWorkspace(query: string): Promise<WorkspaceSearchResult> {
  const supabase = await getActiveSupabaseClient();
  if (!supabase) {
    return { vouchers: [], documents: [] };
  }

  const trimmedQuery = query.trim();
  if (!trimmedQuery) {
    return { vouchers: [], documents: [] };
  }

  const escapedQuery = trimmedQuery.replace(/[%_,]/g, (character) => `\\${character}`);
  const ilikeQuery = `%${escapedQuery}%`;
  const voucherSearch = [
    `requisition_no.ilike.${ilikeQuery}`,
    `tour_no.ilike.${ilikeQuery}`,
    `tour_name.ilike.${ilikeQuery}`,
    `hotel_name.ilike.${ilikeQuery}`,
    `customer_name.ilike.${ilikeQuery}`
  ].join(",");

  const [voucherResponse, documentResponse] = await Promise.all([
    supabase
      .from("vouchers")
      .select("id,voucher_type,tour_type,status,voucher_date,requisition_no,tour_no,tour_name,hotel_name,customer_name,created_at")
      .or(voucherSearch)
      .order("created_at", { ascending: false })
      .limit(12),
    supabase
      .from("voucher_documents")
      .select(
        "id,voucher_id,format,docx_path,pdf_path,created_at,vouchers!inner(requisition_no,tour_no,tour_name,hotel_name,customer_name,voucher_date)"
      )
      .or(voucherSearch, { foreignTable: "vouchers" })
      .order("created_at", { ascending: false })
      .limit(12)
  ]);

  if (voucherResponse.error) {
    throw new Error(`Unable to search vouchers: ${voucherResponse.error.message}`);
  }

  if (documentResponse.error) {
    throw new Error(`Unable to search generated files: ${documentResponse.error.message}`);
  }

  const vouchers = (voucherResponse.data as VoucherQueryRow[]).map((row) => ({
    id: row.id,
    voucherType: row.voucher_type,
    tourType: row.tour_type,
    status: row.status,
    voucherDate: row.voucher_date ?? "",
    requisitionNo: row.requisition_no ?? "",
    tourNo: row.tour_no ?? "",
    tourName: row.tour_name ?? "",
    hotelName: row.hotel_name ?? "",
    customerName: row.customer_name ?? "",
    createdAt: row.created_at
  }));

  const documents = (documentResponse.data as VoucherDocumentQueryRow[]).map((row) => {
    const voucher = row.vouchers?.[0];

    return {
      id: row.id,
      voucherId: row.voucher_id,
      format: row.format,
      docxPath: row.docx_path,
      pdfPath: row.pdf_path ?? undefined,
      createdAt: row.created_at,
      requisitionNo: voucher?.requisition_no ?? "",
      tourNo: voucher?.tour_no ?? "",
      tourName: voucher?.tour_name ?? "",
      hotelName: voucher?.hotel_name ?? "",
      customerName: voucher?.customer_name ?? "",
      voucherDate: voucher?.voucher_date ?? ""
    };
  });

  return { vouchers, documents };
}
