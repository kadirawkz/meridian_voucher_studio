import type {
  AutoFillResult,
  CustomerRef,
  HotelRateGuideRates,
  HotelRateRecord,
  HotelRateRecordSummary,
  HotelRef,
  MarketRef,
  RoomCategoryRef,
  VoucherPayload,
} from "../../shared/types.js";
import { getAuthenticatedSupabaseClient, getCurrentEmployeeProfile, getCurrentUser } from "./auth.js";

async function getActiveSupabaseClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;
  if (!url || !key) return null;

  const supabase = getAuthenticatedSupabaseClient();
  if (!supabase) throw new Error("Supabase is not configured");

  const user = await getCurrentUser();
  if (!user) throw new Error("Please log in first.");

  const profile = await getCurrentEmployeeProfile(user);
  if (!profile?.isActive) throw new Error("Your employee account is inactive. Contact an administrator.");

  return supabase;
}

async function requireUserId(message: string): Promise<string> {
  const user = await getCurrentUser();
  if (!user) throw new Error(message);
  return user.id;
}

function requireNonEmpty(value: string, message: string) {
  if (!value?.trim()) throw new Error(message);
}

/* ---------- ID Lookup Helpers ---------- */

async function resolveHotelId(supabase: NonNullable<Awaited<ReturnType<typeof getActiveSupabaseClient>>>, hotelName: string): Promise<string> {
  // Try to find existing hotel first
  const { data: existing } = await supabase.from("hotels").select("id").eq("name", hotelName).maybeSingle();
  if (existing) return existing.id as string;

  const { data, error } = await supabase
    .from("hotels")
    .insert({ name: hotelName, is_active: true })
    .select("id")
    .single();
    
  if (error || !data) throw new Error(`Unable to resolve hotel: ${hotelName}`);
  return data.id as string;
}

async function resolveMarketId(supabase: NonNullable<Awaited<ReturnType<typeof getActiveSupabaseClient>>>, marketCode: string): Promise<string | null> {
  if (!marketCode?.trim()) return null;
  const { data } = await supabase.from("markets").select("id").eq("code", marketCode).maybeSingle();
  return (data?.id as string) ?? null;
}

async function resolveRoomCategoryId(
  supabase: NonNullable<Awaited<ReturnType<typeof getActiveSupabaseClient>>>,
  name: string
): Promise<string> {
  const { data, error } = await supabase
    .from("room_categories")
    .upsert({ name }, { onConflict: "name" })
    .select("id")
    .single();
  if (!data || error) throw new Error(`Unable to resolve room category: ${name}`);
  return data.id as string;
}

async function buildRoomCategoryMap(
  supabase: NonNullable<Awaited<ReturnType<typeof getActiveSupabaseClient>>>,
  names: string[]
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  const unique = [...new Set(names.filter(Boolean))];
  for (const name of unique) {
    const id = await resolveRoomCategoryId(supabase, name);
    if (id) map.set(name, id);
  }
  return map;
}

/* ---------- Reference Data ---------- */

export async function listHotels(): Promise<HotelRef[]> {
  const supabase = await getActiveSupabaseClient();
  if (!supabase) return [];
  const { data, error } = await supabase.from("hotels").select("id,name,is_active").eq("is_active", true).order("name");
  if (error) throw new Error(`Unable to load hotels: ${error.message}`);
  return (data ?? []) as HotelRef[];
}

export async function listMarkets(): Promise<MarketRef[]> {
  const supabase = await getActiveSupabaseClient();
  if (!supabase) return [];
  const { data, error } = await supabase.from("markets").select("id,code,name").order("code");
  if (error) throw new Error(`Unable to load markets: ${error.message}`);
  return (data ?? []) as MarketRef[];
}

export async function listRoomCategories(): Promise<RoomCategoryRef[]> {
  const supabase = await getActiveSupabaseClient();
  if (!supabase) return [];
  const { data, error } = await supabase.from("room_categories").select("id,name").order("name");
  if (error) throw new Error(`Unable to load room categories: ${error.message}`);
  return (data ?? []) as RoomCategoryRef[];
}

export async function listCustomers(): Promise<CustomerRef[]> {
  const supabase = await getActiveSupabaseClient();
  if (!supabase) return [];
  const { data, error } = await supabase.from("customers").select("id,name,is_active").eq("is_active", true).order("name");
  if (error) throw new Error(`Unable to load customers: ${error.message}`);
  return (data ?? []) as CustomerRef[];
}

/* ---------- Hotel Rates CRUD ---------- */

