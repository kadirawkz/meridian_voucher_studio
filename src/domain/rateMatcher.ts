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
  forcedHotelRateId?: string,
): MatchResult {
  // If the caller already picked a record, short-circuit
  if (forcedHotelRateId) {
    const forced = records.find((c) => c.id === forcedHotelRateId);
    if (forced) return { status: "matched", record: forced };
    return {
      status: "no-match",
      warning: "Selected hotel rate record could not be found.",
    };
  }

  // Step 1 — hotel name (case-insensitive)
  const hotelMatches = records.filter(
    (c) => c.hotel_name.toLowerCase() === voucher.hotelName.toLowerCase(),
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

  const validRecords = (
    marketMatches.length > 0 ? marketMatches : hotelMatches
  ).filter((c) => earliestDate >= c.valid_from && earliestDate <= c.valid_to);

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
  record: HotelRateRecord,
): string {
  const roomCategory = (lineItem.roomCategory || "").toLowerCase();
  const basis = (lineItem.basis || "").toLowerCase();
  const date = lineItem.requiredDate;

  const rate = record.room_rates.find(
    (r) =>
      r.room_category.toLowerCase() === roomCategory &&
      r.basis.toLowerCase() === basis &&
      date >= r.from &&
      date <= r.to,
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
      date <= cr.to,
  );

  if (childRate) {
    const hasChild2_5 =
      (lineItem.child2_5Sharing || 0) +
        (lineItem.child2_5Bed || 0) +
        (lineItem.child2_5OwnRoom || 0) >
      0;
    const hasChild6_11 =
      (lineItem.child6_11Sharing || 0) +
        (lineItem.child6_11Bed || 0) +
        (lineItem.child6_11OwnRoom || 0) >
      0;

    const formatVal = (val: string) => {
      const v = val.trim().toUpperCase();
      if (v === "0" || v === "FOC" || v === "FREE") return "FOC";
      if (v.includes("%")) return v;
      return `${cur} ${val}`;
    };

    const formatGranular = (
      sharing: string | null | undefined,
      bed: string | null | undefined,
      own: string | null | undefined,
    ) => {
      const bits = [];
      if (sharing) bits.push(`Sharing ${formatVal(sharing)}`);
      if (bed) bits.push(`Bed ${formatVal(bed)}`);
      if (own) bits.push(`Own Room ${formatVal(own)}`);
      return bits.join(" / ");
    };

    if (hasChild2_5) {
      const summary = formatGranular(
        childRate.age_2_5_99_sharing,
        childRate.age_2_5_99_extra_bed,
        childRate.age_2_5_99_own_room,
      );
      if (summary) parts.push(`Child (2-5.99 Y) ${summary}`);
    }
    if (hasChild6_11) {
      const summary = formatGranular(
        childRate.age_6_11_99_sharing,
        childRate.age_6_11_99_extra_bed,
        childRate.age_6_11_99_own_room,
      );
      if (summary) parts.push(`Child (6-11.99 Y) ${summary}`);
    }
  }

  return parts.join(" / ");
}

function buildGuideText(
  voucher: VoucherPayload,
  record: HotelRateRecord,
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
          parts.push(
            `Pax FOC: ${qty} Pax FOC on ${basis} when ${minPax}+ persons`,
          );
        }
      }

      // 2. Evaluate Guide FOC (only if guide is present)
      const hasGuideAndBasis = voucher.lineItems.some(
        (li) => Number(li.guide || 0) > 0 && li.guideBasis?.trim(),
      );
      if (
        hasGuideAndBasis &&
        (appliesTo.includes("guide") || appliesTo.includes("both"))
      ) {
        const customText = record.foc_rules.guide_custom_text;
        if (customText?.trim()) {
          parts.push(customText.trim());
        } else {
          parts.push(
            `Guide FOC: ${qty} Guide FOC on ${basis} when ${minPax}+ persons`,
          );
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
        .map((li) => li.guideBasis!.trim().toUpperCase()),
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
  record: HotelRateRecord,
): string[] {
  const parts: string[] = [];
  const cur = record.currency;
  const lineDates = voucher.lineItems
    .map((li) => li.requiredDate)
    .filter(Boolean);

  for (const surcharge of record.seasonal_surcharges || []) {
    const appTo = (surcharge.applies_to || "").trim().toLowerCase();
    const hasCategoryMatch = voucher.lineItems.some(
      (li) =>
        !appTo ||
        appTo === "room" ||
        appTo === "all" ||
        (li.roomCategory || "").trim().toLowerCase() === appTo,
    );
    if (!hasCategoryMatch) continue;

    const isActive = lineDates.some(
      (d) => d >= (surcharge.date_from || "") && d <= (surcharge.date_to || ""),
    );
    if (isActive && surcharge.amount) {
      parts.push(
        `${surcharge.name}: ${cur} ${surcharge.amount} per ${surcharge.applies_to || "room"}`,
      );
    }
  }

  return parts;
}

function buildEventTexts(
  voucher: VoucherPayload,
  record: HotelRateRecord,
): string[] {
  const parts: string[] = [];
  const cur = record.currency;
  const lineDates = voucher.lineItems
    .map((li) => li.requiredDate)
    .filter(Boolean);

  for (const event of record.compulsory_events || []) {
    if (lineDates.includes(event.event_date)) {
      const rates = [];
      if (event.bb_rate) rates.push(`BB ${cur} ${event.bb_rate}`);
      if (event.hb_rate) rates.push(`HB ${cur} ${event.hb_rate}`);
      if (event.fb_rate) rates.push(`FB ${cur} ${event.fb_rate}`);

      if (rates.length > 0) {
        parts.push(
          `${event.event_name} (${event.event_date}): ${rates.join(" / ")} per ${event.per}`,
        );
      }
    }
  }

  return parts;
}

function buildRoomSupplementTexts(
  voucher: VoucherPayload,
  record: HotelRateRecord,
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
      .filter(Boolean),
  );

  for (const supplement of record.room_supplements) {
    const supplementCategory = (supplement.room_category || "")
      .trim()
      .toLowerCase();

    // Only apply the supplement if the voucher has booked this exact room category
    if (
      bookedCategories.has(supplementCategory) &&
      supplement.supplement_amount
    ) {
      parts.push(
        `${supplement.supplement_name} ${cur} ${supplement.supplement_amount} ${supplement.per || "per room per night"}`,
      );
    }
  }

  return parts;
}

