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
    const hasChild0_5 = (lineItem.child0_5 || 0) > 0;
    const hasChild6_12 = (lineItem.child6_12 || 0) > 0;

    const formatValue = (val: string) => (val.includes("%") ? val : `${cur} ${val}`);

    if (hasChild0_5 && childRate.age0_5) {
      parts.push(`Child(0-5)-${mp} ${formatValue(childRate.age0_5)}`);
    }
    if (hasChild6_12 && childRate.age6_12) {
      parts.push(`Child(6-12)-${mp} ${formatValue(childRate.age6_12)}`);
    }
    if ((hasChild0_5 || hasChild6_12) && childRate.extra_bed) {
      parts.push(`Child Extra Bed ${formatValue(childRate.extra_bed)}`);
    }
  }

  return parts.join(" / ");
}

function buildGuideText(): string {
  return "";
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
    if (!text) {
      warnings.push(
        `No matching rate for ${li.roomCategory || "unknown room"} / ${li.basis || "unknown basis"} on ${li.requiredDate || "unknown date"}.`
      );
    } else if (!rateTexts.includes(text)) {
      rateTexts.push(text);
    }
  }

  const surchargeTexts: string[] = [];
  const eventTexts: string[] = [];

  const totalPax = voucher.totalPax ?? 0;
  void totalPax;
  const guideText = buildGuideText();

  return {
    status: "matched",
    warnings,
    matchedHotelRateId: record.id,
    rateApplicableText: rateTexts.join("\n"),
    guideText,
    surchargeText: surchargeTexts.join("\n"),
    eventSupplementText: eventTexts.join("\n"),
    billingInstructions: record.billing_instruction || undefined,
  };
}