async function assembleHotelRateRecord(
  supabase: NonNullable<Awaited<ReturnType<typeof getActiveSupabaseClient>>>,
  parentRow: Record<string, unknown>
): Promise<HotelRateRecord> {
  const id = parentRow.id as string;

  const [roomPricesRes, childPricesRes, surchargesRes, eventsRes, guidePricesRes, supplementsRes] = await Promise.all([
    supabase.from("hotel_rate_room_prices").select("*, room_categories(name)").eq("hotel_rate_id", id).order("valid_from"),
    supabase.from("hotel_rate_child_prices").select("*, room_categories(name)").eq("hotel_rate_id", id).order("valid_from"),
    supabase.from("hotel_rate_surcharges").select("*").eq("hotel_rate_id", id),
    supabase.from("hotel_rate_events").select("*").eq("hotel_rate_id", id).order("event_date"),
    supabase.from("hotel_rate_guide_prices").select("*").eq("hotel_rate_id", id),
    supabase.from("hotel_rate_room_supplements").select("*, room_categories(name)").eq("hotel_rate_id", id),
  ]);

  // Resolve hotel name and market code from nested join data
  const hotelName = (parentRow.hotels as Record<string, unknown> | null)?.name as string ?? "";
  const marketCode = (parentRow.markets as Record<string, unknown> | null)?.code as string ?? "";

  const guideRates: HotelRateGuideRates = {};
  for (const gp of (guidePricesRes.data ?? []) as Array<{ basis: string; rate: number | null }>) {
    guideRates[gp.basis] = gp.rate;
  }

  return {
    id,
    hotel_id: (parentRow.hotel_id ?? "") as string,
    hotel_name: hotelName,
    market_id: (parentRow.market_id ?? undefined) as string | undefined,
    market: marketCode,
    currency: (parentRow.currency ?? "USD") as string,
    contract_name: (parentRow.contract_name ?? "") as string,
    valid_from: (parentRow.valid_from ?? "") as string,
    valid_to: (parentRow.valid_to ?? "") as string,
    billing_instruction: (parentRow.billing_instruction ?? "") as string,
    foc_rules: {
      enabled: Boolean(parentRow.foc_enabled ?? false),
      applies_to: (parentRow.foc_applies_to ?? "Guide") as string,
      minimum_persons: (parentRow.foc_minimum_persons ?? 0) as number,
      foc_quantity: (parentRow.foc_quantity ?? 1) as number,
      basis: (parentRow.foc_basis ?? "") as string,
    },
    room_rates: ((roomPricesRes.data ?? []) as Array<Record<string, unknown>>).map((r) => ({
      id: r.id as string,
      from: (r.valid_from ?? "") as string,
      to: (r.valid_to ?? "") as string,
      room_category_id: (r.room_category_id ?? "") as string,
      room_category: ((r.room_categories as Record<string, unknown> | null)?.name ?? "") as string,
      basis: (r.basis ?? "") as string,
      sgl: r.sgl as number | null,
      dbl: r.dbl as number | null,
      twn: r.twn as number | null,
      tpl: r.tpl as number | null,
    })),
    child_rates: ((childPricesRes.data ?? []) as Array<Record<string, unknown>>).map((r) => ({
      id: r.id as string,
      from: (r.valid_from ?? "") as string,
      to: (r.valid_to ?? "") as string,
      room_category_id: (r.room_category_id ?? "") as string,
      room_category: ((r.room_categories as Record<string, unknown> | null)?.name ?? "") as string,
      basis: (r.basis ?? "") as string,
      age_2_5_sharing: r.age_2_5_sharing as string | null,
      age_2_5_extra_bed: r.age_2_5_extra_bed as string | null,
      age_2_5_own_room: r.age_2_5_own_room as string | null,
      age_6_11_sharing: r.age_6_11_sharing as string | null,
      age_6_11_extra_bed: r.age_6_11_extra_bed as string | null,
      age_6_11_own_room: r.age_6_11_own_room as string | null,
    })),
    seasonal_surcharges: ((surchargesRes.data ?? []) as Array<Record<string, unknown>>).map((s) => ({
      id: s.id as string,
      name: (s.name ?? "") as string,
      amount: s.amount as number | null,
      date_from: (s.date_from ?? null) as string | null,
      date_to: (s.date_to ?? null) as string | null,
      applies_to: (s.applies_to ?? null) as string | null,
    })),
    compulsory_events: ((eventsRes.data ?? []) as Array<Record<string, unknown>>).map((e) => ({
      id: e.id as string,
      event_date: (e.event_date ?? "") as string,
      event_name: (e.event_name ?? "") as string,
      bb_rate: e.bb_rate as number | null,
      hb_rate: e.hb_rate as number | null,
      fb_rate: e.fb_rate as number | null,
      per: (e.per ?? "Person") as string,
      mandatory: Boolean(e.mandatory ?? true),
    })),
    guide_rates: guideRates,
    guide_prices: ((guidePricesRes.data ?? []) as Array<Record<string, unknown>>).map((g) => ({
      id: g.id as string,
      basis: (g.basis ?? "") as string,
      rate: g.rate as number | null,
    })),
    room_supplements: ((supplementsRes.data ?? []) as Array<Record<string, unknown>>).map((s) => ({
      id: s.id as string,
      room_category_id: (s.room_category_id ?? "") as string,
      room_category: ((s.room_categories as Record<string, unknown> | null)?.name ?? "") as string,
      supplement_name: (s.supplement_name ?? "") as string,
      supplement_amount: (s.supplement_amount ?? 0) as number,
      per: (s.per ?? "per room per night") as string,
    })),
    created_at: (parentRow.created_at ?? "") as string,
    updated_at: (parentRow.updated_at ?? "") as string,
  };
}