/* ------------------------------------------------------------------ */
/*  Orchestrator                                                       */
/* ------------------------------------------------------------------ */

function calculateFocPersonCount(
  li: VoucherLineItem,
  focRules: {
    count_adults?: boolean;
    count_child_2_5_99?: boolean;
    count_child_6_11_99?: boolean;
  } | null | undefined,
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

function buildGroupedRateApplicableText(
  voucher: VoucherPayload,
  record: HotelRateRecord,
): string {
  const currency = record.currency || "USD";

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

  const formatVal = (val: string | null | undefined) => {
    if (!val) return "";
    const v = val.trim().toUpperCase();
    if (v === "0" || v === "FOC" || v === "FREE") return "FOC";
    if (v.includes("%")) return v;
    return `${currency} ${val}`;
  };

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
      if (hasSgl && match.sgl != null) roomParts.push(`Single-${basisUpper} ${currency} ${match.sgl}`);
      if (hasDbl && match.dbl != null) roomParts.push(`Double-${basisUpper} ${currency} ${match.dbl}`);
      if (hasTwn && match.twn != null) roomParts.push(`Twin-${basisUpper} ${currency} ${match.twn}`);
      if (hasTpl && match.tpl != null) roomParts.push(`Triple-${basisUpper} ${currency} ${match.tpl}`);
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
        if (hasC25Sharing && matchChild.age_2_5_99_sharing) c25Parts.push(`Sharing ${formatVal(matchChild.age_2_5_99_sharing)}`);
        if (hasC25Bed && matchChild.age_2_5_99_extra_bed) c25Parts.push(`Bed ${formatVal(matchChild.age_2_5_99_extra_bed)}`);
        if (hasC25OwnRoom && matchChild.age_2_5_99_own_room) c25Parts.push(`Own Room ${formatVal(matchChild.age_2_5_99_own_room)}`);

        // Fallback to showing all if they only filled generic child field
        if (c25Parts.length === 0) {
          if (matchChild.age_2_5_99_sharing) c25Parts.push(`Sharing ${formatVal(matchChild.age_2_5_99_sharing)}`);
          if (matchChild.age_2_5_99_extra_bed) c25Parts.push(`Bed ${formatVal(matchChild.age_2_5_99_extra_bed)}`);
          if (matchChild.age_2_5_99_own_room) c25Parts.push(`Own Room ${formatVal(matchChild.age_2_5_99_own_room)}`);
        }

        if (c25Parts.length > 0) {
          parts.push(`Child (2-5.99 Y) ${c25Parts.join(", ")}`);
        }
      }

      // Child 6-11.99
      if (hasC611) {
        const c611Parts: string[] = [];
        if (hasC611Sharing && matchChild.age_6_11_99_sharing) c611Parts.push(`Sharing ${formatVal(matchChild.age_6_11_99_sharing)}`);
        if (hasC611Bed && matchChild.age_6_11_99_extra_bed) c611Parts.push(`Bed ${formatVal(matchChild.age_6_11_99_extra_bed)}`);
        if (hasC611OwnRoom && matchChild.age_6_11_99_own_room) c611Parts.push(`Own Room ${formatVal(matchChild.age_6_11_99_own_room)}`);

        // Fallback to showing all if they only filled generic child field
        if (c611Parts.length === 0) {
          if (matchChild.age_6_11_99_sharing) c611Parts.push(`Sharing ${formatVal(matchChild.age_6_11_99_sharing)}`);
          if (matchChild.age_6_11_99_extra_bed) c611Parts.push(`Bed ${formatVal(matchChild.age_6_11_99_extra_bed)}`);
          if (matchChild.age_6_11_99_own_room) c611Parts.push(`Own Room ${formatVal(matchChild.age_6_11_99_own_room)}`);
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

      const hasGuideInLine = Number(li.guide || 0) > 0 && li.guideBasis?.trim();
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
      parts.push(`Guide-${basisUpper} ${currency} ${record.guide_rates[basisUpper]}`);
    }

    // ④ Supplements
    const matchSupps = (record.room_supplements ?? []).filter(
      (s) => s.room_category.toLowerCase() === combo.roomCategory.toLowerCase(),
    );
    for (const s of matchSupps) {
      const hasSupp = voucher.lineItems.some(
        (li) =>
          li.roomCategory.toLowerCase() === combo.roomCategory.toLowerCase() &&
          li.basis.toLowerCase() === combo.basis.toLowerCase() &&
          li.supplementary &&
          li.supplementary.some((sp) => sp.toLowerCase() === s.supplement_name.toLowerCase()),
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
    new Set(voucher.lineItems.map((li) => (li.requiredDate || "").trim()).filter(Boolean)),
  ).sort();

  for (const dStr of dates) {
    const dateLines: string[] = [];
    const dayLineItems = voucher.lineItems.filter((li) => (li.requiredDate || "").trim() === dStr);

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

          const hasGuideAndBasis = Number(li.guide || 0) > 0 && li.guideBasis?.trim();
          const target = hasGuideAndBasis ? "Guide" : "Pax";

          if (appliesTo.includes(target.toLowerCase())) {
            const customText =
              target === "Guide"
                ? record.foc_rules.guide_custom_text
                : record.foc_rules.pax_custom_text;
            if (customText?.trim()) {
              dateLines.push(`${customText.trim()}  |`);
            } else {
              dateLines.push(`FOC: ${qty} ${target} FOC${focsOn} when ${minPax}+ persons  |`);
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

      if ((!s.date_from || dStr >= s.date_from) && (!s.date_to || dStr <= s.date_to)) {
        const appliesToStr = s.applies_to ? ` (${s.applies_to})` : " per room per night";
        dateLines.push(`${s.name} ${currency} ${s.amount}${appliesToStr} (Added to above rates)  |`);
      }
    }

    // Compulsory Events
    for (const ev of record.compulsory_events ?? []) {
      if (!ev.event_name || !ev.mandatory || ev.event_date !== dStr) continue;
      const basesOnDate = Array.from(new Set(dayLineItems.map((li) => (li.basis || "").toUpperCase())));
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

export function autoFillFromContract(
  voucher: VoucherPayload,
  records: HotelRateRecord[],
  forcedHotelRateId?: string,
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

  const surchargeTexts = buildSurchargeTexts(voucher, record);
  const eventTexts = buildEventTexts(voucher, record);
  const roomSupplementTexts = buildRoomSupplementTexts(voucher, record);
  const guideParts = buildGuideText(voucher, record);

  let finalRateText = "";

  if (voucher.rateStructure === "grouped") {
    finalRateText = buildGroupedRateApplicableText(voucher, record);
  } else {
    // Rate text per line item (deduplicated)
    const rateTexts: string[] = [];
    for (const li of voucher.lineItems) {
      const text = buildRateApplicableText(li, record);
      if (!text && li.roomCategory) {
        warnings.push(
          `No matching rate for ${li.roomCategory} / ${li.basis || "unknown basis"} on ${li.requiredDate || "unknown date"}.`,
        );
      } else if (text && !rateTexts.includes(text)) {
        rateTexts.push(text);
      }
    }

    const finalRateParts = [...rateTexts];
    if (roomSupplementTexts.length > 0)
      finalRateParts.push(...roomSupplementTexts);
    if (guideParts.length > 0) finalRateParts.push(...guideParts);
    if (surchargeTexts.length > 0) finalRateParts.push(...surchargeTexts);
    if (eventTexts.length > 0) finalRateParts.push(...eventTexts);
    finalRateText = finalRateParts.join(" / ");
  }

  return {
    status: "matched",
    warnings,
    matchedHotelRateId: record.id,
    rateApplicableText: finalRateText,
    guideText: guideParts.join(" / "),
    surchargeText: surchargeTexts.join(" / "),
    eventSupplementText: eventTexts.join(" / "),
    billingInstructions: record.billing_instruction || undefined,
  };
}
