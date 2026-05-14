import type {
  AutoFillResult,
  CustomerRef,
  HotelRateGuideRates,
  HotelRateRecord,
  HotelRateRecordSummary,
  HotelRateRoomSupplement,
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
      age2_5: r.age_2_5 as string | null,
      age6_11: r.age_6_11 as string | null,
      extra_bed: r.extra_bed as string | null,
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
        age_2_5: r.age2_5, age_6_11: r.age6_11, extra_bed: r.extra_bed,
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
  const segments: string[] = [];

  // ① Room Rates: Single-BB USD 85 / Double-BB USD 95 / Twin-BB USD 95 / Triple-BB USD 120
  const usedTypes = { sgl: false, dbl: false, twn: false, tpl: false };
  const typeRates: Record<string, Set<string>> = { SGL: new Set(), DBL: new Set(), TWN: new Set(), TPL: new Set() };
  const basisUsed = new Set<string>();

  for (const li of voucher.lineItems) {
    if (Number(li.singleRooms || 0) > 0) usedTypes.sgl = true;
    if (Number(li.doubleRooms || 0) > 0) usedTypes.dbl = true;
    if (Number(li.twinRooms || 0) > 0) usedTypes.twn = true;
    if (Number(li.tripleRooms || 0) > 0) usedTypes.tpl = true;

    const reqDate = li.requiredDate;
    const cat = (li.roomCategory || "").trim();
    const basis = (li.basis || "").trim();
    if (!reqDate || !cat || !basis) continue;
    basisUsed.add(basis.toUpperCase());

    const match = (record.room_rates ?? []).find((r) =>
      reqDate >= r.from && reqDate <= r.to &&
      r.room_category.toLowerCase() === cat.toLowerCase() &&
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

  // ② Child Rates: Child (2-5.99 Years) FOC / Child (6-11.99 Years) USD 45
  const childParts = new Set<string>();
  const childAge2_5 = new Set<string>();
  const childAge6_11 = new Set<string>();

  for (const li of voucher.lineItems) {
    if (!li.requiredDate || !li.roomCategory || !li.basis) continue;
    const child2_5Count = Number(li.child2_5 || 0);
    const child6_11Count = Number(li.child6_11 || 0);
    if (child2_5Count <= 0 && child6_11Count <= 0) continue;

    const match = (record.child_rates ?? []).find((r) =>
      li.requiredDate >= r.from && li.requiredDate <= r.to &&
      r.room_category.toLowerCase() === li.roomCategory.toLowerCase() &&
      r.basis.toLowerCase() === li.basis.toLowerCase()
    );
    if (match) {
      if (child2_5Count > 0 && match.age2_5) childAge2_5.add(match.age2_5.trim());
      if (child6_11Count > 0 && match.age6_11) childAge6_11.add(match.age6_11.trim());
    }
  }

  function formatChildRate(val: string, cur: string): string {
    if (val.toUpperCase() === "FOC") return "FOC";
    const n = Number(val);
    if (!isNaN(n)) return `${cur} ${val}`;
    return val; // percentage or custom text
  }

  if (childAge2_5.size > 0 || childAge6_11.size > 0) {
    const cp: string[] = [];
    if (childAge2_5.size > 0) cp.push(`Child (2-5.99 Years) ${Array.from(childAge2_5).map((v) => formatChildRate(v, currency)).join(" & ")}`);
    if (childAge6_11.size > 0) cp.push(`Child (6-11.99 Years) ${Array.from(childAge6_11).map((v) => formatChildRate(v, currency)).join(" & ")}`);
    if (cp.length > 0) segments.push(cp.join(" / "));
  }

  // ③ Room Supplements: Super Deluxe Room Supplement USD 20 per room per night (Added to above rates)
  const usedCategories = new Set(
    voucher.lineItems.map((li) => (li.roomCategory || "").toLowerCase()).filter(Boolean)
  );
  const suppParts: string[] = [];
  for (const supp of (record.room_supplements ?? [])) {
    if (!supp.supplement_name || supp.supplement_amount == null) continue;
    // ONLY show the supplement if the exact room category has been selected!
    if (usedCategories.size === 0 || !usedCategories.has(supp.room_category.toLowerCase())) continue;
    suppParts.push(`${supp.supplement_name} ${currency} ${supp.supplement_amount} ${supp.per} (Added to above rates)`);
  }
  if (suppParts.length > 0) segments.push(suppParts.join("\n"));

  // ④ Seasonal Surcharges: Peak Season Surcharge USD 20 per room per night (Added to above rates)
  const voucherDates = new Set(voucher.lineItems.map((li) => li.requiredDate).filter(Boolean));
  const surchargeParts = new Set<string>();
  for (const s of (record.seasonal_surcharges ?? [])) {
    if (!s.name || s.amount == null) continue;
    const applies = Array.from(voucherDates).some((d) =>
      (!s.date_from || d >= s.date_from) && (!s.date_to || d <= s.date_to)
    );
    if (!applies) continue;
    const appliesToStr = s.applies_to ? ` (${s.applies_to})` : " per room per night";
    surchargeParts.add(`${s.name} ${currency} ${s.amount}${appliesToStr} (Added to above rates)`);
  }
  if (surchargeParts.size > 0) segments.push(Array.from(surchargeParts).join("\n"));

  // ⑤ Compulsory Events: Christmas Eve Gala Dinner USD 70 per person (Added to above rates)
  const eventParts = new Set<string>();
  for (const ev of (record.compulsory_events ?? [])) {
    if (!ev.event_name || !ev.mandatory) continue;
    if (!voucherDates.has(ev.event_date)) continue;
    // Pick basis-specific rate
    const firstBasis = Array.from(basisUsed)[0] ?? "";
    const evRate = firstBasis === "BB" ? ev.bb_rate : firstBasis === "HB" ? ev.hb_rate : ev.fb_rate ?? ev.hb_rate ?? ev.bb_rate;
    if (evRate == null) continue;
    eventParts.add(`${ev.event_name} ${currency} ${evRate} per ${(ev.per || "person").toLowerCase()} (Added to above rates)`);
  }
  if (eventParts.size > 0) segments.push(Array.from(eventParts).join("\n"));

  // ⑥ Guide / FOC
  const focRules = record.foc_rules;
  const totalPax = voucher.lineItems.reduce((sum, li) =>
    sum + Number(li.singleRooms || 0) + (Number(li.doubleRooms || 0) * 2) + (Number(li.twinRooms || 0) * 2) + (Number(li.tripleRooms || 0) * 3), 0
  );
  const hasGuide = voucher.lineItems.some((li) => Number(li.guide || 0) > 0);

  if (hasGuide) {
    if (focRules?.enabled && focRules.minimum_persons != null && totalPax >= focRules.minimum_persons) {
      const qty = focRules.foc_quantity ?? 1;
      const who = focRules.applies_to || "Guide";
      const focsOn = focRules.basis ? ` on ${focRules.basis.split(",").join("/")}` : "";
      const minP = focRules.minimum_persons;
      segments.push(`Guide FOC: ${qty} ${who} FOC${focsOn} when ${minP}+ persons`);
    } else {
      // Fall back to guide prices per basis
      const guideSummaries: string[] = [];
      for (const li of voucher.lineItems) {
        if (Number(li.guide || 0) <= 0) continue;
        const basis = (li.guideBasis || "").trim().toUpperCase();
        if (!basis) continue;
        const rate = record.guide_rates?.[basis];
        if (rate != null) {
          const txt = `Guide-${basis} ${currency} ${rate}`;
          if (!guideSummaries.includes(txt)) guideSummaries.push(txt);
        }
      }
      if (guideSummaries.length > 0) segments.push(`Guide Rates: ${guideSummaries.join(" / ")}`);
    }
  }

  return segments.join("\n") || "No matching rates found.";
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
        age2_5: r.age_2_5 as string | null, age6_11: r.age_6_11 as string | null,
        extra_bed: r.extra_bed as string | null,
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
