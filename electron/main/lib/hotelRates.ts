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
  VoucherLineItem,
  TourTypeRef,
  MealBasisRef,
  CurrencyRef,
  HotelRateFocRules,
} from "../../shared/types.js";
import {
  getAuthenticatedSupabaseClient,
  getCurrentEmployeeProfile,
  getCurrentUser,
} from "./auth.js";

async function getActiveSupabaseClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;
  if (!url || !key) return null;

  const supabase = getAuthenticatedSupabaseClient();
  if (!supabase) throw new Error("Supabase is not configured");

  const user = await getCurrentUser();
  if (!user) throw new Error("Please log in first.");

  const profile = await getCurrentEmployeeProfile(user);
  if (!profile?.isActive)
    throw new Error(
      "Your employee account is inactive. Contact an administrator.",
    );

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

async function resolveHotelId(
  supabase: NonNullable<Awaited<ReturnType<typeof getActiveSupabaseClient>>>,
  hotelName: string,
): Promise<string> {
  // Try to find existing hotel first
  const { data: existing } = await supabase
    .from("hotels")
    .select("id")
    .eq("name", hotelName)
    .maybeSingle();
  if (existing) return existing.id as string;

  const { data, error } = await supabase
    .from("hotels")
    .insert({ name: hotelName, is_active: true })
    .select("id")
    .single();

  if (error || !data) throw new Error(`Unable to resolve hotel: ${hotelName}`);
  return data.id as string;
}

async function resolveMarketId(
  supabase: NonNullable<Awaited<ReturnType<typeof getActiveSupabaseClient>>>,
  marketCode: string,
): Promise<string | null> {
  if (!marketCode?.trim()) return null;
  const { data } = await supabase
    .from("markets")
    .select("id")
    .eq("code", marketCode)
    .maybeSingle();
  return (data?.id as string) ?? null;
}

async function resolveRoomCategoryId(
  supabase: NonNullable<Awaited<ReturnType<typeof getActiveSupabaseClient>>>,
  name: string,
): Promise<string> {
  const { data, error } = await supabase
    .from("room_categories")
    .upsert({ name }, { onConflict: "name" })
    .select("id")
    .single();
  if (!data || error)
    throw new Error(`Unable to resolve room category: ${name}`);
  return data.id as string;
}

async function buildRoomCategoryMap(
  supabase: NonNullable<Awaited<ReturnType<typeof getActiveSupabaseClient>>>,
  names: string[],
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
  const { data, error } = await supabase
    .from("hotels")
    .select("id,name,is_active")
    .eq("is_active", true)
    .order("name");
  if (error) throw new Error(`Unable to load hotels: ${error.message}`);
  return (data ?? []) as HotelRef[];
}

export async function listMarkets(): Promise<MarketRef[]> {
  const supabase = await getActiveSupabaseClient();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("markets")
    .select("id,code,name")
    .eq("is_active", true)
    .order("code");
  if (error) throw new Error(`Unable to load markets: ${error.message}`);
  return (data ?? []) as MarketRef[];
}

export async function listRoomCategories(): Promise<RoomCategoryRef[]> {
  const supabase = await getActiveSupabaseClient();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("room_categories")
    .select("id,name")
    .eq("is_active", true)
    .order("name");
  if (error)
    throw new Error(`Unable to load room categories: ${error.message}`);
  return (data ?? []) as RoomCategoryRef[];
}

export async function listCustomers(): Promise<CustomerRef[]> {
  const supabase = await getActiveSupabaseClient();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("customers")
    .select("id,name,is_active")
    .eq("is_active", true)
    .order("name");
  if (error) throw new Error(`Unable to load customers: ${error.message}`);
  return (data ?? []) as CustomerRef[];
}

export async function listTourTypes(): Promise<TourTypeRef[]> {
  const supabase = await getActiveSupabaseClient();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("tour_types")
    .select("id,code,name")
    .eq("is_active", true)
    .order("code");
  if (error) throw new Error(`Unable to load tour types: ${error.message}`);
  return (data ?? []) as TourTypeRef[];
}

export async function saveTourType(ref: {
  code: string;
  name: string;
}): Promise<void> {
  const supabase = await getActiveSupabaseClient();
  if (!supabase) throw new Error("Supabase is not configured");
  const { error } = await supabase
    .from("tour_types")
    .upsert(ref, { onConflict: "code" });
  if (error) throw new Error(`Unable to save tour type: ${error.message}`);
}

export async function deleteTourType(id: string): Promise<void> {
  const supabase = await getActiveSupabaseClient();
  if (!supabase) throw new Error("Supabase is not configured");
  const { error } = await supabase
    .from("tour_types")
    .update({ is_active: false })
    .eq("id", id);
  if (error) throw new Error(`Unable to delete tour type: ${error.message}`);
}

export async function listMealBasis(): Promise<MealBasisRef[]> {
  const supabase = await getActiveSupabaseClient();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("meal_basis")
    .select("id,code,name")
    .eq("is_active", true)
    .order("code");
  if (error) throw new Error(`Unable to load meal basis: ${error.message}`);
  return (data ?? []) as MealBasisRef[];
}

export async function saveMealBasis(ref: {
  code: string;
  name: string;
}): Promise<void> {
  const supabase = await getActiveSupabaseClient();
  if (!supabase) throw new Error("Supabase is not configured");
  const { error } = await supabase
    .from("meal_basis")
    .upsert(ref, { onConflict: "code" });
  if (error) throw new Error(`Unable to save meal basis: ${error.message}`);
}

export async function deleteMealBasis(id: string): Promise<void> {
  const supabase = await getActiveSupabaseClient();
  if (!supabase) throw new Error("Supabase is not configured");
  const { error } = await supabase
    .from("meal_basis")
    .update({ is_active: false })
    .eq("id", id);
  if (error) throw new Error(`Unable to delete meal basis: ${error.message}`);
}

export async function saveMarket(ref: {
  code: string;
  name: string;
}): Promise<void> {
  const supabase = await getActiveSupabaseClient();
  if (!supabase) throw new Error("Supabase is not configured");
  const { error } = await supabase
    .from("markets")
    .upsert(ref, { onConflict: "code" });
  if (error) throw new Error(`Unable to save market: ${error.message}`);
}

export async function deleteMarket(id: string): Promise<void> {
  const supabase = await getActiveSupabaseClient();
  if (!supabase) throw new Error("Supabase is not configured");
  const { error } = await supabase
    .from("markets")
    .update({ is_active: false })
    .eq("id", id);
  if (error) throw new Error(`Unable to delete market: ${error.message}`);
}

export async function saveCustomer(ref: {
  name: string;
  is_active?: boolean;
}): Promise<void> {
  const supabase = await getActiveSupabaseClient();
  if (!supabase) throw new Error("Supabase is not configured");
  const { error } = await supabase
    .from("customers")
    .upsert(ref, { onConflict: "name" });
  if (error) throw new Error(`Unable to save customer: ${error.message}`);
}

export async function deleteCustomer(id: string): Promise<void> {
  const supabase = await getActiveSupabaseClient();
  if (!supabase) throw new Error("Supabase is not configured");
  const { error } = await supabase
    .from("customers")
    .update({ is_active: false })
    .eq("id", id);
  if (error) throw new Error(`Unable to delete customer: ${error.message}`);
}

export async function saveRoomCategory(ref: { name: string }): Promise<void> {
  const supabase = await getActiveSupabaseClient();
  if (!supabase) throw new Error("Supabase is not configured");
  const { error } = await supabase
    .from("room_categories")
    .upsert(ref, { onConflict: "name" });
  if (error) throw new Error(`Unable to save room category: ${error.message}`);
}

