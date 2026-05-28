import type {
  DocumentFormat,
  GeneratedDocument,
  VoucherListFilters,
  VoucherDocumentRecord,
  VoucherPayload,
  VoucherRevisionRecord,
  VoucherRecord,
  VoucherStatus,
  WorkspaceSearchResult,
} from "../../shared/types.js";
import {
  getAuthenticatedSupabaseClient,
  getCurrentEmployeeProfile,
  getCurrentUser,
} from "./auth.js";

/* ---------- Helpers ---------- */

async function requireCurrentUserId(message: string): Promise<string> {
  const user = await getCurrentUser();
  if (!user) throw new Error(message);
  return user.id;
}

export async function getActiveSupabaseClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;
  if (!url || !key) return null;

  const supabase = getAuthenticatedSupabaseClient();
  if (!supabase) throw new Error("Supabase is not configured");

  const user = await getCurrentUser();
  if (!user) throw new Error("Please log in first.");

  const employeeProfile = await getCurrentEmployeeProfile(user);
  if (!employeeProfile?.isActive)
    throw new Error(
      "Your employee account is inactive. Contact an administrator.",
    );

  return supabase;
}

/* ---------- FK Resolution Helpers ---------- */

async function resolveHotelId(
  supabase: NonNullable<Awaited<ReturnType<typeof getActiveSupabaseClient>>>,
  name: string,
): Promise<string | null> {
  if (!name?.trim()) return null;
  const { data } = await supabase
    .from("hotels")
    .upsert({ name: name.trim(), is_active: true }, { onConflict: "name" })
    .select("id")
    .single();
  return (data?.id as string) ?? null;
}

async function resolveMarketId(
  supabase: NonNullable<Awaited<ReturnType<typeof getActiveSupabaseClient>>>,
  code: string,
): Promise<string | null> {
  if (!code?.trim()) return null;
  const { data } = await supabase
    .from("markets")
    .select("id")
    .eq("code", code.trim())
    .maybeSingle();
  return (data?.id as string) ?? null;
}

async function resolveCustomerId(
  supabase: NonNullable<Awaited<ReturnType<typeof getActiveSupabaseClient>>>,
  name: string,
): Promise<string | null> {
  if (!name?.trim()) return null;
  const { data } = await supabase
    .from("customers")
    .upsert({ name: name.trim(), is_active: true }, { onConflict: "name" })
    .select("id")
    .single();
  return (data?.id as string) ?? null;
}

async function resolveRoomCategoryId(
  supabase: NonNullable<Awaited<ReturnType<typeof getActiveSupabaseClient>>>,
  name: string,
): Promise<string | null> {
  if (!name?.trim()) return null;
  const { data } = await supabase
    .from("room_categories")
    .upsert({ name: name.trim() }, { onConflict: "name" })
    .select("id")
    .single();
  return (data?.id as string) ?? null;
}

/* ---------- Revision Helpers ---------- */

async function getNextVoucherVersionNumber(
  supabase: NonNullable<Awaited<ReturnType<typeof getActiveSupabaseClient>>>,
  voucherId: string,
): Promise<number> {
  const { data, error } = await supabase
    .from("voucher_revisions")
    .select("version_number")
    .eq("voucher_id", voucherId)
    .order("version_number", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error)
    throw new Error(`Unable to determine voucher version: ${error.message}`);
  return (data?.version_number ?? 0) + 1;
}

function buildSnapshotSummary(voucher: VoucherPayload): string {
  const parts: string[] = [];
  if (voucher.hotelName) parts.push(voucher.hotelName);
  if (voucher.customerName) parts.push(voucher.customerName);
  if (voucher.requisitionNo) parts.push(voucher.requisitionNo);
  parts.push(`${voucher.lineItems.length} line items`);
  return parts.join(" · ");
}

