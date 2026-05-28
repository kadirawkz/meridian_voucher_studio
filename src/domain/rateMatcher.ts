/**
 * Rate Master ↔ Voucher matching engine and auto-fill builders.
 *
 * This module is pure logic with no I/O dependencies so it can run
 * identically in the renderer (for previews) and in the Electron
 * main process (at generation time).
 */

import type {
  AutoFillResult,
  HotelRateRecord,
  HotelRateRecordSummary,
  VoucherLineItem,
  VoucherPayload,
} from "../../electron/shared/types";

/* ------------------------------------------------------------------ */
/*  Contract matching                                                  */
/* ------------------------------------------------------------------ */

interface MatchSuccess {
  status: "matched";
  record: HotelRateRecord;
}

interface MatchNoResult {
  status: "no-match";
  warning: string;
}

interface MatchMultiple {
  status: "multiple";
  records: HotelRateRecordSummary[];
}

type MatchResult = MatchSuccess | MatchNoResult | MatchMultiple;

export function matchContract(
  voucher: VoucherPayload,
  records: HotelRateRecord[],
  forcedHotelRateId?: string
): MatchResult {
  // If the caller already picked a record, short-circuit
  if (forcedHotelRateId) {
    const forced = records.find((c) => c.id === forcedHotelRateId);
    if (forced) return { status: "matched", record: forced };
    return { status: "no-match", warning: "Selected hotel rate record could not be found." };
  }

  // Step 1 — hotel name (case-insensitive)
  const hotelMatches = records.filter(
    (c) => c.hotel_name.toLowerCase() === voucher.hotelName.toLowerCase()
  );
  if (hotelMatches.length === 0) {
    return {
      status: "no-match",
      warning: "No matching rate found for selected hotel.",
    };
  }

  // Step 2 — market (exact match when provided)
  const marketMatches = voucher.market
    ? hotelMatches.filter((c) => c.market === voucher.market)
    : hotelMatches;

  // Step 3 — contract validity (earliest line-item date)
  const lineDates = voucher.lineItems
    .map((li) => li.requiredDate)
    .filter(Boolean)
    .sort();
  const earliestDate = lineDates[0] ?? voucher.date;

  const validRecords = (marketMatches.length > 0 ? marketMatches : hotelMatches).filter(
    (c) => earliestDate >= c.valid_from && earliestDate <= c.valid_to
  );

  if (validRecords.length === 0) {
    return {
      status: "no-match",
      warning: "Voucher date is outside contract validity period.",
    };
  }

  if (validRecords.length > 1) {
    return {
      status: "multiple",
      records: validRecords.map((c) => ({
        id: c.id!,
        hotel_name: c.hotel_name,
        market: c.market,
        currency: c.currency,
        contract_name: c.contract_name,
        valid_from: c.valid_from,
        valid_to: c.valid_to,
      })),
    };
  }

  return { status: "matched", record: validRecords[0] };
}

/* ------------------------------------------------------------------ */
/*  Auto-fill builders                                                 */
/* ------------------------------------------------------------------ */

function buildRateApplicableText(
  lineItem: VoucherLineItem,
  record: HotelRateRecord
): string {
  const roomCategory = (lineItem.roomCategory || "").toLowerCase();
  const basis = (lineItem.basis || "").toLowerCase();
  const date = lineItem.requiredDate;

  const rate = record.room_rates.find(
    (r) =>
      r.room_category.toLowerCase() === roomCategory &&
      r.basis.toLowerCase() === basis &&
      date >= r.from &&
      date <= r.to
  );

  if (!rate) return "";

  const mp = rate.basis;
  const cur = record.currency;
  const parts: string[] = [];
  if (rate.sgl) parts.push(`Single-${mp} ${cur} ${rate.sgl}`);
  if (rate.dbl) parts.push(`Double-${mp} ${cur} ${rate.dbl}`);
  if (rate.twn) parts.push(`Twin-${mp} ${cur} ${rate.twn}`);
  if (rate.tpl) parts.push(`Triple-${mp} ${cur} ${rate.tpl}`);

  // Find child rates for the same category, basis, and date
  const childRate = (record.child_rates || []).find(
    (cr) =>
      cr.room_category.toLowerCase() === roomCategory &&
      cr.basis.toLowerCase() === basis &&
      date >= cr.from &&
      date <= cr.to
  );

  if (childRate) {
    const hasChild2_5 = (lineItem.child2_5Sharing || 0) + (lineItem.child2_5Bed || 0) + (lineItem.child2_5OwnRoom || 0) > 0;
    const hasChild6_11 = (lineItem.child6_11Sharing || 0) + (lineItem.child6_11Bed || 0) + (lineItem.child6_11OwnRoom || 0) > 0;

    const formatVal = (val: string) => {
      const v = val.trim().toUpperCase();
      if (v === "0" || v === "FOC" || v === "FREE") return "FOC";
      if (v.includes("%")) return v;
      return `${cur} ${val}`;
    };

    const formatGranular = (sharing: string | null | undefined, bed: string | null | undefined, own: string | null | undefined) => {
      const bits = [];
      if (sharing) bits.push(`Sharing ${formatVal(sharing)}`);
      if (bed) bits.push(`Bed ${formatVal(bed)}`);
      if (own) bits.push(`Own Room ${formatVal(own)}`);
      return bits.join(" / ");
    };

    if (hasChild2_5) {
      const summary = formatGranular(childRate.age_2_5_99_sharing, childRate.age_2_5_99_extra_bed, childRate.age_2_5_99_own_room);
      if (summary) parts.push(`Child (2-5.99 Y) ${summary}`);
    }
    if (hasChild6_11) {
      const summary = formatGranular(childRate.age_6_11_99_sharing, childRate.age_6_11_99_extra_bed, childRate.age_6_11_99_own_room);
      if (summary) parts.push(`Child (6-11.99 Y) ${summary}`);
    }
  }

  return parts.join(" / ");
}

