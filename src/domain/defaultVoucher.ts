import type { VoucherFormValues } from "./voucherSchema";

export const defaultVoucher: VoucherFormValues = {
  voucherType: "reservation",
  tourType: "" as unknown as VoucherFormValues["tourType"],
  pageNumber: "1",
  date: new Date().toISOString().slice(0, 10),
  voucherTitle: "",
  hotelName: "",
  market: "",
  ratePeriod: "",
  requisitionNo: "REQ-0000",
  tourNo: "T/000",
  tourName: "",
  customerName: "",
  confirmedBy: "",
  rateApplicable: 0,
  employeeName: "",
  employeeEmail: "",
  billingInstructions:
    "",
  remarks: "",
  matchedHotelRateId: undefined,
  rateApplicableText: "",
  surchargeText: "",
  eventSupplementText: "",
  cancellationText: "",
  autoTextNotes: "",
  manuallyEdited: false,
  lineItems: [
    {
      requiredDate: "",
      roomCategory: "",
      basis: "",
      singleRooms: 0,
      doubleRooms: 0,
      twinRooms: 0,
      tripleRooms: 0,
      arrivingFor: ""
    }
  ]
};
