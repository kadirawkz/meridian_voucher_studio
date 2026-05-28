import { VoucherFormValues } from "./voucherSchema";

export function withAccountDefaults(
  values: VoucherFormValues,
  profile: { employeeName: string; employeeEmail: string } | null
): VoucherFormValues {
  if (!profile) {
    return values;
  }

  return {
    ...values,
    employeeName: profile.employeeName || values.employeeName,
    employeeEmail: profile.employeeEmail || values.employeeEmail
  };
}

export function isFormVoucherEqual(
  v1: Partial<VoucherFormValues> | undefined | null,
  v2: Partial<VoucherFormValues> | undefined | null
): boolean {
  if (!v1 || !v2) return false;
  const normalizeStr = (s: unknown) => (typeof s === "string" ? s.trim() : (s as string) || "");
  const normalizeNum = (n: unknown) => Number(n) || 0;
  const normalizeBool = (b: unknown) => !!b;

  if (normalizeStr(v1.voucherType) !== normalizeStr(v2.voucherType)) return false;
  if (normalizeStr(v1.tourType) !== normalizeStr(v2.tourType)) return false;
  if (normalizeStr(v1.pageNumber) !== normalizeStr(v2.pageNumber)) return false;
  if (normalizeStr(v1.date) !== normalizeStr(v2.date)) return false;
  if (normalizeStr(v1.voucherTitle) !== normalizeStr(v2.voucherTitle)) return false;
  if (normalizeStr(v1.hotelName) !== normalizeStr(v2.hotelName)) return false;
  if (normalizeStr(v1.market) !== normalizeStr(v2.market)) return false;
  if (normalizeStr(v1.customerName) !== normalizeStr(v2.customerName)) return false;
  if (normalizeStr(v1.requisitionNo) !== normalizeStr(v2.requisitionNo)) return false;
  if (normalizeStr(v1.tourNo) !== normalizeStr(v2.tourNo)) return false;
  if (normalizeStr(v1.tourName) !== normalizeStr(v2.tourName)) return false;
  if (normalizeStr(v1.confirmedBy) !== normalizeStr(v2.confirmedBy)) return false;
  if (normalizeNum(v1.rateApplicable) !== normalizeNum(v2.rateApplicable)) return false;
  if (normalizeStr(v1.ratePeriod) !== normalizeStr(v2.ratePeriod)) return false;
  if (normalizeStr(v1.billingInstructions) !== normalizeStr(v2.billingInstructions)) return false;
  if (normalizeStr(v1.remarks) !== normalizeStr(v2.remarks)) return false;
  if (normalizeBool(v1.manuallyEdited) !== normalizeBool(v2.manuallyEdited)) return false;
  if (normalizeStr(v1.rateApplicableText) !== normalizeStr(v2.rateApplicableText)) return false;
  if (normalizeStr(v1.guideText) !== normalizeStr(v2.guideText)) return false;
  if (normalizeStr(v1.surchargeText) !== normalizeStr(v2.surchargeText)) return false;
  if (normalizeStr(v1.eventSupplementText) !== normalizeStr(v2.eventSupplementText)) return false;

  const items1 = v1.lineItems || [];
  const items2 = v2.lineItems || [];
  if (items1.length !== items2.length) return false;

  for (let i = 0; i < items1.length; i++) {
    const li1 = items1[i];
    const li2 = items2[i];
    if (normalizeStr(li1.requiredDate) !== normalizeStr(li2.requiredDate)) return false;
    if (normalizeStr(li1.roomCategory) !== normalizeStr(li2.roomCategory)) return false;
    if (normalizeStr(li1.basis) !== normalizeStr(li2.basis)) return false;
    if (normalizeNum(li1.singleRooms) !== normalizeNum(li2.singleRooms)) return false;
    if (normalizeNum(li1.doubleRooms) !== normalizeNum(li2.doubleRooms)) return false;
    if (normalizeNum(li1.twinRooms) !== normalizeNum(li2.twinRooms)) return false;
    if (normalizeNum(li1.tripleRooms) !== normalizeNum(li2.tripleRooms)) return false;
    if (normalizeNum(li1.child2_5) !== normalizeNum(li2.child2_5)) return false;
    if (normalizeNum(li1.child6_11) !== normalizeNum(li2.child6_11)) return false;
    if (normalizeNum(li1.child2_5Sharing) !== normalizeNum(li2.child2_5Sharing)) return false;
    if (normalizeNum(li1.child2_5Bed) !== normalizeNum(li2.child2_5Bed)) return false;
    if (normalizeNum(li1.child2_5OwnRoom) !== normalizeNum(li2.child2_5OwnRoom)) return false;
    if (normalizeNum(li1.child6_11Sharing) !== normalizeNum(li2.child6_11Sharing)) return false;
    if (normalizeNum(li1.child6_11Bed) !== normalizeNum(li2.child6_11Bed)) return false;
    if (normalizeNum(li1.child6_11OwnRoom) !== normalizeNum(li2.child6_11OwnRoom)) return false;
    if (normalizeNum(li1.guide) !== normalizeNum(li2.guide)) return false;
    if (normalizeStr(li1.guideBasis) !== normalizeStr(li2.guideBasis)) return false;
    if (normalizeStr(li1.arrivingFor) !== normalizeStr(li2.arrivingFor)) return false;

    const sup1 = li1.supplementary || [];
    const sup2 = li2.supplementary || [];
    if (sup1.length !== sup2.length) return false;
    const sorted1 = [...sup1].sort();
    const sorted2 = [...sup2].sort();
    for (let j = 0; j < sorted1.length; j++) {
      if (normalizeStr(sorted1[j]) !== normalizeStr(sorted2[j])) return false;
    }
  }

  return true;
}