function buildGuideText(
  voucher: VoucherPayload,
  record: HotelRateRecord
): string[] {
  const parts: string[] = [];
  const cur = record.currency;
  
  // 1. Check FOC Rules
  let isGuideFocActive = false;
  if (record.foc_rules?.enabled) {
    const countAdults = record.foc_rules.count_adults ?? true;
    const countChild25 = record.foc_rules.count_child_2_5_99 ?? false;
    const countChild611 = record.foc_rules.count_child_6_11_99 ?? false;

    const totalPax = voucher.lineItems.reduce((sum, li) => {
      let count = 0;
      if (countAdults) {
        count += Number(li.singleRooms || 0) + (Number(li.doubleRooms || 0) * 2) + (Number(li.twinRooms || 0) * 2) + (Number(li.tripleRooms || 0) * 3);
      }
      if (countChild25) {
        count += Number(li.child2_5 || 0) + Number(li.child2_5Sharing || 0) + Number(li.child2_5Bed || 0) + Number(li.child2_5OwnRoom || 0);
      }
      if (countChild611) {
        count += Number(li.child6_11 || 0) + Number(li.child6_11Sharing || 0) + Number(li.child6_11Bed || 0) + Number(li.child6_11OwnRoom || 0);
      }
      return sum + count;
    }, 0);
    
    const minPax = record.foc_rules.minimum_persons || 0;
    if (totalPax >= minPax) {
      const qty = record.foc_rules.foc_quantity || 1;
      const basis = record.foc_rules.basis || "HB";
      const appliesTo = (record.foc_rules.applies_to || "").toLowerCase();

      // 1. Evaluate Pax FOC
      if (appliesTo.includes("pax") || appliesTo.includes("both")) {
        const customText = record.foc_rules.pax_custom_text;
        if (customText?.trim()) {
          parts.push(customText.trim());
        } else {
          parts.push(`Pax FOC: ${qty} Pax FOC on ${basis} when ${minPax}+ persons`);
        }
      }

      // 2. Evaluate Guide FOC (only if guide is present)
      const hasGuideAndBasis = voucher.lineItems.some((li) => Number(li.guide || 0) > 0 && li.guideBasis?.trim());
      if (hasGuideAndBasis && (appliesTo.includes("guide") || appliesTo.includes("both"))) {
        const customText = record.foc_rules.guide_custom_text;
        if (customText?.trim()) {
          parts.push(customText.trim());
        } else {
          parts.push(`Guide FOC: ${qty} Guide FOC on ${basis} when ${minPax}+ persons`);
        }
        isGuideFocActive = true;
      }
    }
  }

  // 2. Otherwise show standard Guide Rates if requested (if Guide FOC was not activated)
  if (!isGuideFocActive) {
    const guideBasics = new Set(
      voucher.lineItems
        .filter((li) => (li.guide || 0) > 0 && li.guideBasis?.trim())
        .map((li) => li.guideBasis!.trim().toUpperCase())
    );

    for (const basis of guideBasics) {
      const rate = record.guide_rates?.[basis];
      if (rate != null) {
        parts.push(`Guide-${basis} ${cur} ${rate}`);
      }
    }
  }

  return parts;
}