export async function saveHotelRates(record: HotelRateRecord): Promise<{ id: string }> {
  const supabase = await getActiveSupabaseClient();
  if (!supabase) return { id: record.id ?? crypto.randomUUID() };

  requireNonEmpty(record.hotel_name, "Hotel name is required");
  requireNonEmpty(record.currency, "Currency is required");
  requireNonEmpty(record.contract_name, "Contract name is required");
  requireNonEmpty(record.valid_from, "Valid from is required");
  requireNonEmpty(record.valid_to, "Valid to is required");

  const userId = await requireUserId("Please log in before saving hotel rates.");

  // Resolve FK IDs from names
  const hotelId = record.hotel_id || await resolveHotelId(supabase, record.hotel_name);
  const marketId = record.market_id || await resolveMarketId(supabase, record.market);

  // Build room category map for child rows
  const allCatNames = [
    ...(record.room_rates ?? []).map((r) => r.room_category),
    ...(record.child_rates ?? []).map((r) => r.room_category),
    ...(record.room_supplements ?? []).map((s) => s.room_category),
  ];
  const catMap = await buildRoomCategoryMap(supabase, allCatNames);

  // 1. Upsert parent
  const parentRow = {
    id: record.id || undefined,
    hotel_id: hotelId,
    market_id: marketId,
    currency: record.currency,
    contract_name: record.contract_name,
    valid_from: record.valid_from,
    valid_to: record.valid_to,
    billing_instruction: record.billing_instruction ?? "",
    foc_enabled: record.foc_rules?.enabled ?? false,
    foc_applies_to: record.foc_rules?.applies_to ?? "Guide",
    foc_minimum_persons: record.foc_rules?.minimum_persons ?? 0,
    foc_quantity: record.foc_rules?.foc_quantity ?? 1,
    foc_basis: record.foc_rules?.basis ?? "",
    created_by: userId,
  };

  const { data: parentData, error: parentError } = await supabase
    .from("hotel_rates")
    .upsert(parentRow, { onConflict: "hotel_id,market_id,contract_name,valid_from,valid_to" })
    .select("id")
    .single();
  if (parentError) throw new Error(`Unable to save hotel rates: ${parentError.message}`);
  const hotelRateId = parentData.id as string;

  // 2. Delete children
  await Promise.all([
    supabase.from("hotel_rate_room_prices").delete().eq("hotel_rate_id", hotelRateId),
    supabase.from("hotel_rate_child_prices").delete().eq("hotel_rate_id", hotelRateId),
    supabase.from("hotel_rate_surcharges").delete().eq("hotel_rate_id", hotelRateId),
    supabase.from("hotel_rate_events").delete().eq("hotel_rate_id", hotelRateId),
    supabase.from("hotel_rate_guide_prices").delete().eq("hotel_rate_id", hotelRateId),
    supabase.from("hotel_rate_room_supplements").delete().eq("hotel_rate_id", hotelRateId),
  ]);

  // 3. Insert children with FK IDs
  const inserts: PromiseLike<any>[] = [];

  if (record.room_rates?.length) {
    inserts.push(supabase.from("hotel_rate_room_prices").insert(
      record.room_rates.map((r) => ({
        hotel_rate_id: hotelRateId,
        valid_from: r.from, valid_to: r.to,
        room_category_id: r.room_category_id || catMap.get(r.room_category) || null,
        basis: r.basis,
        sgl: r.sgl || null, dbl: r.dbl || null, twn: r.twn || null, tpl: r.tpl || null,
      }))
    ));
  }

  if (record.child_rates?.length) {
    inserts.push(supabase.from("hotel_rate_child_prices").insert(
      record.child_rates.map((r) => ({
        hotel_rate_id: hotelRateId,
        valid_from: r.from, valid_to: r.to,
        room_category_id: r.room_category_id || catMap.get(r.room_category) || null,
        basis: r.basis,
        age_2_5_sharing: r.age_2_5_sharing, age_2_5_extra_bed: r.age_2_5_extra_bed, age_2_5_own_room: r.age_2_5_own_room,
        age_6_11_sharing: r.age_6_11_sharing, age_6_11_extra_bed: r.age_6_11_extra_bed, age_6_11_own_room: r.age_6_11_own_room,
      }))
    ));
  }

  if (record.seasonal_surcharges?.length) {
    inserts.push(supabase.from("hotel_rate_surcharges").insert(
      record.seasonal_surcharges.map((s) => ({
        hotel_rate_id: hotelRateId,
        name: s.name, amount: s.amount,
        date_from: s.date_from, date_to: s.date_to, applies_to: s.applies_to,
      }))
    ));
  }

  if (record.compulsory_events?.length) {
    inserts.push(supabase.from("hotel_rate_events").insert(
      record.compulsory_events.map((e) => ({
        hotel_rate_id: hotelRateId,
        event_date: e.event_date, event_name: e.event_name,
        bb_rate: e.bb_rate, hb_rate: e.hb_rate, fb_rate: e.fb_rate,
        per: e.per ?? "Person", mandatory: e.mandatory ?? true,
      }))
    ));
  }

  const guidePriceRows: Array<{ hotel_rate_id: string; basis: string; rate: number | null }> = [];
  if (record.guide_prices?.length) {
    for (const gp of record.guide_prices) {
      if (gp.basis?.trim()) guidePriceRows.push({ hotel_rate_id: hotelRateId, basis: gp.basis.trim().toUpperCase(), rate: gp.rate });
    }
  } else if (record.guide_rates) {
    for (const [basis, rate] of Object.entries(record.guide_rates)) {
      if (basis?.trim()) guidePriceRows.push({ hotel_rate_id: hotelRateId, basis: basis.trim().toUpperCase(), rate });
    }
  }
  if (guidePriceRows.length) inserts.push(supabase.from("hotel_rate_guide_prices").insert(guidePriceRows).select());

  if (record.room_supplements?.length) {
    inserts.push(supabase.from("hotel_rate_room_supplements").insert(
      record.room_supplements
        .filter((s) => s.supplement_name?.trim() && s.supplement_amount != null)
        .map((s) => ({
          hotel_rate_id: hotelRateId,
          room_category_id: s.room_category_id || catMap.get(s.room_category) || null,
          supplement_name: s.supplement_name.trim(),
          supplement_amount: Number(s.supplement_amount),
          per: s.per || "per room per night",
        }))
    ).select());
  }

  const results = await Promise.all(inserts);
  for (const res of results) {
    if (res?.error) {
      throw new Error(`Failed to save rate details: ${res.error.message}\nDetails: ${res.error.details}\nHint: ${res.error.hint}`);
    }
  }
  return { id: hotelRateId };
}

