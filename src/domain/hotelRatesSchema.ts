import { z } from "zod";

export const hotelRateRoomRateSchema = z.object({
  from: z.string().min(1),
  to: z.string().min(1),
  room_category: z.string().min(1),
  basis: z.string().min(1),
  sgl: z.number().nullable().optional(),
  dbl: z.number().nullable().optional(),
  twn: z.number().nullable().optional(),
  tpl: z.number().nullable().optional(),
});

export const hotelRateRecordSchema = z.object({
  id: z.string().uuid().optional(),
  hotel_name: z.string().min(1),
  market: z.string().min(1),
  currency: z.string().min(1),
  contract_name: z.string().min(1),
  valid_from: z.string().min(1),
  valid_to: z.string().min(1),
  room_rates: z.array(hotelRateRoomRateSchema).default([]),
  seasonal_surcharges: z.array(z.record(z.unknown())).default([]),
  compulsory_events: z.array(z.record(z.unknown())).default([]),
  guide_rates: z.record(z.unknown()).default({}),
  foc_rules: z.record(z.unknown()).default({}),
  billing_instruction: z.string().default(""),
  skipped_sections: z.array(z.string()).default([]),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
});

export type HotelRateRecordInput = z.input<typeof hotelRateRecordSchema>;
export type HotelRateRecordValue = z.output<typeof hotelRateRecordSchema>;

/**
 * Minimal JSON schema representation for documentation/export use.
 * (We keep this dependency-free; strict runtime validation uses Zod above.)
 */
export const hotelRateJsonSchema = {
  type: "object",
  required: ["hotel_name", "market", "currency", "contract_name", "valid_from", "valid_to"],
  properties: {
    id: { type: "string", format: "uuid" },
    hotel_name: { type: "string" },
    market: { type: "string" },
    currency: { type: "string" },
    contract_name: { type: "string" },
    valid_from: { type: "string", format: "date" },
    valid_to: { type: "string", format: "date" },
    room_rates: { type: "array", items: { type: "object" } },
    seasonal_surcharges: { type: "array", items: { type: "object" } },
    compulsory_events: { type: "array", items: { type: "object" } },
    guide_rates: { type: "object" },
    foc_rules: { type: "object" },
    billing_instruction: { type: "string" },
    skipped_sections: { type: "array", items: { type: "string" } },
    created_at: { type: "string" },
    updated_at: { type: "string" },
  },
  additionalProperties: false,
} as const;