function buildSurchargeTexts(
  voucher: VoucherPayload,
  record: HotelRateRecord
): string[] {
  const parts: string[] = [];
  const cur = record.currency;
  const lineDates = voucher.lineItems.map((li) => li.requiredDate).filter(Boolean);

  for (const surcharge of record.seasonal_surcharges || []) {
    const isActive = lineDates.some(
      (d) => d >= (surcharge.date_from || "") && d <= (surcharge.date_to || "")
    );
    if (isActive && surcharge.amount) {
      parts.push(`${surcharge.name}: ${cur} ${surcharge.amount} per ${surcharge.applies_to || "room"}`);
    }
  }

  return parts;
}

function buildEventTexts(
  voucher: VoucherPayload,
  record: HotelRateRecord
): string[] {
  const parts: string[] = [];
  const cur = record.currency;
  const lineDates = voucher.lineItems.map((li) => li.requiredDate).filter(Boolean);

  for (const event of record.compulsory_events || []) {
    if (lineDates.includes(event.event_date)) {
      const rates = [];
      if (event.bb_rate) rates.push(`BB ${cur} ${event.bb_rate}`);
      if (event.hb_rate) rates.push(`HB ${cur} ${event.hb_rate}`);
      if (event.fb_rate) rates.push(`FB ${cur} ${event.fb_rate}`);
      
      if (rates.length > 0) {
        parts.push(`${event.event_name} (${event.event_date}): ${rates.join(" / ")} per ${event.per}`);
      }
    }
  }

  return parts;
}

function buildRoomSupplementTexts(
  voucher: VoucherPayload,
  record: HotelRateRecord
): string[] {
  const parts: string[] = [];
  const cur = record.currency;

  if (!record.room_supplements || record.room_supplements.length === 0) {
    return parts;
  }

  // Find which room categories are actually booked on this voucher
  const bookedCategories = new Set(
    voucher.lineItems
      .map((li) => (li.roomCategory || "").trim().toLowerCase())
      .filter(Boolean)
  );

  for (const supplement of record.room_supplements) {
    const supplementCategory = (supplement.room_category || "").trim().toLowerCase();
    
    // Only apply the supplement if the voucher has booked this exact room category
    if (bookedCategories.has(supplementCategory) && supplement.supplement_amount) {
      parts.push(`${supplement.supplement_name} ${cur} ${supplement.supplement_amount} ${supplement.per || "per room per night"}`);
    }
  }

  return parts;
}

/* ------------------------------------------------------------------ */
/*  Orchestrator                                                       */
/* ------------------------------------------------------------------ */

export function autoFillFromContract(
  voucher: VoucherPayload,
  records: HotelRateRecord[],
  forcedHotelRateId?: string
): AutoFillResult {
  const matchResult = matchContract(voucher, records, forcedHotelRateId);

  if (matchResult.status === "no-match") {
    return { status: "no-match", warnings: [matchResult.warning] };
  }

  if (matchResult.status === "multiple") {
    return {
      status: "multiple",
      warnings: ["Multiple matching contracts found. Please select one."],
      candidateHotelRates: matchResult.records,
    };
  }

  const record = matchResult.record;
  const warnings: string[] = [];

  // Rate text per line item (deduplicated)
  const rateTexts: string[] = [];
  for (const li of voucher.lineItems) {
    const text = buildRateApplicableText(li, record);
    if (!text && li.roomCategory) {
      warnings.push(
        `No matching rate for ${li.roomCategory} / ${li.basis || "unknown basis"} on ${li.requiredDate || "unknown date"}.`
      );
    } else if (text && !rateTexts.includes(text)) {
      rateTexts.push(text);
    }
  }

  const surchargeTexts = buildSurchargeTexts(voucher, record);
  const eventTexts = buildEventTexts(voucher, record);
  const roomSupplementTexts = buildRoomSupplementTexts(voucher, record);
  const guideParts = buildGuideText(voucher, record);

  // Combine all into a master rate text for the voucher field
  const finalRateParts = [...rateTexts];
  if (roomSupplementTexts.length > 0) finalRateParts.push(...roomSupplementTexts);
  if (guideParts.length > 0) finalRateParts.push(...guideParts);
  if (surchargeTexts.length > 0) finalRateParts.push(...surchargeTexts);
  if (eventTexts.length > 0) finalRateParts.push(...eventTexts);

  return {
    status: "matched",
    warnings,
    matchedHotelRateId: record.id,
    rateApplicableText: finalRateParts.join(" / "),
    guideText: guideParts.join(" / "),
    surchargeText: surchargeTexts.join(" / "),
    eventSupplementText: eventTexts.join(" / "),
    billingInstructions: record.billing_instruction || undefined,
  };
}