async function createVoucherRevision(
  supabase: NonNullable<Awaited<ReturnType<typeof getActiveSupabaseClient>>>,
  voucherId: string,
  changedBy: string,
  status: VoucherStatus,
  voucher: VoucherPayload,
): Promise<void> {
  const nextVersionNumber = await getNextVoucherVersionNumber(
    supabase,
    voucherId,
  );
  const { error } = await supabase.from("voucher_revisions").insert({
    voucher_id: voucherId,
    version_number: nextVersionNumber,
    status,
    changed_by: changedBy,
    changed_fields: {},
    snapshot_summary: buildSnapshotSummary(voucher),
  });
  if (error)
    throw new Error(`Unable to create voucher revision: ${error.message}`);
}

/* ---------- Voucher CRUD ---------- */

function isVoucherEqual(v1: VoucherPayload, v2: VoucherPayload): boolean {
  const normalizeStr = (s: string | undefined | null) => s?.trim() || "";
  const normalizeNum = (n: number | undefined | null) => n || 0;
  const normalizeBool = (b: boolean | undefined | null) => !!b;

  if (normalizeStr(v1.voucherType) !== normalizeStr(v2.voucherType))
    return false;
  if (normalizeStr(v1.tourType) !== normalizeStr(v2.tourType)) return false;
  if (normalizeStr(v1.pageNumber) !== normalizeStr(v2.pageNumber)) return false;
  if (normalizeStr(v1.date) !== normalizeStr(v2.date)) return false;
  if (normalizeStr(v1.voucherTitle) !== normalizeStr(v2.voucherTitle))
    return false;
  if (normalizeStr(v1.hotelName) !== normalizeStr(v2.hotelName)) return false;
  if (normalizeStr(v1.market) !== normalizeStr(v2.market)) return false;
  if (normalizeStr(v1.customerName) !== normalizeStr(v2.customerName))
    return false;
  if (normalizeStr(v1.requisitionNo) !== normalizeStr(v2.requisitionNo))
    return false;
  if (normalizeStr(v1.tourNo) !== normalizeStr(v2.tourNo)) return false;
  if (normalizeStr(v1.tourName) !== normalizeStr(v2.tourName)) return false;
  if (normalizeStr(v1.confirmedBy) !== normalizeStr(v2.confirmedBy))
    return false;
  if (normalizeNum(v1.rateApplicable) !== normalizeNum(v2.rateApplicable))
    return false;
  if (normalizeStr(v1.ratePeriod) !== normalizeStr(v2.ratePeriod)) return false;
  if (
    normalizeStr(v1.billingInstructions) !==
    normalizeStr(v2.billingInstructions)
  )
    return false;
  if (normalizeStr(v1.remarks) !== normalizeStr(v2.remarks)) return false;
  if (normalizeBool(v1.manuallyEdited) !== normalizeBool(v2.manuallyEdited))
    return false;
  if (
    normalizeStr(v1.rateApplicableText) !== normalizeStr(v2.rateApplicableText)
  )
    return false;
  if (normalizeStr(v1.guideText) !== normalizeStr(v2.guideText)) return false;
  if (normalizeStr(v1.surchargeText) !== normalizeStr(v2.surchargeText))
    return false;
  if (
    normalizeStr(v1.eventSupplementText) !==
    normalizeStr(v2.eventSupplementText)
  )
    return false;

  const items1 = v1.lineItems || [];
  const items2 = v2.lineItems || [];
  if (items1.length !== items2.length) return false;

  for (let i = 0; i < items1.length; i++) {
    const li1 = items1[i];
    const li2 = items2[i];
    if (normalizeStr(li1.requiredDate) !== normalizeStr(li2.requiredDate))
      return false;
    if (normalizeStr(li1.roomCategory) !== normalizeStr(li2.roomCategory))
      return false;
    if (normalizeStr(li1.basis) !== normalizeStr(li2.basis)) return false;
    if (normalizeNum(li1.singleRooms) !== normalizeNum(li2.singleRooms))
      return false;
    if (normalizeNum(li1.doubleRooms) !== normalizeNum(li2.doubleRooms))
      return false;
    if (normalizeNum(li1.twinRooms) !== normalizeNum(li2.twinRooms))
      return false;
    if (normalizeNum(li1.tripleRooms) !== normalizeNum(li2.tripleRooms))
      return false;
    if (normalizeNum(li1.child2_5) !== normalizeNum(li2.child2_5)) return false;
    if (normalizeNum(li1.child6_11) !== normalizeNum(li2.child6_11))
      return false;
    if (normalizeNum(li1.child2_5Sharing) !== normalizeNum(li2.child2_5Sharing))
      return false;
    if (normalizeNum(li1.child2_5Bed) !== normalizeNum(li2.child2_5Bed))
      return false;
    if (normalizeNum(li1.child2_5OwnRoom) !== normalizeNum(li2.child2_5OwnRoom))
      return false;
    if (
      normalizeNum(li1.child6_11Sharing) !== normalizeNum(li2.child6_11Sharing)
    )
      return false;
    if (normalizeNum(li1.child6_11Bed) !== normalizeNum(li2.child6_11Bed))
      return false;
    if (
      normalizeNum(li1.child6_11OwnRoom) !== normalizeNum(li2.child6_11OwnRoom)
    )
      return false;
    if (normalizeNum(li1.guide) !== normalizeNum(li2.guide)) return false;
    if (normalizeStr(li1.guideBasis) !== normalizeStr(li2.guideBasis))
      return false;
    if (normalizeStr(li1.arrivingFor) !== normalizeStr(li2.arrivingFor))
      return false;

    const sup1 = li1.supplementary || [];
    const sup2 = li2.supplementary || [];
    if (sup1.length !== sup2.length) return false;
    const sorted1 = [...sup1].sort();
    const sorted2 = [...sup2].sort();
    for (let j = 0; j < sorted1.length; j++) {
      if (normalizeStr(sorted1[j]) !== normalizeStr(sorted2[j])) return false;
    }
  }

  return true;
}