export async function listHotelRates(hotelName?: string): Promise<HotelRateRecordSummary[]> {
  const supabase = await getActiveSupabaseClient();
  if (!supabase) return [];

  let query = supabase
    .from("hotel_rates")
    .select("id,hotel_id,market_id,currency,contract_name,valid_from,valid_to,hotels(name),markets(code)")
    .order("valid_from", { ascending: false });

  if (hotelName) {
    // Look up hotel_id by name
    const { data: hotel } = await supabase.from("hotels").select("id").ilike("name", hotelName).maybeSingle();
    if (!hotel) return [];
    query = query.eq("hotel_id", hotel.id);
  }

  const { data, error } = await query;
  if (error) throw new Error(`Unable to load hotel rates: ${error.message}`);

  return (data ?? []).map((r: Record<string, unknown>) => ({
    id: r.id as string,
    hotel_name: ((r.hotels as Record<string, unknown> | null)?.name ?? "") as string,
    market: ((r.markets as Record<string, unknown> | null)?.code ?? "") as string,
    currency: (r.currency ?? "USD") as string,
    contract_name: (r.contract_name ?? "") as string,
    valid_from: (r.valid_from ?? "") as string,
    valid_to: (r.valid_to ?? "") as string,
  }));
}

export async function getHotelRates(hotelRateId: string): Promise<HotelRateRecord> {
  const supabase = await getActiveSupabaseClient();
  if (!supabase) throw new Error("Supabase is not configured");

  const { data, error } = await supabase.from("hotel_rates").select("*, hotels(name), markets(code)").eq("id", hotelRateId).single();
  if (error) throw new Error(`Unable to load hotel rates: ${error.message}`);

  return assembleHotelRateRecord(supabase, data as Record<string, unknown>);
}

export async function listHotelsFromRates(): Promise<string[]> {
  const supabase = await getActiveSupabaseClient();
  if (!supabase) return [];

  const { data, error } = await supabase.from("hotel_rates").select("hotel_id, hotels(name)");
  if (error) throw new Error(`Unable to load hotels: ${error.message}`);

  const set = new Set<string>();
  for (const row of (data ?? []) as Array<Record<string, unknown>>) {
    const name = ((row.hotels as Record<string, unknown> | null)?.name ?? "") as string;
    if (name.trim()) set.add(name);
  }
  return Array.from(set).sort();
}

