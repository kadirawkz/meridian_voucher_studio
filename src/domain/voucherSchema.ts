import { z } from "zod";
import { tourTypes } from "./referenceData";

export const voucherLineItemSchema = z.object({
  requiredDate: z.string().min(1, "Required date is required"),
  roomCategoryId: z.string().optional(),
  roomCategory: z.string().optional().default(""),
  basis: z.string().min(1, "Basis is required"),
  singleRooms: z.coerce.number().int().min(0).default(0),
  doubleRooms: z.coerce.number().int().min(0).default(0),
  twinRooms: z.coerce.number().int().min(0).default(0),
  tripleRooms: z.coerce.number().int().min(0).default(0),
  child2_5: z.coerce.number().int().min(0).default(0),
  child2_5Sharing: z.coerce.number().int().min(0).default(0),
  child2_5Bed: z.coerce.number().int().min(0).default(0),
  child2_5OwnRoom: z.coerce.number().int().min(0).default(0),
  child6_11: z.coerce.number().int().min(0).default(0),
  child6_11Sharing: z.coerce.number().int().min(0).default(0),
  child6_11Bed: z.coerce.number().int().min(0).default(0),
  child6_11OwnRoom: z.coerce.number().int().min(0).default(0),
  guide: z.coerce.number().int().min(0).default(0),
  guideBasis: z.string().optional().default(""),
  arrivingFor: z.string().optional().default(""),
  supplementary: z.array(z.string()).optional().default([])
});

export const voucherSchema = z.object({
  id: z.string().optional(),
  voucherType: z.enum(["reservation", "amendment", "pptp"], {
    errorMap: (issue, ctx) => {
      if (issue.code === "invalid_enum_value") {
        return { message: "Voucher type is required" };
      }
      return { message: ctx.defaultError };
    }
  }),
  tourType: z.string().min(1, "Tour type is required"),
  pageNumber: z.string().min(1, "Page number is required"),
  date: z.string().min(1, "Voucher date is required"),
  voucherTitle: z.string().optional().default(""),
  hotelId: z.string().optional(),
  hotelName: z.string().min(2, "Hotel name is required"),
  marketId: z.string().optional(),
  market: z.string().min(1, "Market selection is required"),
  ratePeriod: z.string().min(1, "Rate period is required"),
  requisitionNo: z.string().min(2, "Requisition number is required"),
  tourNo: z.string().min(2, "Tour number is required"),
  tourName: z.string().min(2, "Tour name is required"),
  customerId: z.string().optional(),
  customerName: z.string().min(2, "Customer is required"),
  confirmedBy: z.string().min(2, "Confirmation contact is required"),
  rateApplicable: z.coerce.number().min(0).optional().default(0),
  employeeName: z.string().min(2, "Employee name is required"),
  employeeEmail: z.string().email("Enter a valid employee email"),
  billingInstructions: z.string().optional(),
  remarks: z.string().optional(),
  lineItems: z.array(voucherLineItemSchema).min(1, "At least one voucher content row is required"),
  matchedHotelRateId: z.string().optional(),
  rateApplicableText: z.string().optional(),
  guideText: z.string().optional(),
  surchargeText: z.string().optional(),
  eventSupplementText: z.string().optional(),
  manuallyEdited: z.boolean().optional().default(false)
});

export type VoucherFormValues = z.infer<typeof voucherSchema>;