export async function saveVoucher(
  voucher: VoucherPayload,
  statusOverride?: VoucherStatus,
): Promise<{ id: string; status: VoucherStatus }> {
  const supabase = await getActiveSupabaseClient();
  if (!supabase)
    return {
      id: voucher.id ?? crypto.randomUUID(),
      status: statusOverride || "draft",
    };

  const userId = await requireCurrentUserId(
    "Please log in before saving vouchers.",
  );

  // Default to "draft" for manual saves, which resets "generated" vouchers to "draft" when edited & saved
  const nextStatus: VoucherStatus = statusOverride || "draft";

  // Check if voucher already exists, and return early if no actual changes are made
  if (voucher.id) {
    try {
      const { data: ev } = await supabase
        .from("vouchers")
        .select("status")
        .eq("id", voucher.id)
        .maybeSingle();
      if (ev) {
        const existing = await getVoucher(voucher.id);
        if (ev.status === nextStatus && isVoucherEqual(voucher, existing)) {
          return { id: voucher.id, status: ev.status as VoucherStatus };
        }
      }
    } catch {
      // If error or doesn't exist, proceed with standard upsert
    }
  }

  // Resolve FK IDs from names
  const hotelId =
    voucher.hotelId || (await resolveHotelId(supabase, voucher.hotelName));
  const marketId =
    voucher.marketId || (await resolveMarketId(supabase, voucher.market || ""));
  const customerId =
    voucher.customerId ||
    (await resolveCustomerId(supabase, voucher.customerName));

  // Build room category map for line items
  const catNames = [
    ...new Set(voucher.lineItems.map((li) => li.roomCategory).filter(Boolean)),
  ];
  const catMap = new Map<string, string>();
  for (const name of catNames) {
    const id = await resolveRoomCategoryId(supabase, name);
    if (id) catMap.set(name, id);
  }

  const row = {
    id: voucher.id,
    voucher_type: voucher.voucherType,
    tour_type: voucher.tourType,
    status: nextStatus,
    created_by: userId,
    voucher_date: voucher.date,
    page_number: voucher.pageNumber || "1",
    voucher_title: voucher.voucherTitle || "",
    requisition_no: voucher.requisitionNo,
    tour_no: voucher.tourNo,
    tour_name: voucher.tourName,
    hotel_id: hotelId,
    market_id: marketId,
    customer_id: customerId,
    rate_period: voucher.ratePeriod || "",
    confirmed_by: voucher.confirmedBy || "",
    rate_applicable: voucher.rateApplicable || 0,
    billing_instructions: voucher.billingInstructions || "",
    remarks: voucher.remarks || "",
    matched_hotel_rate_id: voucher.matchedHotelRateId || null,
    rate_applicable_text: voucher.rateApplicableText || "",
    guide_text: voucher.guideText || "",
    surcharge_text: voucher.surchargeText || "",
    event_supplement_text: voucher.eventSupplementText || "",
    manually_edited: voucher.manuallyEdited || false,
  };

  const { data, error } = await supabase
    .from("vouchers")
    .upsert(row)
    .select("id,status")
    .single();
  if (error) throw new Error(`Unable to save voucher: ${error.message}`);

  const voucherId = data.id;

  // Replace line items
  await supabase
    .from("voucher_line_items")
    .delete()
    .eq("voucher_id", voucherId);

  if (voucher.lineItems?.length) {
    const lineItemRows = voucher.lineItems.map((li, index) => ({
      voucher_id: voucherId,
      line_order: index + 1,
      required_date: li.requiredDate || null,
      room_category_id:
        li.roomCategoryId || catMap.get(li.roomCategory) || null,
      basis: li.basis || "",
      single_rooms: li.singleRooms || 0,
      double_rooms: li.doubleRooms || 0,
      twin_rooms: li.twinRooms || 0,
      triple_rooms: li.tripleRooms || 0,
      child_2_5_99: li.child2_5 || 0,
      child_6_11_99: li.child6_11 || 0,
      child_2_5_99_sharing: li.child2_5Sharing || 0,
      child_2_5_99_bed: li.child2_5Bed || 0,
      child_2_5_99_own_room: li.child2_5OwnRoom || 0,
      child_6_11_99_sharing: li.child6_11Sharing || 0,
      child_6_11_99_bed: li.child6_11Bed || 0,
      child_6_11_99_own_room: li.child6_11OwnRoom || 0,
      supplementary: li.supplementary || [],
      guide_count: li.guide || 0,
      guide_basis: li.guideBasis || "",
      arriving_for: li.arrivingFor || "",
    }));

    const { error: liErr } = await supabase
      .from("voucher_line_items")
      .insert(lineItemRows);
    if (liErr)
      throw new Error(`Unable to save voucher line items: ${liErr.message}`);
  }

  await createVoucherRevision(supabase, voucherId, userId, data.status, {
    ...voucher,
    id: voucherId,
  });
  return { id: voucherId, status: data.status };
}