export async function deleteRoomCategory(id: string): Promise<void> {
  const supabase = await getActiveSupabaseClient();
  if (!supabase) throw new Error("Supabase is not configured");
  const { error } = await supabase
    .from("room_categories")
    .update({ is_active: false })
    .eq("id", id);
  if (error)
    throw new Error(`Unable to delete room category: ${error.message}`);
}

export async function listCurrencies(): Promise<CurrencyRef[]> {
  const supabase = await getActiveSupabaseClient();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("currencies")
    .select("id,code,name")
    .eq("is_active", true)
    .order("code");
  if (error) throw new Error(`Unable to load currencies: ${error.message}`);
  return (data ?? []) as CurrencyRef[];
}

export async function saveCurrency(ref: {
  code: string;
  name: string;
}): Promise<void> {
  const supabase = await getActiveSupabaseClient();
  if (!supabase) throw new Error("Supabase is not configured");
  const { error } = await supabase
    .from("currencies")
    .upsert(ref, { onConflict: "code" });
  if (error) throw new Error(`Unable to save currency: ${error.message}`);
}

export async function deleteCurrency(id: string): Promise<void> {
  const supabase = await getActiveSupabaseClient();
  if (!supabase) throw new Error("Supabase is not configured");
  const { error } = await supabase
    .from("currencies")
    .update({ is_active: false })
    .eq("id", id);
  if (error) throw new Error(`Unable to delete currency: ${error.message}`);
}

/* ---------- Generic Soft-Delete Restore Helpers ---------- */

const REFERENCE_TABLES = [
  "markets",
  "room_categories",
  "customers",
  "tour_types",
  "meal_basis",
  "currencies",
] as const;
type ReferenceTable = (typeof REFERENCE_TABLES)[number];

function assertReferenceTable(table: string): asserts table is ReferenceTable {
  if (!(REFERENCE_TABLES as readonly string[]).includes(table)) {
    throw new Error(`Invalid reference table: ${table}`);
  }
}

export async function listInactiveReferences(
  table: string,
): Promise<Record<string, unknown>[]> {
  assertReferenceTable(table);
  const supabase = await getActiveSupabaseClient();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from(table)
    .select("*")
    .eq("is_active", false)
    .order("id");
  if (error)
    throw new Error(`Unable to load inactive ${table}: ${error.message}`);
  return (data ?? []) as Record<string, unknown>[];
}

export async function restoreReference(
  table: string,
  id: string,
): Promise<void> {
  assertReferenceTable(table);
  const supabase = await getActiveSupabaseClient();
  if (!supabase) throw new Error("Supabase is not configured");
  const { error } = await supabase
    .from(table)
    .update({ is_active: true })
    .eq("id", id);
  if (error)
    throw new Error(`Unable to restore ${table} item: ${error.message}`);
}

/* ---------- Hotel Rates CRUD ---------- */

