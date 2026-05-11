import type {
  AutoFillResult,
  HotelRateGuideRates,
  HotelRateRecord,
  HotelRateRecordSummary,
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

function buildGuideText(voucher: VoucherPayload, currency: string, guideRates?: HotelRateGuideRates | null): string {
  if (!guideRates) {
    return "";
  }

  const summaries: string[] = [];
  const seen = new Set<string>();

  for (const lineItem of voucher.lineItems) {
    const guideCount = Number(lineItem.guide || 0);
    const basis = (lineItem.guideBasis || "").trim().toUpperCase();

    if (guideCount <= 0 || !basis) {
      continue;
    }

    const amount = guideRates[basis];
    if (amount == null) {
      continue;
    }

    const summary = `Guide-${basis} ${currency} ${amount}`;
    if (!seen.has(summary)) {
      seen.add(summary);
      summaries.push(summary);
    }
  }

  return summaries.join(" / ");
}

export async function saveHotelRates(record: HotelRateRecord): Promise<{ id: string }> {
  const supabase = await getActiveSupabaseClient();
  if (!supabase) return { id: record.id ?? crypto.randomUUID() };

  requireNonEmpty(record.hotel_name, "Hotel name is required");
  requireNonEmpty(record.market, "Market is required");
  requireNonEmpty(record.currency, "Currency is required");
  requireNonEmpty(record.contract_name, "Contract name is required");
  requireNonEmpty(record.valid_from, "Valid from is required");
  requireNonEmpty(record.valid_to, "Valid to is required");

  const userId = await requireUserId("Please log in before saving hotel rates.");

  const row = {
    id: record.id || undefined,
    hotel_name: record.hotel_name,
    market: record.market,
    currency: record.currency,
    contract_name: record.contract_name,
    valid_from: record.valid_from,
    valid_to: record.valid_to,
    room_rates: record.room_rates ?? [],
    seasonal_surcharges: record.seasonal_surcharges ?? [],
    compulsory_events: record.compulsory_events ?? [],
    guide_rates: record.guide_rates ?? {},
    foc_rules: record.foc_rules ?? { enabled: false },
    billing_instruction: record.billing_instruction ?? "",
    cancellation_policy: record.cancellation_policy ?? {},
    voucher_text_rules: record.voucher_text_rules ?? {},
    skipped_sections: record.skipped_sections ?? [],
    created_by: userId,
  };

  const { data, error } = await supabase.from("hotel_rates").upsert(row).select("id").single();
  if (error) throw new Error(`Unable to save hotel rates: ${error.message}`);
  return { id: data.id as string };
}

export async function listHotelRates(hotelName?: string): Promise<HotelRateRecordSummary[]> {
  const supabase = await getActiveSupabaseClient();
  if (!supabase) return [];

  let query = supabase
    .from("hotel_rates")
    .select("id,hotel_name,market,currency,contract_name,valid_from,valid_to")
    .order("hotel_name")
    .order("valid_from", { ascending: false });

  if (hotelName) {
    query = query.ilike("hotel_name", hotelName);
  }

  const { data, error } = await query;
  if (error) throw new Error(`Unable to load hotel rates: ${error.message}`);

  return (data ?? []).map((r: Record<string, unknown>) => ({
    id: r.id as string,
    hotel_name: (r.hotel_name ?? "") as string,
    market: (r.market ?? "") as string,
    currency: (r.currency ?? "USD") as string,
    contract_name: (r.contract_name ?? "") as string,
    valid_from: (r.valid_from ?? "") as string,
    valid_to: (r.valid_to ?? "") as string,
  }));
}

export async function getHotelRates(hotelRateId: string): Promise<HotelRateRecord> {
  const supabase = await getActiveSupabaseClient();
  if (!supabase) throw new Error("Supabase is not configured");

  const { data, error } = await supabase.from("hotel_rates").select("*").eq("id", hotelRateId).single();
  if (error) throw new Error(`Unable to load hotel rates: ${error.message}`);

  return data as HotelRateRecord;
}

export async function listHotelsFromRates(): Promise<string[]> {
  const supabase = await getActiveSupabaseClient();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("hotel_rates")
    .select("hotel_name")
    .order("hotel_name");

  if (error) throw new Error(`Unable to load hotels: ${error.message}`);

  const set = new Set<string>();
  for (const row of data ?? []) {
    const name = (row as { hotel_name?: string }).hotel_name ?? "";
    if (name.trim()) set.add(name);
  }
  return Array.from(set);
}

export async function autoFillVoucherFromHotelRates(voucher: VoucherPayload, hotelRateId?: string): Promise<AutoFillResult> {
  const supabase = await getActiveSupabaseClient();
  if (!supabase) {
    return { status: "no-match", warnings: ["Supabase is not configured; auto-fill unavailable."] };
  }

  const summaries = await listHotelRates(voucher.hotelName);
  if (summaries.length === 0) {
    return { status: "no-match", warnings: ["No hotel rate data found for this hotel."] };
  }

  let record: HotelRateRecord | undefined;

  if (hotelRateId) {
    record = await getHotelRates(hotelRateId);
  } else {
    const market = (voucher.market || "").trim();
    const ratePeriod = (voucher.ratePeriod || "").trim();
    const firstRequiredDate = voucher.lineItems.map((li) => li.requiredDate).filter(Boolean).sort()[0] ?? voucher.date;

    if (!ratePeriod) {
      return {
        status: "no-match",
        warnings: ["Rate period must be selected manually."],
      };
    }

    const candidates = summaries.filter((s) => {
      const hotelOk = s.hotel_name.toLowerCase() === voucher.hotelName.toLowerCase();
      const marketOk = market ? (s.market === market || s.market === "") : true;
      const periodOk = s.contract_name === ratePeriod;
      const dateOk = firstRequiredDate >= s.valid_from && firstRequiredDate <= s.valid_to;
      return hotelOk && marketOk && periodOk && dateOk;
    });

    if (candidates.length === 0) {
      return {
        status: "no-match",
        warnings: ["No matching hotel rate record for selected hotel, market, and required date."],
      };
    }

    if (candidates.length > 1) {
      return {
        status: "multiple",
        warnings: ["Multiple matching hotel rate records found. Please select one."],
        candidateHotelRates: candidates,
      };
    }

    record = await getHotelRates(candidates[0].id!);
  }

  const currency = record.currency || "USD";
  const warnings: string[] = [];

  // Track room types used across the entire tour
  const usedTypes = {
    sgl: false,
    dbl: false,
    twn: false,
    tpl: false
  };

  // Track rates found for each type to build unique summary
  const typeRates: Record<string, Set<string>> = {
    SGL: new Set(),
    DBL: new Set(),
    TWN: new Set(),
    TPL: new Set()
  };

  const basisUsed: Set<string> = new Set();

  for (const li of voucher.lineItems) {
    const dailyPax = (Number(li.singleRooms || 0) * 1) +
                     (Number(li.doubleRooms || 0) * 2) +
                     (Number(li.twinRooms || 0) * 2) +
                     (Number(li.tripleRooms || 0) * 3);
    
    if (dailyPax > 0) {
      if (Number(li.singleRooms || 0) > 0) usedTypes.sgl = true;
      if (Number(li.doubleRooms || 0) > 0) usedTypes.dbl = true;
      if (Number(li.twinRooms || 0) > 0) usedTypes.twn = true;
      if (Number(li.tripleRooms || 0) > 0) usedTypes.tpl = true;
    }

    const requiredDate = li.requiredDate;
    const roomCategory = (li.roomCategory || "").trim();
    const basis = (li.basis || "").trim();

    if (!requiredDate || !roomCategory || !basis) continue;
    basisUsed.add(basis.toUpperCase());

    const match = (record.room_rates ?? []).find((r) => {
      return (
        requiredDate >= r.from &&
        requiredDate <= r.to &&
        r.room_category.toLowerCase() === roomCategory.toLowerCase() &&
        r.basis.toLowerCase() === basis.toLowerCase()
      );
    });

    if (match) {
      if (Number(li.singleRooms || 0) > 0 && match.sgl != null) typeRates.SGL.add(match.sgl.toString());
      if (Number(li.doubleRooms || 0) > 0 && match.dbl != null) typeRates.DBL.add(match.dbl.toString());
      if (Number(li.twinRooms || 0) > 0 && match.twn != null) typeRates.TWN.add(match.twn.toString());
      if (Number(li.tripleRooms || 0) > 0 && match.tpl != null) typeRates.TPL.add(match.tpl.toString());
    } else {
      warnings.push(`No matching rate found for ${requiredDate} / ${roomCategory} / ${basis}`);
    }
  }

  // Build Rate Applicable summary
  const summaryParts: string[] = [];
  const basisLabel = Array.from(basisUsed).join("/");

  if (usedTypes.sgl && typeRates.SGL.size > 0) {
    summaryParts.push(`Single-${basisLabel} ${currency} ${Array.from(typeRates.SGL).join(" & ")}`);
  }
  if (usedTypes.dbl && typeRates.DBL.size > 0) {
    summaryParts.push(`Double-${basisLabel} ${currency} ${Array.from(typeRates.DBL).join(" & ")}`);
  }
  if (usedTypes.twn && typeRates.TWN.size > 0) {
    summaryParts.push(`Twin-${basisLabel} ${currency} ${Array.from(typeRates.TWN).join(" & ")}`);
  }
  if (usedTypes.tpl && typeRates.TPL.size > 0) {
    summaryParts.push(`Triple-${basisLabel} ${currency} ${Array.from(typeRates.TPL).join(" & ")}`);
  }



  return {
    status: "matched",
    warnings,
    matchedHotelRateId: record.id,
    rateApplicableText: summaryParts.join(" / ") || "No matching rates found.",
    guideText: buildGuideText(voucher, currency, record.guide_rates),
    billingInstructions: record.billing_instruction || undefined,
    cancellationText: record.cancellation_policy ? JSON.stringify(record.cancellation_policy, null, 2) : undefined,
    autoTextNotes: record.voucher_text_rules ? JSON.stringify(record.voucher_text_rules, null, 2) : undefined,
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

  const { data, error } = await supabase.from("hotel_rates").select("*").order("hotel_name");
  if (error) throw new Error(`Unable to load hotel rates: ${error.message}`);

  return data as HotelRateRecord[];
}