export async function saveGeneratedDocumentRecord(
  voucherId: string,
  format: DocumentFormat,
  document: GeneratedDocument,
): Promise<GeneratedDocument> {
  const supabase = await getActiveSupabaseClient();
  if (!supabase) return { ...document, voucherId, format };

  const userId = await requireCurrentUserId(
    "Please log in before generating documents.",
  );

  const { data, error } = await supabase
    .from("voucher_documents")
    .insert({
      voucher_id: voucherId,
      created_by: userId,
      format,
      docx_path: document.docxPath,
      pdf_path: document.pdfPath ?? null,
    })
    .select("id,created_at")
    .single();
  if (error)
    throw new Error(
      `Unable to save generated document history: ${error.message}`,
    );

  return {
    ...document,
    id: data.id,
    voucherId,
    format,
    createdAt: data.created_at,
  };
}

export async function listVoucherDocuments(): Promise<VoucherDocumentRecord[]> {
  const supabase = await getActiveSupabaseClient();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("voucher_documents")
    .select(
      "id,voucher_id,format,docx_path,pdf_path,created_at,vouchers(requisition_no,tour_no,tour_name,voucher_date,hotels(name),customers(name))",
    )
    .order("created_at", { ascending: false })
    .limit(25);
  if (error)
    throw new Error(`Unable to load document history: ${error.message}`);

  return (data as Array<Record<string, unknown>>).map((row) => {
    const v = row.vouchers as Record<string, unknown> | null;
    return {
      id: row.id as string,
      voucherId: row.voucher_id as string,
      format: row.format as DocumentFormat,
      docxPath: row.docx_path as string,
      pdfPath: (row.pdf_path ?? undefined) as string | undefined,
      createdAt: row.created_at as string,
      requisitionNo: (v?.requisition_no ?? "") as string,
      tourNo: (v?.tour_no ?? "") as string,
      tourName: (v?.tour_name ?? "") as string,
      hotelName: ((v?.hotels as Record<string, unknown> | null)?.name ??
        "") as string,
      customerName: ((v?.customers as Record<string, unknown> | null)?.name ??
        "") as string,
      voucherDate: (v?.voucher_date ?? "") as string,
    };
  });
}