function buildRateApplicableText(voucher: VoucherPayload, record: HotelRateRecord): string {
  const currency = record.currency || "USD";
  const usedCategories = Array.from(new Set(
    voucher.lineItems.map((li) => (li.roomCategory || "").trim()).filter(Boolean)
  ));

  if (usedCategories.length === 0) return "";

  const categoryBlocks: string[] = [];

  for (const catName of usedCategories) {
    const segments: string[] = [];
    const catUpper = catName.toUpperCase();
    
    // ① Room Rates for this category
    const usedTypes = { sgl: false, dbl: false, twn: false, tpl: false };
    const typeRates: Record<string, Set<string>> = { SGL: new Set(), DBL: new Set(), TWN: new Set(), TPL: new Set() };
    const basisUsed = new Set<string>();

    for (const li of voucher.lineItems) {
      if (li.roomCategory?.trim().toLowerCase() !== catName.toLowerCase()) continue;
      
      if (Number(li.singleRooms || 0) > 0) usedTypes.sgl = true;
      if (Number(li.doubleRooms || 0) > 0) usedTypes.dbl = true;
      if (Number(li.twinRooms || 0) > 0) usedTypes.twn = true;
      if (Number(li.tripleRooms || 0) > 0) usedTypes.tpl = true;

      const reqDate = li.requiredDate;
      const basis = (li.basis || "").trim();
      if (!reqDate || !basis) continue;
      basisUsed.add(basis.toUpperCase());

      const match = (record.room_rates ?? []).find((r) =>
        reqDate >= r.from && reqDate <= r.to &&
        r.room_category.toLowerCase() === catName.toLowerCase() &&
        r.basis.toLowerCase() === basis.toLowerCase()
      );
      if (match) {
        if (Number(li.singleRooms || 0) > 0 && match.sgl != null) typeRates.SGL.add(match.sgl.toString());
        if (Number(li.doubleRooms || 0) > 0 && match.dbl != null) typeRates.DBL.add(match.dbl.toString());
        if (Number(li.twinRooms || 0) > 0 && match.twn != null) typeRates.TWN.add(match.twn.toString());
        if (Number(li.tripleRooms || 0) > 0 && match.tpl != null) typeRates.TPL.add(match.tpl.toString());
      }
    }

    const basisLabel = Array.from(basisUsed).join("/");
    const roomParts: string[] = [];
    if (usedTypes.sgl && typeRates.SGL.size > 0) roomParts.push(`Single-${basisLabel} ${currency} ${Array.from(typeRates.SGL).join(" & ")}`);
    if (usedTypes.dbl && typeRates.DBL.size > 0) roomParts.push(`Double-${basisLabel} ${currency} ${Array.from(typeRates.DBL).join(" & ")}`);
    if (usedTypes.twn && typeRates.TWN.size > 0) roomParts.push(`Twin-${basisLabel} ${currency} ${Array.from(typeRates.TWN).join(" & ")}`);
    if (usedTypes.tpl && typeRates.TPL.size > 0) roomParts.push(`Triple-${basisLabel} ${currency} ${Array.from(typeRates.TPL).join(" & ")}`);
    if (roomParts.length > 0) segments.push(roomParts.join(" / "));

    // ② Child Rates for this category
    const ageGroupSummaries = new Map<string, string>();
    for (const li of voucher.lineItems) {
      if (li.roomCategory?.trim().toLowerCase() !== catName.toLowerCase()) continue;
      if (!li.requiredDate || !li.basis) continue;
      
      const match = (record.child_rates ?? []).find((r) =>
        li.requiredDate >= r.from && li.requiredDate <= r.to &&
        r.room_category.toLowerCase() === catName.toLowerCase() &&
        r.basis.toLowerCase() === li.basis.toLowerCase()
      );

      if (match) {
        function formatVal(v: string | null | undefined) {
          if (!v) return null;
          if (v.toUpperCase() === "FOC") return "FOC";
          return isNaN(Number(v)) ? v : `${record.currency} ${v}`;
        }

        const groups = [
          { 
            key: "2-5", label: "Child (2-5.99 Y)", 
            types: [
              { count: li.child2_5Sharing || 0, label: "Sharing", val: match.age_2_5_sharing },
              { count: li.child2_5Bed || 0, label: "Bed", val: match.age_2_5_extra_bed },
              { count: li.child2_5OwnRoom || 0, label: "ICON", val: match.age_2_5_own_room }
            ],
            legacyCount: li.child2_5 || 0
          },
          { 
            key: "6-11", label: "Child (6-11.99 Y)", 
            types: [
              { count: li.child6_11Sharing || 0, label: "Sharing", val: match.age_6_11_sharing },
              { count: li.child6_11Bed || 0, label: "Bed", val: match.age_6_11_extra_bed },
              { count: li.child6_11OwnRoom || 0, label: "ICON", val: match.age_6_11_own_room }
            ],
            legacyCount: li.child6_11 || 0
          }
        ];

        for (const group of groups) {
          const selectedTypes: string[] = [];
          for (const type of group.types) {
            if (type.count > 0) {
              const fv = formatVal(type.val);
              if (fv) selectedTypes.push(`${type.label} ${fv}`);
            }
          }
          if (selectedTypes.length > 0) {
            ageGroupSummaries.set(group.key, `${group.label} ${selectedTypes.join(" / ")}`);
          } else if (group.legacyCount > 0) {
            const rateParts: string[] = [];
            for (const type of group.types) {
              const fv = formatVal(type.val);
              if (fv) rateParts.push(`${type.label} ${fv}`);
            }
            if (rateParts.length > 0) {
              ageGroupSummaries.set(group.key, `${group.label} ${rateParts.join(" / ")}`);
            }
          }
        }
      }
    }
    const childParts = Array.from(ageGroupSummaries.values());
    if (childParts.length > 0) segments.push(childParts.join(" | "));

    // ③ Supplements for this category
    const selectedSupplements = new Set<string>();
    for (const li of voucher.lineItems) {
      if (li.roomCategory?.trim().toLowerCase() !== catName.toLowerCase()) continue;
      if (li.supplementary && Array.isArray(li.supplementary)) {
        for (const sName of li.supplementary) {
          selectedSupplements.add(sName);
        }
      }
    }

    const suppSegments: string[] = [];
    for (const supp of (record.room_supplements ?? [])) {
      if (!supp.supplement_name || supp.supplement_amount == null) continue;
      if (supp.room_category.toLowerCase() === catName.toLowerCase() && selectedSupplements.has(supp.supplement_name)) {
        suppSegments.push(`${supp.supplement_name} ${currency} ${supp.supplement_amount} ${supp.per}`);
      }
    }
    if (suppSegments.length > 0) {
      segments.push(suppSegments.join(" | "));
    }

    // ④ Guide / FOC (Check if it applies to this basis/category context)
    const focRules = record.foc_rules;
    const totalPax = voucher.lineItems.reduce((sum, li) =>
      sum + Number(li.singleRooms || 0) + (Number(li.doubleRooms || 0) * 2) + (Number(li.twinRooms || 0) * 2) + (Number(li.tripleRooms || 0) * 3), 0
    );
    const hasGuideInVoucher = voucher.lineItems.some((li) => Number(li.guide || 0) > 0);
    if (hasGuideInVoucher && focRules?.enabled && focRules.minimum_persons != null && totalPax >= focRules.minimum_persons) {
      const qty = focRules.foc_quantity ?? 1;
      const who = focRules.applies_to || "Guide";
      const focsOn = focRules.basis ? ` on ${focRules.basis.split(",").join("/")}` : "";
      const minP = focRules.minimum_persons;
      segments.push(`Guide FOC: ${qty} ${who} FOC${focsOn} when ${minP}+ persons`);
    }

    if (segments.length > 0) {
      categoryBlocks.push(`${catUpper}: ${segments.join(" / ")}`);
    }
  }

  // Final segments for Global Surcharges, Events, and Guide Rates
  const globalSegments: string[] = [];
  const voucherDates = new Set(voucher.lineItems.map((li) => li.requiredDate).filter(Boolean));
  const basisUsedInVoucher = Array.from(new Set(voucher.lineItems.map(li => (li.basis || "").toUpperCase()))).filter(Boolean);

  // ⑤ Seasonal Surcharges
  const surchargeParts = new Set<string>();
  for (const s of (record.seasonal_surcharges ?? [])) {
    if (!s.name || s.amount == null) continue;
    if (Array.from(voucherDates).some((d) => (!s.date_from || d >= s.date_from) && (!s.date_to || d <= s.date_to))) {
      const appliesToStr = s.applies_to ? ` (${s.applies_to})` : " per room per night";
      surchargeParts.add(`${s.name} ${currency} ${s.amount}${appliesToStr} (Added to above rates)`);
    }
  }
  if (surchargeParts.size > 0) globalSegments.push(Array.from(surchargeParts).join(" / "));

  // ⑥ Compulsory Events
  const eventParts = new Set<string>();
  for (const ev of (record.compulsory_events ?? [])) {
    if (!ev.event_name || !ev.mandatory || !voucherDates.has(ev.event_date)) continue;
    const firstBasis = basisUsedInVoucher[0] ?? "HB";
    const evRate = firstBasis === "BB" ? ev.bb_rate : firstBasis === "HB" ? ev.hb_rate : ev.fb_rate ?? ev.hb_rate ?? ev.bb_rate;
    if (evRate != null) {
      eventParts.add(`${ev.event_name} ${currency} ${evRate} per ${(ev.per || "person").toLowerCase()} (Added to above rates)`);
    }
  }
  if (eventParts.size > 0) globalSegments.push(Array.from(eventParts).join(" / "));

  // ⑦ Guide / FOC (At the very end)
  const focRules = record.foc_rules;
  const totalPax = voucher.lineItems.reduce((sum, li) =>
    sum + Number(li.singleRooms || 0) + (Number(li.doubleRooms || 0) * 2) + (Number(li.twinRooms || 0) * 2) + (Number(li.tripleRooms || 0) * 3), 0
  );
  const hasGuideInVoucher = voucher.lineItems.some((li) => Number(li.guide || 0) > 0);

  if (hasGuideInVoucher) {
    if (focRules?.enabled && focRules.minimum_persons != null && totalPax >= focRules.minimum_persons) {
      const qty = focRules.foc_quantity ?? 1;
      const who = focRules.applies_to || "Guide";
      const focsOn = focRules.basis ? ` on ${focRules.basis.split(",").join("/")}` : "";
      const minP = focRules.minimum_persons;
      globalSegments.push(`Guide FOC: ${qty} ${who} FOC${focsOn} when ${minP}+ persons`);
    } else {
      // Show explicit guide rates if FOC not met
      const guideSummaries: string[] = [];
      for (const basis of basisUsedInVoucher) {
        const rate = record.guide_rates?.[basis];
        if (rate != null) {
          guideSummaries.push(`Guide-${basis} ${currency} ${rate}`);
        }
      }
      if (guideSummaries.length > 0) {
        globalSegments.push(`Guide Rates: ${guideSummaries.join(" / ")}`);
      } else {
        globalSegments.push(`Guide: 1 Guide (Not FOC)`);
      }
    }
  }

  return [...categoryBlocks, ...globalSegments].join("\n");
}