async function assembleHotelRateRecord(
  supabase: NonNullable<Awaited<ReturnType<typeof getActiveSupabaseClient>>>,
  parentRow: Record<string, unknown>,
): Promise<HotelRateRecord> {
  const id = parentRow.id as string;

  const [
    roomPricesRes,
    childPricesRes,
    surchargesRes,
    eventsRes,
    guidePricesRes,
    supplementsRes,
  ] = await Promise.all([
    supabase
      .from("hotel_rate_room_prices")
      .select("*, room_categories(name)")
      .eq("hotel_rate_id", id)
      .order("valid_from"),
    supabase
      .from("hotel_rate_child_prices")
      .select("*, room_categories(name)")
      .eq("hotel_rate_id", id)
      .order("valid_from"),
    supabase.from("hotel_rate_surcharges").select("*").eq("hotel_rate_id", id),
    supabase
      .from("hotel_rate_events")
      .select("*")
      .eq("hotel_rate_id", id)
      .order("event_date"),
    supabase
      .from("hotel_rate_guide_prices")
      .select("*")
      .eq("hotel_rate_id", id),
    supabase
      .from("hotel_rate_room_supplements")
      .select("*, room_categories(name)")
      .eq("hotel_rate_id", id),
  ]);

  // Resolve hotel name and market code from nested join data
  const hotelName =
    ((parentRow.hotels as Record<string, unknown> | null)?.name as string) ??
    "";
  const marketCode =
    ((parentRow.markets as Record<string, unknown> | null)?.code as string) ??
    "";

  const guideRates: HotelRateGuideRates = {};
  for (const gp of (guidePricesRes.data ?? []) as Array<{
    basis: string;
    rate: number | null;
  }>) {
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
      count_adults: Boolean(parentRow.foc_count_adults ?? true),
      count_child_2_5_99: Boolean(parentRow.foc_count_child_2_5_99 ?? false),
      count_child_6_11_99: Boolean(parentRow.foc_count_child_6_11_99 ?? false),
      pax_custom_text: (parentRow.foc_pax_custom_text ?? "") as string,
      guide_custom_text: (parentRow.foc_guide_custom_text ?? "") as string,
    },
    room_rates: (
      (roomPricesRes.data ?? []) as Array<Record<string, unknown>>
    ).map((r) => ({
      id: r.id as string,
      from: (r.valid_from ?? "") as string,
      to: (r.valid_to ?? "") as string,
      room_category_id: (r.room_category_id ?? "") as string,
      room_category: ((r.room_categories as Record<string, unknown> | null)
        ?.name ?? "") as string,
      basis: (r.basis ?? "") as string,
      sgl: r.sgl as number | null,
      dbl: r.dbl as number | null,
      twn: r.twn as number | null,
      tpl: r.tpl as number | null,
    })),
    child_rates: (
      (childPricesRes.data ?? []) as Array<Record<string, unknown>>
    ).map((r) => ({
      id: r.id as string,
      from: (r.valid_from ?? "") as string,
      to: (r.valid_to ?? "") as string,
      room_category_id: (r.room_category_id ?? "") as string,
      room_category: ((r.room_categories as Record<string, unknown> | null)
        ?.name ?? "") as string,
      basis: (r.basis ?? "") as string,
      age_2_5_99_sharing: r.age_2_5_99_sharing as string | null,
      age_2_5_99_extra_bed: r.age_2_5_99_extra_bed as string | null,
      age_2_5_99_own_room: r.age_2_5_99_own_room as string | null,
      age_6_11_99_sharing: r.age_6_11_99_sharing as string | null,
      age_6_11_99_extra_bed: r.age_6_11_99_extra_bed as string | null,
      age_6_11_99_own_room: r.age_6_11_99_own_room as string | null,
    })),
    seasonal_surcharges: (
      (surchargesRes.data ?? []) as Array<Record<string, unknown>>
    ).map((s) => ({
      id: s.id as string,
      name: (s.name ?? "") as string,
      amount: s.amount as number | null,
      date_from: (s.date_from ?? null) as string | null,
      date_to: (s.date_to ?? null) as string | null,
      applies_to: (s.applies_to ?? null) as string | null,
    })),
    compulsory_events: (
      (eventsRes.data ?? []) as Array<Record<string, unknown>>
    ).map((e) => ({
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
    guide_prices: (
      (guidePricesRes.data ?? []) as Array<Record<string, unknown>>
    ).map((g) => ({
      id: g.id as string,
      basis: (g.basis ?? "") as string,
      rate: g.rate as number | null,
    })),
    room_supplements: (
      (supplementsRes.data ?? []) as Array<Record<string, unknown>>
    ).map((s) => ({
      id: s.id as string,
      room_category_id: (s.room_category_id ?? "") as string,
      room_category: ((s.room_categories as Record<string, unknown> | null)
        ?.name ?? "") as string,
      supplement_name: (s.supplement_name ?? "") as string,
      supplement_amount: (s.supplement_amount ?? 0) as number,
      per: (s.per ?? "per room per night") as string,
    })),
    created_at: (parentRow.created_at ?? "") as string,
    updated_at: (parentRow.updated_at ?? "") as string,
    is_active: Boolean(parentRow.is_active ?? true),
  };
}

export async function saveHotelRates(
  record: HotelRateRecord,
): Promise<{ id: string }> {
  const supabase = await getActiveSupabaseClient();
  if (!supabase) return { id: record.id ?? crypto.randomUUID() };

  requireNonEmpty(record.hotel_name, "Hotel name is required");
  requireNonEmpty(record.currency, "Currency is required");
  requireNonEmpty(record.contract_name, "Contract name is required");
  requireNonEmpty(record.valid_from, "Valid from is required");
  requireNonEmpty(record.valid_to, "Valid to is required");

  const userId = await requireUserId(
    "Please log in before saving hotel rates.",
  );

  // Resolve FK IDs from names
  const hotelId =
    record.hotel_id || (await resolveHotelId(supabase, record.hotel_name));
  const marketId =
    record.market_id || (await resolveMarketId(supabase, record.market));

  // If editing an existing contract, ensure basic info hasn't changed
  if (record.id) {
    const { data: existing, error: existingError } = await supabase
      .from("hotel_rates")
      .select(
        "hotel_id, market_id, currency, contract_name, valid_from, valid_to",
      )
      .eq("id", record.id)
      .maybeSingle();

    if (existingError) {
      throw new Error(
        `Unable to fetch existing rate contract: ${existingError.message}`,
      );
    }

    if (existing) {
      if (
        existing.hotel_id !== hotelId ||
        (existing.market_id || null) !== (marketId || null) ||
        existing.currency !== record.currency ||
        existing.contract_name !== record.contract_name ||
        existing.valid_from !== record.valid_from ||
        existing.valid_to !== record.valid_to
      ) {
        throw new Error(
          "Cannot modify basic contract information (Hotel, Market, Currency, Contract Name, Valid From, Valid To) once saved.",
        );
      }
    }
  }

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
    foc_count_adults: record.foc_rules?.count_adults ?? true,
    foc_count_child_2_5_99: record.foc_rules?.count_child_2_5_99 ?? false,
    foc_count_child_6_11_99: record.foc_rules?.count_child_6_11_99 ?? false,
    foc_pax_custom_text: record.foc_rules?.pax_custom_text ?? "",
    foc_guide_custom_text: record.foc_rules?.guide_custom_text ?? "",
    created_by: userId,
  };

  const { data: parentData, error: parentError } = await supabase
    .from("hotel_rates")
    .upsert(parentRow, {
      onConflict: "hotel_id,market_id,contract_name,valid_from,valid_to",
    })
    .select("id")
    .single();
  if (parentError)
    throw new Error(`Unable to save hotel rates: ${parentError.message}`);
  const hotelRateId = parentData.id as string;

  // 2. Delete children
  await Promise.all([
    supabase
      .from("hotel_rate_room_prices")
      .delete()
      .eq("hotel_rate_id", hotelRateId),
    supabase
      .from("hotel_rate_child_prices")
      .delete()
      .eq("hotel_rate_id", hotelRateId),
    supabase
      .from("hotel_rate_surcharges")
      .delete()
      .eq("hotel_rate_id", hotelRateId),
    supabase
      .from("hotel_rate_events")
      .delete()
      .eq("hotel_rate_id", hotelRateId),
    supabase
      .from("hotel_rate_guide_prices")
      .delete()
      .eq("hotel_rate_id", hotelRateId),
    supabase
      .from("hotel_rate_room_supplements")
      .delete()
      .eq("hotel_rate_id", hotelRateId),
  ]);

  // 3. Insert children with FK IDs
  const inserts: PromiseLike<unknown>[] = [];

  if (record.room_rates?.length) {
    inserts.push(
      supabase.from("hotel_rate_room_prices").insert(
        record.room_rates.map((r) => ({
          hotel_rate_id: hotelRateId,
          valid_from: r.from,
          valid_to: r.to,
          room_category_id:
            r.room_category_id || catMap.get(r.room_category) || null,
          basis: r.basis,
          sgl: r.sgl || null,
          dbl: r.dbl || null,
          twn: r.twn || null,
          tpl: r.tpl || null,
        })),
      ),
    );
  }

  if (record.child_rates?.length) {
    inserts.push(
      supabase.from("hotel_rate_child_prices").insert(
        record.child_rates.map((r) => ({
          hotel_rate_id: hotelRateId,
          valid_from: r.from,
          valid_to: r.to,
          room_category_id:
            r.room_category_id || catMap.get(r.room_category) || null,
          basis: r.basis,
          age_2_5_99_sharing: r.age_2_5_99_sharing,
          age_2_5_99_extra_bed: r.age_2_5_99_extra_bed,
          age_2_5_99_own_room: r.age_2_5_99_own_room,
          age_6_11_99_sharing: r.age_6_11_99_sharing,
          age_6_11_99_extra_bed: r.age_6_11_99_extra_bed,
          age_6_11_99_own_room: r.age_6_11_99_own_room,
        })),
      ),
    );
  }

  if (record.seasonal_surcharges?.length) {
    inserts.push(
      supabase.from("hotel_rate_surcharges").insert(
        record.seasonal_surcharges.map((s) => ({
          hotel_rate_id: hotelRateId,
          name: s.name,
          amount: s.amount,
          date_from: s.date_from,
          date_to: s.date_to,
          applies_to: s.applies_to,
        })),
      ),
    );
  }

  if (record.compulsory_events?.length) {
    inserts.push(
      supabase.from("hotel_rate_events").insert(
        record.compulsory_events.map((e) => ({
          hotel_rate_id: hotelRateId,
          event_date: e.event_date,
          event_name: e.event_name,
          bb_rate: e.bb_rate,
          hb_rate: e.hb_rate,
          fb_rate: e.fb_rate,
          per: e.per ?? "Person",
          mandatory: e.mandatory ?? true,
        })),
      ),
    );
  }

  const guidePriceRows: Array<{
    hotel_rate_id: string;
    basis: string;
    rate: number | null;
  }> = [];
  if (record.guide_prices?.length) {
    for (const gp of record.guide_prices) {
      if (gp.basis?.trim())
        guidePriceRows.push({
          hotel_rate_id: hotelRateId,
          basis: gp.basis.trim().toUpperCase(),
          rate: gp.rate,
        });
    }
  } else if (record.guide_rates) {
    for (const [basis, rate] of Object.entries(record.guide_rates)) {
      if (basis?.trim())
        guidePriceRows.push({
          hotel_rate_id: hotelRateId,
          basis: basis.trim().toUpperCase(),
          rate,
        });
    }
  }
  if (guidePriceRows.length)
    inserts.push(
      supabase.from("hotel_rate_guide_prices").insert(guidePriceRows).select(),
    );

  if (record.room_supplements?.length) {
    inserts.push(
      supabase
        .from("hotel_rate_room_supplements")
        .insert(
          record.room_supplements
            .filter(
              (s) => s.supplement_name?.trim() && s.supplement_amount != null,
            )
            .map((s) => ({
              hotel_rate_id: hotelRateId,
              room_category_id:
                s.room_category_id || catMap.get(s.room_category) || null,
              supplement_name: s.supplement_name.trim(),
              supplement_amount: Number(s.supplement_amount),
              per: s.per || "per room per night",
            })),
        )
        .select(),
    );
  }

  const results = await Promise.all(inserts);
  for (const res of results as Array<{
    error?: { message: string; details?: string; hint?: string } | null;
  }>) {
    if (res?.error) {
      throw new Error(
        `Failed to save rate details: ${res.error.message}\nDetails: ${res.error.details}\nHint: ${res.error.hint}`,
      );
    }
  }
  return { id: hotelRateId };
}

export async function listHotelRates(
  hotelName?: string,
): Promise<HotelRateRecordSummary[]> {
  const supabase = await getActiveSupabaseClient();
  if (!supabase) return [];

  let query = supabase
    .from("hotel_rates")
    .select(
      "id,hotel_id,market_id,currency,contract_name,valid_from,valid_to,hotels(name),markets(code)",
    )
    .eq("is_active", true)
    .order("valid_from", { ascending: false });

  if (hotelName) {
    // Look up hotel_id by name
    const { data: hotel } = await supabase
      .from("hotels")
      .select("id")
      .ilike("name", hotelName)
      .maybeSingle();
    if (!hotel) return [];
    query = query.eq("hotel_id", hotel.id);
  }

  const { data, error } = await query;
  if (error) throw new Error(`Unable to load hotel rates: ${error.message}`);

  return (data ?? []).map((r: Record<string, unknown>) => ({
    id: r.id as string,
    hotel_name: ((r.hotels as Record<string, unknown> | null)?.name ??
      "") as string,
    market: ((r.markets as Record<string, unknown> | null)?.code ??
      "") as string,
    currency: (r.currency ?? "USD") as string,
    contract_name: (r.contract_name ?? "") as string,
    valid_from: (r.valid_from ?? "") as string,
    valid_to: (r.valid_to ?? "") as string,
  }));
}

export async function getHotelRates(
  hotelRateId: string,
): Promise<HotelRateRecord> {
  const supabase = await getActiveSupabaseClient();
  if (!supabase) throw new Error("Supabase is not configured");

  const { data, error } = await supabase
    .from("hotel_rates")
    .select("*, hotels(name), markets(code)")
    .eq("id", hotelRateId)
    .single();
  if (error) throw new Error(`Unable to load hotel rates: ${error.message}`);

  return assembleHotelRateRecord(supabase, data as Record<string, unknown>);
}

export async function listHotelsFromRates(): Promise<string[]> {
  const supabase = await getActiveSupabaseClient();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("hotel_rates")
    .select("hotel_id, hotels(name)");
  if (error) throw new Error(`Unable to load hotels: ${error.message}`);

  const set = new Set<string>();
  for (const row of (data ?? []) as Array<Record<string, unknown>>) {
    const name = ((row.hotels as Record<string, unknown> | null)?.name ??
      "") as string;
    if (name.trim()) set.add(name);
  }
  return Array.from(set).sort();
}

function calculateFocPersonCount(
  li: VoucherLineItem,
  focRules: HotelRateFocRules | undefined,
): number {
  const countAdults = focRules?.count_adults ?? true;
  const countChild25 = focRules?.count_child_2_5_99 ?? false;
  const countChild611 = focRules?.count_child_6_11_99 ?? false;

  let count = 0;
  if (countAdults) {
    count +=
      Number(li.singleRooms || 0) +
      Number(li.doubleRooms || 0) * 2 +
      Number(li.twinRooms || 0) * 2 +
      Number(li.tripleRooms || 0) * 3;
  }
  if (countChild25) {
    count +=
      Number(li.child2_5 || 0) +
      Number(li.child2_5Sharing || 0) +
      Number(li.child2_5Bed || 0) +
      Number(li.child2_5OwnRoom || 0);
  }
  if (countChild611) {
    count +=
      Number(li.child6_11 || 0) +
      Number(li.child6_11Sharing || 0) +
      Number(li.child6_11Bed || 0) +
      Number(li.child6_11OwnRoom || 0);
  }
  return count;
}

function buildRateApplicableText(
  voucher: VoucherPayload,
  record: HotelRateRecord,
): string {
  const currency = record.currency || "USD";

  if (!voucher.lineItems || voucher.lineItems.length === 0) return "";

  function formatDate(dStr: string) {
    if (!dStr) return "";
    const parts = dStr.split("-");
    if (parts.length === 3) {
      const y = parts[0];
      const m = parseInt(parts[1], 10);
      const d = parseInt(parts[2], 10);
      return `${m}/${d}/${y}`;
    }
    return dStr;
  }

  function formatVal(v: string | null | undefined) {
    if (!v) return null;
    if (v.toUpperCase() === "FOC") return "FOC";
    return isNaN(Number(v)) ? v : `${currency} ${v}`;
  }

  if (voucher.rateStructure === "grouped") {
    const combos: { roomCategory: string; basis: string }[] = [];
    for (const li of voucher.lineItems) {
      const cat = (li.roomCategory || "").trim();
      const basis = (li.basis || "").trim();
      if (!cat) continue;
      if (
        !combos.some(
          (c) =>
            c.roomCategory.toLowerCase() === cat.toLowerCase() &&
            c.basis.toLowerCase() === basis.toLowerCase(),
        )
      ) {
        combos.push({ roomCategory: cat, basis });
      }
    }

    const catBlocks: string[] = [];
    for (const combo of combos) {
      const catUpper = combo.roomCategory.toUpperCase();
      const basisUpper = combo.basis.toUpperCase();

      // Find room rates matching category and basis
      const match = (record.room_rates ?? []).find(
        (r) =>
          r.room_category.toLowerCase() === combo.roomCategory.toLowerCase() &&
          r.basis.toLowerCase() === combo.basis.toLowerCase(),
      );

      const parts: string[] = [];

      // ① Rooms
      const roomParts: string[] = [];
      const hasSgl = voucher.lineItems.some(
        (li) =>
          li.roomCategory.toLowerCase() === combo.roomCategory.toLowerCase() &&
          li.basis.toLowerCase() === combo.basis.toLowerCase() &&
          Number(li.singleRooms || 0) > 0,
      );
      const hasDbl = voucher.lineItems.some(
        (li) =>
          li.roomCategory.toLowerCase() === combo.roomCategory.toLowerCase() &&
          li.basis.toLowerCase() === combo.basis.toLowerCase() &&
          Number(li.doubleRooms || 0) > 0,
      );
      const hasTwn = voucher.lineItems.some(
        (li) =>
          li.roomCategory.toLowerCase() === combo.roomCategory.toLowerCase() &&
          li.basis.toLowerCase() === combo.basis.toLowerCase() &&
          Number(li.twinRooms || 0) > 0,
      );
      const hasTpl = voucher.lineItems.some(
        (li) =>
          li.roomCategory.toLowerCase() === combo.roomCategory.toLowerCase() &&
          li.basis.toLowerCase() === combo.basis.toLowerCase() &&
          Number(li.tripleRooms || 0) > 0,
      );

      if (match) {
        if (hasSgl && match.sgl != null)
          roomParts.push(`Single-${basisUpper} ${currency} ${match.sgl}`);
        if (hasDbl && match.dbl != null)
          roomParts.push(`Double-${basisUpper} ${currency} ${match.dbl}`);
        if (hasTwn && match.twn != null)
          roomParts.push(`Twin-${basisUpper} ${currency} ${match.twn}`);
        if (hasTpl && match.tpl != null)
          roomParts.push(`Triple-${basisUpper} ${currency} ${match.tpl}`);
      }
      if (roomParts.length > 0) {
        parts.push(roomParts.join(" / "));
      }

      // ② Child Rates
      const hasC25Sharing = voucher.lineItems.some(
        (li) =>
          li.roomCategory.toLowerCase() === combo.roomCategory.toLowerCase() &&
          li.basis.toLowerCase() === combo.basis.toLowerCase() &&
          Number(li.child2_5Sharing || 0) > 0,
      );
      const hasC25Bed = voucher.lineItems.some(
        (li) =>
          li.roomCategory.toLowerCase() === combo.roomCategory.toLowerCase() &&
          li.basis.toLowerCase() === combo.basis.toLowerCase() &&
          Number(li.child2_5Bed || 0) > 0,
      );
      const hasC25OwnRoom = voucher.lineItems.some(
        (li) =>
          li.roomCategory.toLowerCase() === combo.roomCategory.toLowerCase() &&
          li.basis.toLowerCase() === combo.basis.toLowerCase() &&
          Number(li.child2_5OwnRoom || 0) > 0,
      );
      const hasC25 = voucher.lineItems.some(
        (li) =>
          li.roomCategory.toLowerCase() === combo.roomCategory.toLowerCase() &&
          li.basis.toLowerCase() === combo.basis.toLowerCase() &&
          (Number(li.child2_5 || 0) > 0 ||
            Number(li.child2_5Sharing || 0) > 0 ||
            Number(li.child2_5Bed || 0) > 0 ||
            Number(li.child2_5OwnRoom || 0) > 0),
      );

      const hasC611Sharing = voucher.lineItems.some(
        (li) =>
          li.roomCategory.toLowerCase() === combo.roomCategory.toLowerCase() &&
          li.basis.toLowerCase() === combo.basis.toLowerCase() &&
          Number(li.child6_11Sharing || 0) > 0,
      );
      const hasC611Bed = voucher.lineItems.some(
        (li) =>
          li.roomCategory.toLowerCase() === combo.roomCategory.toLowerCase() &&
          li.basis.toLowerCase() === combo.basis.toLowerCase() &&
          Number(li.child6_11Bed || 0) > 0,
      );
      const hasC611OwnRoom = voucher.lineItems.some(
        (li) =>
          li.roomCategory.toLowerCase() === combo.roomCategory.toLowerCase() &&
          li.basis.toLowerCase() === combo.basis.toLowerCase() &&
          Number(li.child6_11OwnRoom || 0) > 0,
      );
      const hasC611 = voucher.lineItems.some(
        (li) =>
          li.roomCategory.toLowerCase() === combo.roomCategory.toLowerCase() &&
          li.basis.toLowerCase() === combo.basis.toLowerCase() &&
          (Number(li.child6_11 || 0) > 0 ||
            Number(li.child6_11Sharing || 0) > 0 ||
            Number(li.child6_11Bed || 0) > 0 ||
            Number(li.child6_11OwnRoom || 0) > 0),
      );

      const matchChild = (record.child_rates ?? []).find(
        (r) =>
          r.room_category.toLowerCase() === combo.roomCategory.toLowerCase() &&
          r.basis.toLowerCase() === combo.basis.toLowerCase(),
      );
      if (matchChild) {
        // Child 2-5.99
        if (hasC25) {
          const c25Parts: string[] = [];
          if (hasC25Sharing && matchChild.age_2_5_99_sharing)
            c25Parts.push(
              `Sharing ${formatVal(matchChild.age_2_5_99_sharing)}`,
            );
          if (hasC25Bed && matchChild.age_2_5_99_extra_bed)
            c25Parts.push(`Bed ${formatVal(matchChild.age_2_5_99_extra_bed)}`);
          if (hasC25OwnRoom && matchChild.age_2_5_99_own_room)
            c25Parts.push(
              `Own Room ${formatVal(matchChild.age_2_5_99_own_room)}`,
            );

          // Fallback to showing all if they only filled generic child field
          if (c25Parts.length === 0) {
            if (matchChild.age_2_5_99_sharing)
              c25Parts.push(
                `Sharing ${formatVal(matchChild.age_2_5_99_sharing)}`,
              );
            if (matchChild.age_2_5_99_extra_bed)
              c25Parts.push(
                `Bed ${formatVal(matchChild.age_2_5_99_extra_bed)}`,
              );
            if (matchChild.age_2_5_99_own_room)
              c25Parts.push(
                `Own Room ${formatVal(matchChild.age_2_5_99_own_room)}`,
              );
          }

          if (c25Parts.length > 0) {
            parts.push(`Child (2-5.99 Y) ${c25Parts.join(", ")}`);
          }
        }

        // Child 6-11.99
        if (hasC611) {
          const c611Parts: string[] = [];
          if (hasC611Sharing && matchChild.age_6_11_99_sharing)
            c611Parts.push(
              `Sharing ${formatVal(matchChild.age_6_11_99_sharing)}`,
            );
          if (hasC611Bed && matchChild.age_6_11_99_extra_bed)
            c611Parts.push(
              `Bed ${formatVal(matchChild.age_6_11_99_extra_bed)}`,
            );
          if (hasC611OwnRoom && matchChild.age_6_11_99_own_room)
            c611Parts.push(
              `Own Room ${formatVal(matchChild.age_6_11_99_own_room)}`,
            );

          // Fallback to showing all if they only filled generic child field
          if (c611Parts.length === 0) {
            if (matchChild.age_6_11_99_sharing)
              c611Parts.push(
                `Sharing ${formatVal(matchChild.age_6_11_99_sharing)}`,
              );
            if (matchChild.age_6_11_99_extra_bed)
              c611Parts.push(
                `Bed ${formatVal(matchChild.age_6_11_99_extra_bed)}`,
              );
            if (matchChild.age_6_11_99_own_room)
              c611Parts.push(
                `Own Room ${formatVal(matchChild.age_6_11_99_own_room)}`,
              );
          }

          if (c611Parts.length > 0) {
            parts.push(`Child (6-11.99 Y) ${c611Parts.join(", ")}`);
          }
        }
      }

      // ③ Paid Guide Rate
      const hasPaidGuide = voucher.lineItems.some((li) => {
        const matchesCombo =
          li.roomCategory.toLowerCase() === combo.roomCategory.toLowerCase() &&
          li.basis.toLowerCase() === combo.basis.toLowerCase();
        if (!matchesCombo) return false;

        const hasGuideInLine =
          Number(li.guide || 0) > 0 && li.guideBasis?.trim();
        if (!hasGuideInLine) return false;

        let isGuideFocActiveOnLine = false;
        if (record.foc_rules?.enabled) {
          const dayPax = calculateFocPersonCount(li, record.foc_rules);
          const minPax = record.foc_rules.minimum_persons ?? 0;
          if (minPax > 0 && dayPax >= minPax) {
            const appliesTo = (record.foc_rules.applies_to || "").toLowerCase();
            if (appliesTo.includes("guide")) {
              isGuideFocActiveOnLine = true;
            }
          }
        }
        return !isGuideFocActiveOnLine;
      });
      if (hasPaidGuide && record.guide_rates?.[basisUpper] != null) {
        parts.push(
          `Guide-${basisUpper} ${currency} ${record.guide_rates[basisUpper]}`,
        );
      }

      // ④ Supplements
      const matchSupps = (record.room_supplements ?? []).filter(
        (s) =>
          s.room_category.toLowerCase() === combo.roomCategory.toLowerCase(),
      );
      for (const s of matchSupps) {
        const hasSupp = voucher.lineItems.some(
          (li) =>
            li.roomCategory.toLowerCase() ===
              combo.roomCategory.toLowerCase() &&
            li.basis.toLowerCase() === combo.basis.toLowerCase() &&
            li.supplementary &&
            li.supplementary.some(
              (sp) => sp.toLowerCase() === s.supplement_name.toLowerCase(),
            ),
        );
        if (hasSupp) {
          const sName = s.supplement_name.toLowerCase().includes("supplement")
            ? s.supplement_name
            : `${s.supplement_name} supplement`;
          parts.push(`${sName} ${currency} ${s.supplement_amount} ${s.per}`);
        }
      }

      if (parts.length > 0) {
        catBlocks.push(`${catUpper} (${basisUpper}): ${parts.join(" / ")}  |`);
      }
    }

    // Now build date-wise blocks
    const dateBlocks: string[] = [];
    const dates = Array.from(
      new Set(
        voucher.lineItems
          .map((li) => (li.requiredDate || "").trim())
          .filter(Boolean),
      ),
    ).sort();

    for (const dStr of dates) {
      const dateLines: string[] = [];
      const dayLineItems = voucher.lineItems.filter(
        (li) => (li.requiredDate || "").trim() === dStr,
      );

      // FOC Rules
      if (record.foc_rules?.enabled) {
        for (const li of dayLineItems) {
          const dayPax = calculateFocPersonCount(li, record.foc_rules);
          const minPax = record.foc_rules.minimum_persons ?? 0;
          if (minPax > 0 && dayPax >= minPax) {
            const qty = record.foc_rules.foc_quantity ?? 1;
            const focsOn = record.foc_rules.basis
              ? ` on ${record.foc_rules.basis.split(",").join("/")}`
              : "";
            const appliesTo = (record.foc_rules.applies_to || "").toLowerCase();

            const hasGuideAndBasis =
              Number(li.guide || 0) > 0 && li.guideBasis?.trim();
            const target = hasGuideAndBasis ? "Guide" : "Pax";

            if (appliesTo.includes(target.toLowerCase())) {
              const customText =
                target === "Guide"
                  ? record.foc_rules.guide_custom_text
                  : record.foc_rules.pax_custom_text;
              if (customText?.trim()) {
                dateLines.push(`${customText.trim()}  |`);
              } else {
                dateLines.push(
                  `FOC: ${qty} ${target} FOC${focsOn} when ${minPax}+ persons  |`,
                );
              }
            }
          }
        }
      }

      // Seasonal Surcharges
      for (const s of record.seasonal_surcharges ?? []) {
        if (!s.name || s.amount == null) continue;
        const appTo = (s.applies_to || "").trim().toLowerCase();
        const matchesCategoryBooked = dayLineItems.some(
          (li) =>
            !appTo ||
            appTo === "room" ||
            appTo === "all" ||
            (li.roomCategory || "").trim().toLowerCase() === appTo,
        );
        if (!matchesCategoryBooked) continue;

        if (
          (!s.date_from || dStr >= s.date_from) &&
          (!s.date_to || dStr <= s.date_to)
        ) {
          const appliesToStr = s.applies_to
            ? ` (${s.applies_to})`
            : " per room per night";
          dateLines.push(
            `${s.name} ${currency} ${s.amount}${appliesToStr} (Added to above rates)  |`,
          );
        }
      }

      // Compulsory Events
      for (const ev of record.compulsory_events ?? []) {
        if (!ev.event_name || !ev.mandatory || ev.event_date !== dStr) continue;
        const basesOnDate = Array.from(
          new Set(dayLineItems.map((li) => (li.basis || "").toUpperCase())),
        );
        for (const basis of basesOnDate) {
          const evRate =
            basis === "BB"
              ? ev.bb_rate
              : basis === "HB"
                ? ev.hb_rate
                : (ev.fb_rate ?? ev.hb_rate ?? ev.bb_rate);
          if (evRate != null) {
            dateLines.push(
              `${ev.event_name} (${basis}) ${currency} ${evRate} per ${(ev.per || "person").toLowerCase()} (Added to above rates)  |`,
            );
          }
        }
      }

      if (dateLines.length > 0) {
        const uniqueDateLines = Array.from(new Set(dateLines));
        dateBlocks.push(`${formatDate(dStr)}:\n${uniqueDateLines.join("\n")}`);
      }
    }

    const finalBlocks: string[] = [];
    if (catBlocks.length > 0) {
      finalBlocks.push(catBlocks.join("\n\n"));
    }
    if (dateBlocks.length > 0) {
      finalBlocks.push(dateBlocks.join("\n\n"));
    }
    return finalBlocks.join("\n\n");
  }

  const blocks: string[] = [];

  for (const li of voucher.lineItems) {
    const reqDate = (li.requiredDate || "").trim();
    const catName = (li.roomCategory || "").trim();
    if (!reqDate || !catName) continue;

    const rowLines: string[] = [];

    // ① Room Rates
    const match = (record.room_rates ?? []).find(
      (r) =>
        reqDate >= r.from &&
        reqDate <= r.to &&
        r.room_category.toLowerCase() === catName.toLowerCase() &&
        r.basis.toLowerCase() === (li.basis || "").toLowerCase(),
    );

    const roomParts: string[] = [];
    const basisLabel = (li.basis || "").trim().toUpperCase();
    if (Number(li.singleRooms || 0) > 0 && match?.sgl != null)
      roomParts.push(`Single-${basisLabel} ${currency} ${match.sgl}`);
    if (Number(li.doubleRooms || 0) > 0 && match?.dbl != null)
      roomParts.push(`Double-${basisLabel} ${currency} ${match.dbl}`);
    if (Number(li.twinRooms || 0) > 0 && match?.twn != null)
      roomParts.push(`Twin-${basisLabel} ${currency} ${match.twn}`);
    if (Number(li.tripleRooms || 0) > 0 && match?.tpl != null)
      roomParts.push(`Triple-${basisLabel} ${currency} ${match.tpl}`);

    const catUpper = catName.toUpperCase();
    const roomsStr = roomParts.length > 0 ? roomParts.join(" / ") : "";
    rowLines.push(`${formatDate(reqDate)} - ${catUpper}: ${roomsStr}  |`);

    // ② Child Rates & Age Groups
    const matchChild = (record.child_rates ?? []).find(
      (r) =>
        reqDate >= r.from &&
        reqDate <= r.to &&
        r.room_category.toLowerCase() === catName.toLowerCase() &&
        r.basis.toLowerCase() === (li.basis || "").toLowerCase(),
    );

    if (matchChild) {
      // Child (2-5.99)
      const c25Types = [
        {
          count: Number(li.child2_5Sharing || 0),
          label: "Sharing",
          val: matchChild.age_2_5_99_sharing,
        },
        {
          count: Number(li.child2_5Bed || 0),
          label: "Bed",
          val: matchChild.age_2_5_99_extra_bed,
        },
        {
          count: Number(li.child2_5OwnRoom || 0),
          label: "Own Room",
          val: matchChild.age_2_5_99_own_room,
        },
      ];
      const activeC25 = c25Types.filter((t) => t.count > 0);
      if (activeC25.length > 0) {
        const cParts = activeC25.map((type) => {
          const fv = formatVal(type.val) || "FOC";
          return `${type.label} ${fv}`;
        });
        rowLines.push(`Child (2-5.99 Y) ${cParts.join(" / ")}  |`);
      } else if (Number(li.child2_5 || 0) > 0) {
        const parts = c25Types
          .map((t) =>
            formatVal(t.val) ? `${t.label} ${formatVal(t.val)}` : null,
          )
          .filter(Boolean);
        if (parts.length > 0) {
          rowLines.push(`Child (2-5.99 Y) ${parts.join(" / ")}  |`);
        }
      }

      // Child (6-11.99)
      const c611Types = [
        {
          count: Number(li.child6_11Sharing || 0),
          label: "Sharing",
          val: matchChild.age_6_11_99_sharing,
        },
        {
          count: Number(li.child6_11Bed || 0),
          label: "Bed",
          val: matchChild.age_6_11_99_extra_bed,
        },
        {
          count: Number(li.child6_11OwnRoom || 0),
          label: "Own Room",
          val: matchChild.age_6_11_99_own_room,
        },
      ];
      const activeC611 = c611Types.filter((t) => t.count > 0);
      if (activeC611.length > 0) {
        const cParts = activeC611.map((type) => {
          const fv = formatVal(type.val) || "FOC";
          return `${type.label} ${fv}`;
        });
        rowLines.push(`Child (6-11.99 Y) ${cParts.join(" / ")}  |`);
      } else if (Number(li.child6_11 || 0) > 0) {
        const parts = c611Types
          .map((t) =>
            formatVal(t.val) ? `${t.label} ${formatVal(t.val)}` : null,
          )
          .filter(Boolean);
        if (parts.length > 0) {
          rowLines.push(`Child (6-11.99 Y) ${parts.join(" / ")}  |`);
        }
      }
    }

    // ③ Supplements
    if (li.supplementary && Array.isArray(li.supplementary)) {
      for (const suppName of li.supplementary) {
        const matchSupp = (record.room_supplements ?? []).find(
          (s) =>
            s.room_category.toLowerCase() === catName.toLowerCase() &&
            s.supplement_name.toLowerCase() === suppName.toLowerCase(),
        );
        if (matchSupp) {
          const name = matchSupp.supplement_name
            .toLowerCase()
            .includes("supplement")
            ? matchSupp.supplement_name
            : `${matchSupp.supplement_name} supplement`;
          rowLines.push(
            `${name} ${currency} ${matchSupp.supplement_amount} ${matchSupp.per}  |`,
          );
        } else {
          const name = suppName.toLowerCase().includes("supplement")
            ? suppName
            : `${suppName} supplement`;
          rowLines.push(`${name}  |`);
        }
      }
    }

    // ④ Seasonal Surcharges
    for (const s of record.seasonal_surcharges ?? []) {
      if (!s.name || s.amount == null) continue;
      const appTo = (s.applies_to || "").trim().toLowerCase();
      const isApplicableCategory =
        !appTo ||
        appTo === "room" ||
        appTo === "all" ||
        appTo === catName.toLowerCase();
      if (!isApplicableCategory) continue;

      if (
        (!s.date_from || reqDate >= s.date_from) &&
        (!s.date_to || reqDate <= s.date_to)
      ) {
        const appliesToStr = s.applies_to
          ? ` (${s.applies_to})`
          : " per room per night";
        rowLines.push(
          `${s.name} ${currency} ${s.amount}${appliesToStr} (Added to above rates)  |`,
        );
      }
    }

    // ⑤ Compulsory Events
    for (const ev of record.compulsory_events ?? []) {
      if (!ev.event_name || !ev.mandatory || ev.event_date !== reqDate)
        continue;
      const basis = (li.basis || "").toUpperCase();
      const evRate =
        basis === "BB"
          ? ev.bb_rate
          : basis === "HB"
            ? ev.hb_rate
            : (ev.fb_rate ?? ev.hb_rate ?? ev.bb_rate);
      if (evRate != null) {
        rowLines.push(
          `${ev.event_name} ${currency} ${evRate} per ${(ev.per || "person").toLowerCase()} (Added to above rates)  |`,
        );
      }
    }

    // ⑥ FOC Rule
    const focRules = record.foc_rules;
    let isGuideFocActive = false;

    if (focRules?.enabled) {
      const dayPax = calculateFocPersonCount(li, focRules);
      const minPax = focRules.minimum_persons ?? 0;
      if (minPax > 0 && dayPax >= minPax) {
        const qty = focRules.foc_quantity ?? 1;
        const focsOn = focRules.basis
          ? ` on ${focRules.basis.split(",").join("/")}`
          : "";
        const appliesTo = (focRules.applies_to || "").toLowerCase();

        const hasGuideAndBasis =
          Number(li.guide || 0) > 0 && li.guideBasis?.trim();
        const target = hasGuideAndBasis ? "Guide" : "Pax";

        if (appliesTo.includes(target.toLowerCase())) {
          const customText =
            target === "Guide"
              ? focRules.guide_custom_text
              : focRules.pax_custom_text;
          if (customText?.trim()) {
            rowLines.push(`${customText.trim()}  |`);
          } else {
            rowLines.push(
              `FOC: ${qty} ${target} FOC${focsOn} when ${minPax}+ persons  |`,
            );
          }
          if (target === "Guide") {
            isGuideFocActive = true;
          }
        }
      }
    }

    // ⑦ Paid Guide rate fallback (if Guide FOC was not activated)
    const hasGuideInLine = Number(li.guide || 0) > 0;
    if (hasGuideInLine && li.guideBasis?.trim() && !isGuideFocActive) {
      const gBasis = li.guideBasis.trim().toUpperCase();
      const rate = record.guide_rates?.[gBasis];
      if (rate != null) {
        rowLines.push(`Guide-${gBasis} ${currency} ${rate}  |`);
      }
    }

    if (rowLines.length > 0) {
      blocks.push(rowLines.join("\n"));
    }
  }

  return blocks.join("\n\n");
}

export async function autoFillVoucherFromHotelRates(
  voucher: VoucherPayload,
  hotelRateId?: string,
): Promise<AutoFillResult> {
  const supabase = await getActiveSupabaseClient();
  if (!supabase)
    return {
      status: "no-match",
      warnings: ["Supabase is not configured; auto-fill unavailable."],
    };

  const summaries = await listHotelRates(voucher.hotelName);
  if (summaries.length === 0)
    return {
      status: "no-match",
      warnings: ["No hotel rate data found for this hotel."],
    };

  let record: HotelRateRecord | undefined;

  if (hotelRateId) {
    const candidate = await getHotelRates(hotelRateId);
    if (candidate && candidate.is_active) {
      record = candidate;
    }
  }

  if (!record) {
    const market = (voucher.market || "").trim();
    const ratePeriod = (voucher.ratePeriod || "").trim();
    const firstRequiredDate =
      voucher.lineItems
        .map((li) => li.requiredDate)
        .filter(Boolean)
        .sort()[0] ?? voucher.date;

    if (!ratePeriod)
      return {
        status: "no-match",
        warnings: ["Rate period must be selected manually."],
      };

    const candidates = summaries.filter((s) => {
      const hotelOk =
        s.hotel_name.toLowerCase() === voucher.hotelName.toLowerCase();
      const marketOk = market ? s.market === market || s.market === "" : true;
      const periodOk = s.contract_name === ratePeriod;
      const dateOk =
        firstRequiredDate >= s.valid_from && firstRequiredDate <= s.valid_to;
      return hotelOk && marketOk && periodOk && dateOk;
    });

    if (candidates.length === 0)
      return {
        status: "no-match",
        warnings: [
          "No matching hotel rate record for selected hotel, market, and required date.",
        ],
      };
    if (candidates.length > 1)
      return {
        status: "multiple",
        warnings: [
          "Multiple matching hotel rate records found. Please select one.",
        ],
        candidateHotelRates: candidates,
      };

    record = await getHotelRates(candidates[0].id!);
  }

  const warnings: string[] = [];

  // Warn for any line item with no room rate match
  for (const li of voucher.lineItems) {
    const reqDate = li.requiredDate;
    const cat = (li.roomCategory || "").trim();
    const basis = (li.basis || "").trim();
    if (!reqDate || !cat || !basis) continue;
    const match = (record.room_rates ?? []).find(
      (r) =>
        reqDate >= r.from &&
        reqDate <= r.to &&
        r.room_category.toLowerCase() === cat.toLowerCase() &&
        r.basis.toLowerCase() === basis.toLowerCase(),
    );
    if (!match)
      warnings.push(
        `No matching rate found for ${reqDate} / ${cat} / ${basis}`,
      );
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
  const { error } = await supabase
    .from("hotel_rates")
    .update({ is_active: false })
    .eq("id", hotelRateId);
  if (error) throw new Error(`Unable to delete hotel rate: ${error.message}`);
}

export async function listInactiveHotelRates(): Promise<HotelRateRecord[]> {
  const supabase = await getActiveSupabaseClient();
  if (!supabase) throw new Error("Supabase is not configured");

  const { data, error } = await supabase
    .from("hotel_rates")
    .select("*, hotels(name), markets(code)")
    .eq("is_active", false)
    .order("created_at", { ascending: false });

  if (error)
    throw new Error(`Unable to load inactive hotel rates: ${error.message}`);

  return (data ?? []).map((parentRow) => {
    const hotelName = ((parentRow.hotels as Record<string, unknown> | null)
      ?.name ?? "") as string;
    const marketCode = ((parentRow.markets as Record<string, unknown> | null)
      ?.code ?? "") as string;
    return {
      id: parentRow.id as string,
      hotel_id: parentRow.hotel_id as string,
      hotel_name: hotelName,
      market: marketCode,
      currency: parentRow.currency as string,
      contract_name: parentRow.contract_name as string,
      valid_from: parentRow.valid_from as string,
      valid_to: parentRow.valid_to as string,
    } as HotelRateRecord;
  });
}

export async function restoreHotelRate(hotelRateId: string): Promise<void> {
  const supabase = await getActiveSupabaseClient();
  if (!supabase) throw new Error("Supabase is not configured");
  const { error } = await supabase
    .from("hotel_rates")
    .update({ is_active: true })
    .eq("id", hotelRateId);
  if (error) throw new Error(`Unable to restore hotel rate: ${error.message}`);
}

export async function getAllHotelRates(): Promise<HotelRateRecord[]> {
  const supabase = await getActiveSupabaseClient();
  if (!supabase) throw new Error("Supabase is not configured");

  // 1 query for parents + 6 bulk queries for all children = 7 total (was 1+5N)
  const [
    parentsRes,
    roomPricesRes,
    childPricesRes,
    surchargesRes,
    eventsRes,
    guidePricesRes,
    supplementsRes,
  ] = await Promise.all([
    supabase
      .from("hotel_rates")
      .select("*, hotels(name), markets(code)")
      .eq("is_active", true)
      .order("created_at", { ascending: false }),
    supabase
      .from("hotel_rate_room_prices")
      .select("*, room_categories(name)")
      .order("valid_from"),
    supabase
      .from("hotel_rate_child_prices")
      .select("*, room_categories(name)")
      .order("valid_from"),
    supabase.from("hotel_rate_surcharges").select("*"),
    supabase.from("hotel_rate_events").select("*").order("event_date"),
    supabase.from("hotel_rate_guide_prices").select("*"),
    supabase
      .from("hotel_rate_room_supplements")
      .select("*, room_categories(name)"),
  ]);

  if (parentsRes.error)
    throw new Error(`Unable to load hotel rates: ${parentsRes.error.message}`);

  // Group child rows by hotel_rate_id
  const groupBy = <T extends Record<string, unknown>>(
    rows: T[],
  ): Map<string, T[]> => {
    const map = new Map<string, T[]>();
    for (const row of rows) {
      const key = row.hotel_rate_id as string;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(row);
    }
    return map;
  };

  const roomPricesByRate = groupBy(
    (roomPricesRes.data ?? []) as Array<Record<string, unknown>>,
  );
  const childPricesByRate = groupBy(
    (childPricesRes.data ?? []) as Array<Record<string, unknown>>,
  );
  const surchargesByRate = groupBy(
    (surchargesRes.data ?? []) as Array<Record<string, unknown>>,
  );
  const eventsByRate = groupBy(
    (eventsRes.data ?? []) as Array<Record<string, unknown>>,
  );
  const guidePricesByRate = groupBy(
    (guidePricesRes.data ?? []) as Array<Record<string, unknown>>,
  );
  const supplementsByRate = groupBy(
    (supplementsRes.data ?? []) as Array<Record<string, unknown>>,
  );

  return ((parentsRes.data ?? []) as Array<Record<string, unknown>>).map(
    (parentRow) => {
      const id = parentRow.id as string;
      const hotelName = ((parentRow.hotels as Record<string, unknown> | null)
        ?.name ?? "") as string;
      const marketCode = ((parentRow.markets as Record<string, unknown> | null)
        ?.code ?? "") as string;

      const guideRates: HotelRateGuideRates = {};
      for (const gp of (guidePricesByRate.get(id) ?? []) as Array<{
        basis: string;
        rate: number | null;
      }>) {
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
          room_category: ((r.room_categories as Record<string, unknown> | null)
            ?.name ?? "") as string,
          basis: (r.basis ?? "") as string,
          sgl: r.sgl as number | null,
          dbl: r.dbl as number | null,
          twn: r.twn as number | null,
          tpl: r.tpl as number | null,
        })),
        child_rates: (childPricesByRate.get(id) ?? []).map((r) => ({
          id: r.id as string,
          from: (r.valid_from ?? "") as string,
          to: (r.valid_to ?? "") as string,
          room_category_id: (r.room_category_id ?? "") as string,
          room_category: ((r.room_categories as Record<string, unknown> | null)
            ?.name ?? "") as string,
          basis: (r.basis ?? "") as string,
          age_2_5_99_sharing: r.age_2_5_99_sharing as string | null,
          age_2_5_99_extra_bed: r.age_2_5_99_extra_bed as string | null,
          age_2_5_99_own_room: r.age_2_5_99_own_room as string | null,
          age_6_11_99_sharing: r.age_6_11_99_sharing as string | null,
          age_6_11_99_extra_bed: r.age_6_11_99_extra_bed as string | null,
          age_6_11_99_own_room: r.age_6_11_99_own_room as string | null,
        })),
        seasonal_surcharges: (surchargesByRate.get(id) ?? []).map((s) => ({
          id: s.id as string,
          name: (s.name ?? "") as string,
          amount: s.amount as number | null,
          date_from: (s.date_from ?? null) as string | null,
          date_to: (s.date_to ?? null) as string | null,
          applies_to: (s.applies_to ?? null) as string | null,
        })),
        compulsory_events: (eventsByRate.get(id) ?? []).map((e) => ({
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
        guide_prices: (guidePricesByRate.get(id) ?? []).map((g) => ({
          id: g.id as string,
          basis: (g.basis ?? "") as string,
          rate: g.rate as number | null,
        })),
        room_supplements: (supplementsByRate.get(id) ?? []).map((s) => ({
          id: s.id as string,
          room_category_id: (s.room_category_id ?? "") as string,
          room_category: ((s.room_categories as Record<string, unknown> | null)
            ?.name ?? "") as string,
          supplement_name: (s.supplement_name ?? "") as string,
          supplement_amount: (s.supplement_amount ?? 0) as number,
          per: (s.per ?? "per room per night") as string,
        })),
        created_at: (parentRow.created_at ?? "") as string,
        updated_at: (parentRow.updated_at ?? "") as string,
      } as HotelRateRecord;
    },
  );
}