export async function listVouchers(
  filters: VoucherListFilters = {},
): Promise<VoucherRecord[]> {
  const supabase = await getActiveSupabaseClient();
  if (!supabase) return [];

  let query = supabase
    .from("vouchers")
    .select(
      "id,voucher_type,tour_type,status,voucher_date,requisition_no,tour_no,tour_name,created_at,hotels(name),customers(name)",
    )
    .order("voucher_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(50);

  if (filters.status && filters.status !== "all")
    query = query.eq("status", filters.status);
  if (filters.dateFrom) query = query.gte("voucher_date", filters.dateFrom);
  if (filters.dateTo) query = query.lte("voucher_date", filters.dateTo);

  const trimmedQuery = filters.query?.trim();
  if (trimmedQuery) {
    const esc = trimmedQuery.replace(/[%_,]/g, (c) => `\\${c}`);
    const like = `%${esc}%`;
    // Search by text fields on vouchers + lookup hotel/customer IDs
    const [hotelRes, custRes] = await Promise.all([
      supabase.from("hotels").select("id").ilike("name", like),
      supabase.from("customers").select("id").ilike("name", like),
    ]);
    const hotelIds = (hotelRes.data ?? []).map(
      (h: Record<string, unknown>) => h.id as string,
    );
    const custIds = (custRes.data ?? []).map(
      (c: Record<string, unknown>) => c.id as string,
    );

    const orParts = [
      `requisition_no.ilike.${like}`,
      `tour_no.ilike.${like}`,
      `tour_name.ilike.${like}`,
    ];
    if (hotelIds.length > 0)
      orParts.push(`hotel_id.in.(${hotelIds.join(",")})`);
    if (custIds.length > 0)
      orParts.push(`customer_id.in.(${custIds.join(",")})`);
    query = query.or(orParts.join(","));
  }

  const { data, error } = await query;
  if (error) throw new Error(`Unable to load vouchers: ${error.message}`);

  return (data as Array<Record<string, unknown>>).map((row) => ({
    id: row.id as string,
    voucherType: row.voucher_type as VoucherRecord["voucherType"],
    tourType: row.tour_type as VoucherRecord["tourType"],
    status: row.status as VoucherStatus,
    voucherDate: (row.voucher_date ?? "") as string,
    requisitionNo: (row.requisition_no ?? "") as string,
    tourNo: (row.tour_no ?? "") as string,
    tourName: (row.tour_name ?? "") as string,
    hotelName: ((row.hotels as Record<string, unknown> | null)?.name ??
      "") as string,
    customerName: ((row.customers as Record<string, unknown> | null)?.name ??
      "") as string,
    createdAt: row.created_at as string,
  }));
}

/**
 * Load a full voucher by assembling from vouchers + line_items + JOINed references.
 */
export async function getVoucher(voucherId: string): Promise<VoucherPayload> {
  const supabase = await getActiveSupabaseClient();
  if (!supabase) throw new Error("Supabase is not configured");

  const { data: row, error } = await supabase
    .from("vouchers")
    .select("*, hotels(name), markets(code), customers(name)")
    .eq("id", voucherId)
    .single();
  if (error) throw new Error(`Unable to load voucher: ${error.message}`);

  const { data: profile } = await supabase
    .from("employee_profiles")
    .select("employee_name, email")
    .eq("id", row.created_by)
    .maybeSingle();

  const { data: lineItemRows, error: liErr } = await supabase
    .from("voucher_line_items")
    .select("*, room_categories(name)")
    .eq("voucher_id", voucherId)
    .order("line_order");
  if (liErr)
    throw new Error(`Unable to load voucher line items: ${liErr.message}`);

  const v = row as Record<string, unknown>;
  const empProfile = profile as Record<string, unknown> | null;

  return {
    id: v.id as string,
    voucherType: v.voucher_type as VoucherPayload["voucherType"],
    tourType: v.tour_type as VoucherPayload["tourType"],
    pageNumber: (v.page_number ?? "1") as string,
    date: (v.voucher_date ?? "") as string,
    voucherTitle: (v.voucher_title ?? "") as string,
    hotelId: (v.hotel_id ?? undefined) as string | undefined,
    hotelName: ((v.hotels as Record<string, unknown> | null)?.name ??
      "") as string,
    marketId: (v.market_id ?? undefined) as string | undefined,
    market: ((v.markets as Record<string, unknown> | null)?.code ??
      "") as string,
    customerId: (v.customer_id ?? undefined) as string | undefined,
    customerName: ((v.customers as Record<string, unknown> | null)?.name ??
      "") as string,
    requisitionNo: (v.requisition_no ?? "") as string,
    tourNo: (v.tour_no ?? "") as string,
    tourName: (v.tour_name ?? "") as string,
    confirmedBy: (v.confirmed_by ?? "") as string,
    rateApplicable: (v.rate_applicable ?? 0) as number,
    ratePeriod: (v.rate_period ?? "") as string,
    employeeName: (empProfile?.employee_name ?? "") as string,
    employeeEmail: (empProfile?.email ?? "") as string,
    billingInstructions: (v.billing_instructions ?? "") as string,
    remarks: (v.remarks ?? "") as string,
    matchedHotelRateId: (v.matched_hotel_rate_id ?? undefined) as
      | string
      | undefined,
    rateApplicableText: (v.rate_applicable_text ?? "") as string,
    guideText: (v.guide_text ?? "") as string,
    surchargeText: (v.surcharge_text ?? "") as string,
    eventSupplementText: (v.event_supplement_text ?? "") as string,
    manuallyEdited: Boolean(v.manually_edited ?? false),
    lineItems: ((lineItemRows ?? []) as Array<Record<string, unknown>>).map(
      (li) => ({
        requiredDate: (li.required_date ?? "") as string,
        roomCategoryId: (li.room_category_id ?? undefined) as
          | string
          | undefined,
        roomCategory: ((li.room_categories as Record<string, unknown> | null)
          ?.name ?? "") as string,
        basis: (li.basis ?? "") as string,
        singleRooms: (li.single_rooms ?? 0) as number,
        doubleRooms: (li.double_rooms ?? 0) as number,
        twinRooms: (li.twin_rooms ?? 0) as number,
        tripleRooms: (li.triple_rooms ?? 0) as number,
        child2_5: (li.child_2_5_99 ?? 0) as number,
        child6_11: (li.child_6_11_99 ?? 0) as number,
        child2_5Sharing: (li.child_2_5_99_sharing ?? 0) as number,
        child2_5Bed: (li.child_2_5_99_bed ?? 0) as number,
        child2_5OwnRoom: (li.child_2_5_99_own_room ?? 0) as number,
        child6_11Sharing: (li.child_6_11_99_sharing ?? 0) as number,
        child6_11Bed: (li.child_6_11_99_bed ?? 0) as number,
        child6_11OwnRoom: (li.child_6_11_99_own_room ?? 0) as number,
        supplementary: (li.supplementary ?? []) as string[],
        guide: (li.guide_count ?? 0) as number,
        guideBasis: (li.guide_basis ?? "") as string,
        arrivingFor: (li.arriving_for ?? "") as string,
      }),
    ),
  };
}

export async function listVoucherRevisions(
  voucherId: string,
): Promise<VoucherRevisionRecord[]> {
  const supabase = await getActiveSupabaseClient();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("voucher_revisions")
    .select(
      "id,voucher_id,version_number,status,changed_by,snapshot_summary,created_at",
    )
    .eq("voucher_id", voucherId)
    .order("version_number", { ascending: false });
  if (error)
    throw new Error(`Unable to load voucher revisions: ${error.message}`);

  // Fetch unique changed_by IDs from revisions to map names
  const uids = Array.from(
    new Set((data ?? []).map((r) => r.changed_by).filter(Boolean)),
  );
  const profilesMap = new Map<string, string>();
  if (uids.length > 0) {
    const { data: profiles } = await supabase
      .from("employee_profiles")
      .select("id, employee_name")
      .in("id", uids);
    for (const p of profiles ?? []) {
      profilesMap.set(p.id, p.employee_name);
    }
  }

  return (data as Array<Record<string, unknown>>).map((row) => ({
    id: row.id as string,
    voucherId: row.voucher_id as string,
    versionNumber: row.version_number as number,
    status: row.status as VoucherStatus,
    changedBy:
      profilesMap.get(row.changed_by as string) || (row.changed_by as string),
    snapshotSummary: row.snapshot_summary as string,
    createdAt: row.created_at as string,
  }));
}

export async function updateVoucherStatus(
  voucherId: string,
  status: VoucherStatus,
): Promise<{ id: string; status: VoucherStatus }> {
  const supabase = await getActiveSupabaseClient();
  if (!supabase) return { id: voucherId, status };

  const userId = await requireCurrentUserId(
    "Please log in before updating voucher status.",
  );
  const { data, error } = await supabase
    .from("vouchers")
    .update({ status })
    .eq("id", voucherId)
    .select("id,status")
    .single();
  if (error)
    throw new Error(`Unable to update voucher status: ${error.message}`);

  const fullVoucher = await getVoucher(voucherId);
  await createVoucherRevision(
    supabase,
    voucherId,
    userId,
    data.status,
    fullVoucher,
  );
  return { id: data.id, status: data.status };
}

export async function searchWorkspace(
  query: string,
): Promise<WorkspaceSearchResult> {
  const supabase = await getActiveSupabaseClient();
  if (!supabase) return { vouchers: [], documents: [] };

  const trimmedQuery = query.trim();
  if (!trimmedQuery) return { vouchers: [], documents: [] };

  const esc = trimmedQuery.replace(/[%_,]/g, (c) => `\\${c}`);
  const like = `%${esc}%`;

  // Resolve hotel/customer IDs matching search
  const [hotelRes, custRes] = await Promise.all([
    supabase.from("hotels").select("id").ilike("name", like),
    supabase.from("customers").select("id").ilike("name", like),
  ]);
  const hotelIds = (hotelRes.data ?? []).map(
    (h: Record<string, unknown>) => h.id as string,
  );
  const custIds = (custRes.data ?? []).map(
    (c: Record<string, unknown>) => c.id as string,
  );

  const orParts = [
    `requisition_no.ilike.${like}`,
    `tour_no.ilike.${like}`,
    `tour_name.ilike.${like}`,
  ];
  if (hotelIds.length > 0) orParts.push(`hotel_id.in.(${hotelIds.join(",")})`);
  if (custIds.length > 0) orParts.push(`customer_id.in.(${custIds.join(",")})`);
  const orStr = orParts.join(",");

  const [voucherResponse, documentResponse] = await Promise.all([
    supabase
      .from("vouchers")
      .select(
        "id,voucher_type,tour_type,status,voucher_date,requisition_no,tour_no,tour_name,created_at,hotels(name),customers(name)",
      )
      .or(orStr)
      .order("created_at", { ascending: false })
      .limit(12),
    supabase
      .from("voucher_documents")
      .select(
        "id,voucher_id,format,docx_path,pdf_path,created_at,vouchers!inner(requisition_no,tour_no,tour_name,voucher_date,hotels(name),customers(name))",
      )
      .order("created_at", { ascending: false })
      .limit(12),
  ]);

  if (voucherResponse.error)
    throw new Error(
      `Unable to search vouchers: ${voucherResponse.error.message}`,
    );
  if (documentResponse.error)
    throw new Error(
      `Unable to search generated files: ${documentResponse.error.message}`,
    );

  const vouchers = (voucherResponse.data as Array<Record<string, unknown>>).map(
    (row) => ({
      id: row.id as string,
      voucherType: row.voucher_type as VoucherRecord["voucherType"],
      tourType: row.tour_type as VoucherRecord["tourType"],
      status: row.status as VoucherStatus,
      voucherDate: (row.voucher_date ?? "") as string,
      requisitionNo: (row.requisition_no ?? "") as string,
      tourNo: (row.tour_no ?? "") as string,
      tourName: (row.tour_name ?? "") as string,
      hotelName: ((row.hotels as Record<string, unknown> | null)?.name ??
        "") as string,
      customerName: ((row.customers as Record<string, unknown> | null)?.name ??
        "") as string,
      createdAt: row.created_at as string,
    }),
  );

  const documents = (
    documentResponse.data as Array<Record<string, unknown>>
  ).map((row) => {
    const v = row.vouchers as Record<string, unknown> | null;
    return {
      id: row.id as string,
      voucherId: row.voucher_id as string,
      format: row.format as DocumentFormat,
      docxPath: row.docx_path as string,
      pdfPath: (row.pdf_path ?? undefined) as string | undefined,
      createdAt: row.created_at as string,
      requisitionNo: (v?.requisition_no ?? "") as string,
      tourNo: (v?.tour_no ?? "") as string,
      tourName: (v?.tour_name ?? "") as string,
      hotelName: ((v?.hotels as Record<string, unknown> | null)?.name ??
        "") as string,
      customerName: ((v?.customers as Record<string, unknown> | null)?.name ??
        "") as string,
      voucherDate: (v?.voucher_date ?? "") as string,
    };
  });

  return { vouchers, documents };
}

export async function getVoucherTemplate(
  name: string,
): Promise<{ name: string; file_data: string } | null> {
  const supabase = await getActiveSupabaseClient();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("voucher_templates")
    .select("name, file_data")
    .eq("name", name)
    .maybeSingle();

  if (error) {
    if (error.code === "42P01") {
      throw new Error(
        "Voucher templates table is missing in the database. Please run the SQL database migration script in your Supabase console.",
      );
    }
    throw error;
  }

  return data;
}

export async function upsertVoucherTemplate(
  name: string,
  fileData: string,
): Promise<void> {
  const supabase = await getActiveSupabaseClient();
  if (!supabase) throw new Error("Supabase is not configured");

  const userId = await requireCurrentUserId("Please log in first.");

  const { error } = await supabase
    .from("voucher_templates")
    .upsert(
      { name, file_data: fileData, created_by: userId },
      { onConflict: "name" },
    );

  if (error) {
    if (error.code === "42P01") {
      throw new Error(
        "Voucher templates table is missing in the database. Please run the SQL database migration script in your Supabase console.",
      );
    }
    throw error;
  }
}

export async function listVoucherTemplates(): Promise<
  Array<{ id: string; name: string; created_at: string; updated_at: string }>
> {
  const supabase = await getActiveSupabaseClient();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("voucher_templates")
    .select("id, name, created_at, updated_at")
    .order("name");

  if (error) {
    if (error.code === "42P01") {
      throw new Error(
        "Voucher templates table is missing in the database. Please run the SQL database migration script in your Supabase console.",
      );
    }
    throw error;
  }

  return data || [];
}

export async function deleteVoucherTemplate(name: string): Promise<void> {
  const supabase = await getActiveSupabaseClient();
  if (!supabase) throw new Error("Supabase is not configured");

  const { error } = await supabase
    .from("voucher_templates")
    .delete()
    .eq("name", name);

  if (error) {
    if (error.code === "42P01") {
      throw new Error(
        "Voucher templates table is missing in the database. Please run the SQL database migration script in your Supabase console.",
      );
    }
    throw error;
  }
}
