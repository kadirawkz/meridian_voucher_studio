/**
 * Seed data generator — creates hotel_rates records for all hotels.
 *
 * Run via: POST /api/rate-master/seed
 */

import type { HotelRateRecord } from "../../shared/types.js";
import { listHotelRates, saveHotelRates } from "./hotelRates.js";

const hotels = [
  "Heritance Kandalama - Dambulla",
  "Galle Face Hotel - Colombo",
];

/* Deterministic rate ranges per hotel "tier" */
const tiers: Record<string, { base: number; label: string }> = {
  budget:  { base: 45, label: "Budget" },
  mid:     { base: 75, label: "Mid-Range" },
  premium: { base: 110, label: "Premium" },
  luxury:  { base: 170, label: "Luxury" },
};

function tierForHotel(name: string): keyof typeof tiers {
  const n = name.toLowerCase();
  if (n.includes("shangri") || n.includes("marriott") || n.includes("taj") || n.includes("hilton") || n.includes("kahanda"))
    return "luxury";
  if (n.includes("cinnamon") || n.includes("galle face") || n.includes("jetwing") || n.includes("riu") || n.includes("tintagel"))
    return "premium";
  if (n.includes("villa") || n.includes("marino") || n.includes("heritance") || n.includes("sigiriya"))
    return "mid";
  return "budget";
}

const roomTypes = ["Standard Room", "Deluxe Room", "Suite Room", "Superior Room"];
const mealPlans = ["BB", "HB", "FB"];

function buildHotelRateRecord(args: { hotelName: string; index: number; market: string; contractName: string }): HotelRateRecord {
  const { hotelName, index, market, contractName } = args;
  const t = tiers[tierForHotel(hotelName)];
  const base = t.base + (index % 7) * 3; // slight variation per hotel

  const room_rates: HotelRateRecord["room_rates"] = [];
  for (const roomType of roomTypes) {
    const roomMult = roomType === "Standard Room" ? 1.0
      : roomType === "Deluxe Room" ? 1.15
      : roomType === "Suite Room" ? 1.6
      : 1.25; // Superior

    for (const mealPlan of mealPlans) {
      const mealMult = mealPlan === "BB" ? 1.0 : mealPlan === "HB" ? 1.15 : 1.35;
      const sgl = Math.round(base * roomMult * mealMult);
      const dbl = Math.round(sgl * 1.12);
      const twn = dbl;
      const tpl = Math.round(sgl * 1.35);

      room_rates.push({
        from: "2025-11-01",
        to: "2027-04-30",
        room_category: roomType,
        basis: mealPlan,
        sgl,
        dbl,
        twn,
        tpl,
      });
    }
  }


  return {
    hotel_name: hotelName,
    market,
    currency: "USD",
    contract_name: contractName,
    valid_from: "2025-11-01",
    valid_to: "2027-04-30",
    room_rates,
    seasonal_surcharges: [
      {
        name: "Peak Season Surcharge",
        amount: Math.round(base * 0.18),
        date_from: "2026-12-20",
        date_to: "2027-01-05",
        applies_to: "All Room Categories",
        rule: "Per Room Per Night",
      },
    ],
    compulsory_events: [
      { event_date: "2026-12-24", event_name: "Christmas Eve Gala Dinner", bb_rate: Math.round(base * 0.55), hb_rate: Math.round(base * 0.45), fb_rate: Math.round(base * 0.50), per: "Person", mandatory: true },
      { event_date: "2026-12-31", event_name: "New Year's Eve Gala Dinner", bb_rate: Math.round(base * 0.55), hb_rate: Math.round(base * 0.45), fb_rate: Math.round(base * 0.50), per: "Person", mandatory: true },
    ],
    foc_rules: {
      enabled: true,
      applies_to: "Guide",
      minimum_persons: 15,
      foc_quantity: 1,
      basis: "BB",
    },
    billing_instruction: "Please bill to Meridian Travels and Tours.",
    cancellation_policy: {
      "Release Days": "21 Days Prior",
      "Within 20 Days": "50% Charge",
      "Within 14 Days": "100% Charge",
      "No Show": "100% Charge",
    },
    voucher_text_rules: {
      "VAT Details": "All rates include VAT and local taxes.",
      "Market Notes": "Valid only for the specified market.",
    },
    skipped_sections: [],
  };
}

export async function seedAllHotelContracts(): Promise<{ seeded: number; ids: string[] }> {
  const ids: string[] = [];

  for (let i = 0; i < hotels.length; i++) {
    const hotelName = hotels[i];
    const marketsToSeed = ["GERMAN", "LOCAL"];
    const contractNames = ["Winter 25/26", "Summer 2026"];
    const existing = await listHotelRates(hotelName);

    for (const market of marketsToSeed) {
      const contractName = contractNames[(i + (market === "LOCAL" ? 1 : 0)) % contractNames.length];
      const record = buildHotelRateRecord({ hotelName, index: i, market, contractName });
      const matched = existing.find(
        (item) =>
          item.hotel_name === hotelName &&
          item.market === market &&
          item.contract_name === contractName &&
          item.valid_from === record.valid_from &&
          item.valid_to === record.valid_to
      );
      if (matched?.id) {
        record.id = matched.id;
      }
      const result = await saveHotelRates(record);
      ids.push(result.id);
    }
  }

  return { seeded: ids.length, ids };
}