export async function autoFillVoucherFromHotelRates(voucher: VoucherPayload, hotelRateId?: string): Promise<AutoFillResult> {
  const supabase = await getActiveSupabaseClient();
  if (!supabase) return { status: "no-match", warnings: ["Supabase is not configured; auto-fill unavailable."] };

  const summaries = await listHotelRates(voucher.hotelName);
  if (summaries.length === 0) return { status: "no-match", warnings: ["No hotel rate data found for this hotel."] };

  let record: HotelRateRecord | undefined;

  if (hotelRateId) {
    record = await getHotelRates(hotelRateId);
  } else {
    const market = (voucher.market || "").trim();
    const ratePeriod = (voucher.ratePeriod || "").trim();
    const firstRequiredDate = voucher.lineItems.map((li) => li.requiredDate).filter(Boolean).sort()[0] ?? voucher.date;

    if (!ratePeriod) return { status: "no-match", warnings: ["Rate period must be selected manually."] };

    const candidates = summaries.filter((s) => {
      const hotelOk = s.hotel_name.toLowerCase() === voucher.hotelName.toLowerCase();
      const marketOk = market ? (s.market === market || s.market === "") : true;
      const periodOk = s.contract_name === ratePeriod;
      const dateOk = firstRequiredDate >= s.valid_from && firstRequiredDate <= s.valid_to;
      return hotelOk && marketOk && periodOk && dateOk;
    });

    if (candidates.length === 0) return { status: "no-match", warnings: ["No matching hotel rate record for selected hotel, market, and required date."] };
    if (candidates.length > 1) return { status: "multiple", warnings: ["Multiple matching hotel rate records found. Please select one."], candidateHotelRates: candidates };

    record = await getHotelRates(candidates[0].id!);
  }

  const warnings: string[] = [];

  // Warn for any line item with no room rate match
  for (const li of voucher.lineItems) {
    const reqDate = li.requiredDate;
    const cat = (li.roomCategory || "").trim();
    const basis = (li.basis || "").trim();
    if (!reqDate || !cat || !basis) continue;
    const match = (record.room_rates ?? []).find((r) =>
      reqDate >= r.from && reqDate <= r.to &&
      r.room_category.toLowerCase() === cat.toLowerCase() &&
      r.basis.toLowerCase() === basis.toLowerCase()
    );
    if (!match) warnings.push(`No matching rate found for ${reqDate} / ${cat} / ${basis}`);
  }

  return {
    status: "matched",
    warnings,
    matchedHotelRateId: record.id,
    rateApplicableText: buildRateApplicableText(voucher, record),
    billingInstructions: record.billing_instruction || undefined,
  };
}

export async function deleteHotelRate(hotelRateId: string): Promise<void> {
  const supabase = await getActiveSupabaseClient();
  if (!supabase) throw new Error("Supabase is not configured");
  const { error } = await supabase.from("hotel_rates").delete().eq("id", hotelRateId);
  if (error) throw new Error(`Unable to delete hotel rate: ${error.message}`);
}

export async function getAllHotelRates(): Promise<HotelRateRecord[]> {
  const supabase = await getActiveSupabaseClient();
  if (!supabase) throw new Error("Supabase is not configured");

  // 1 query for parents + 6 bulk queries for all children = 7 total (was 1+5N)
  const [parentsRes, roomPricesRes, childPricesRes, surchargesRes, eventsRes, guidePricesRes, supplementsRes] = await Promise.all([
    supabase.from("hotel_rates").select("*, hotels(name), markets(code)").order("created_at", { ascending: false }),
    supabase.from("hotel_rate_room_prices").select("*, room_categories(name)").order("valid_from"),
    supabase.from("hotel_rate_child_prices").select("*, room_categories(name)").order("valid_from"),
    supabase.from("hotel_rate_surcharges").select("*"),
    supabase.from("hotel_rate_events").select("*").order("event_date"),
    supabase.from("hotel_rate_guide_prices").select("*"),
    supabase.from("hotel_rate_room_supplements").select("*, room_categories(name)"),
  ]);

  if (parentsRes.error) throw new Error(`Unable to load hotel rates: ${parentsRes.error.message}`);

  // Group child rows by hotel_rate_id
  const groupBy = <T extends Record<string, unknown>>(rows: T[]): Map<string, T[]> => {
    const map = new Map<string, T[]>();
    for (const row of rows) {
      const key = row.hotel_rate_id as string;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(row);
    }
    return map;
  };

  const roomPricesByRate = groupBy((roomPricesRes.data ?? []) as Array<Record<string, unknown>>);
  const childPricesByRate = groupBy((childPricesRes.data ?? []) as Array<Record<string, unknown>>);
  const surchargesByRate = groupBy((surchargesRes.data ?? []) as Array<Record<string, unknown>>);
  const eventsByRate = groupBy((eventsRes.data ?? []) as Array<Record<string, unknown>>);
  const guidePricesByRate = groupBy((guidePricesRes.data ?? []) as Array<Record<string, unknown>>);
  const supplementsByRate = groupBy((supplementsRes.data ?? []) as Array<Record<string, unknown>>);

  return ((parentsRes.data ?? []) as Array<Record<string, unknown>>).map((parentRow) => {
    const id = parentRow.id as string;
    const hotelName = ((parentRow.hotels as Record<string, unknown> | null)?.name ?? "") as string;
    const marketCode = ((parentRow.markets as Record<string, unknown> | null)?.code ?? "") as string;

    const guideRates: HotelRateGuideRates = {};
    for (const gp of (guidePricesByRate.get(id) ?? []) as Array<{ basis: string; rate: number | null }>) {
      guideRates[gp.basis] = gp.rate;
    }

    return {
      id,
      hotel_id: (parentRow.hotel_id ?? "") as string,
      hotel_name: hotelName,
      market_id: (parentRow.market_id ?? undefined) as string | undefined,
      market: marketCode,
      currency: (parentRow.currency ?? "USD") as string,
      contract_name: (parentRow.contract_name ?? "") as string,
      valid_from: (parentRow.valid_from ?? "") as string,
      valid_to: (parentRow.valid_to ?? "") as string,
      billing_instruction: (parentRow.billing_instruction ?? "") as string,
      foc_rules: {
        enabled: Boolean(parentRow.foc_enabled ?? false),
        applies_to: (parentRow.foc_applies_to ?? "Guide") as string,
        minimum_persons: (parentRow.foc_minimum_persons ?? 0) as number,
        foc_quantity: (parentRow.foc_quantity ?? 1) as number,
        basis: (parentRow.foc_basis ?? "") as string,
      },
      room_rates: (roomPricesByRate.get(id) ?? []).map((r) => ({
        id: r.id as string,
        from: (r.valid_from ?? "") as string,
        to: (r.valid_to ?? "") as string,
        room_category_id: (r.room_category_id ?? "") as string,
        room_category: ((r.room_categories as Record<string, unknown> | null)?.name ?? "") as string,
        basis: (r.basis ?? "") as string,
        sgl: r.sgl as number | null, dbl: r.dbl as number | null,
        twn: r.twn as number | null, tpl: r.tpl as number | null,
      })),
      child_rates: (childPricesByRate.get(id) ?? []).map((r) => ({
        id: r.id as string,
        from: (r.valid_from ?? "") as string,
        to: (r.valid_to ?? "") as string,
        room_category_id: (r.room_category_id ?? "") as string,
        room_category: ((r.room_categories as Record<string, unknown> | null)?.name ?? "") as string,
        basis: (r.basis ?? "") as string,
        age_2_5_sharing: r.age_2_5_sharing as string | null, age_2_5_extra_bed: r.age_2_5_extra_bed as string | null, age_2_5_own_room: r.age_2_5_own_room as string | null,
        age_6_11_sharing: r.age_6_11_sharing as string | null, age_6_11_extra_bed: r.age_6_11_extra_bed as string | null, age_6_11_own_room: r.age_6_11_own_room as string | null,
      })),
      seasonal_surcharges: (surchargesByRate.get(id) ?? []).map((s) => ({
        id: s.id as string, name: (s.name ?? "") as string,
        amount: s.amount as number | null,
        date_from: (s.date_from ?? null) as string | null, date_to: (s.date_to ?? null) as string | null,
        applies_to: (s.applies_to ?? null) as string | null,
      })),
      compulsory_events: (eventsByRate.get(id) ?? []).map((e) => ({
        id: e.id as string, event_date: (e.event_date ?? "") as string,
        event_name: (e.event_name ?? "") as string,
        bb_rate: e.bb_rate as number | null, hb_rate: e.hb_rate as number | null,
        fb_rate: e.fb_rate as number | null,
        per: (e.per ?? "Person") as string, mandatory: Boolean(e.mandatory ?? true),
      })),
      guide_rates: guideRates,
      guide_prices: (guidePricesByRate.get(id) ?? []).map((g) => ({
        id: g.id as string, basis: (g.basis ?? "") as string, rate: g.rate as number | null,
      })),
      room_supplements: (supplementsByRate.get(id) ?? []).map((s) => ({
        id: s.id as string,
        room_category_id: (s.room_category_id ?? "") as string,
        room_category: ((s.room_categories as Record<string, unknown> | null)?.name ?? "") as string,
        supplement_name: (s.supplement_name ?? "") as string,
        supplement_amount: (s.supplement_amount ?? 0) as number,
        per: (s.per ?? "per room per night") as string,
      })),
      created_at: (parentRow.created_at ?? "") as string,
      updated_at: (parentRow.updated_at ?? "") as string,
    } as HotelRateRecord;
  });
}
