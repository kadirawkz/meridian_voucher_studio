/**
 * Rate Master ↔ Voucher matching engine and auto-fill builders.
 *
 * This module is pure logic with no I/O dependencies so it can run
 * identically in the renderer (for previews) and in the Electron
 * main process (at generation time).
 */
export function matchContract(voucher, contracts, forcedContractId) {
    // If the caller already picked a contract, short-circuit
    if (forcedContractId) {
        const forced = contracts.find((c) => c.id === forcedContractId);
        if (forced)
            return { status: "matched", contract: forced };
        return { status: "no-match", warning: "Selected contract could not be found." };
    }
    // Step 1 — hotel name (case-insensitive)
    const hotelMatches = contracts.filter((c) => c.hotelName.toLowerCase() === voucher.hotelName.toLowerCase());
    if (hotelMatches.length === 0) {
        return {
            status: "no-match",
            warning: "No matching rate found for selected hotel.",
        };
    }
    // Step 2 — market
    const marketMatches = hotelMatches.filter((c) => c.market === voucher.market ||
        c.market === "All Markets" ||
        !voucher.market);
    // Step 3 — contract validity (earliest line-item date)
    const lineDates = voucher.lineItems
        .map((li) => li.requiredDate)
        .filter(Boolean)
        .sort();
    const earliestDate = lineDates[0] ?? voucher.date;
    const validContracts = (marketMatches.length > 0 ? marketMatches : hotelMatches).filter((c) => earliestDate >= c.validFrom && earliestDate <= c.validTo);
    if (validContracts.length === 0) {
        return {
            status: "no-match",
            warning: "Voucher date is outside contract validity period.",
        };
    }
    if (validContracts.length > 1) {
        return {
            status: "multiple",
            contracts: validContracts.map((c) => ({
                id: c.id,
                hotelName: c.hotelName,
                market: c.market,
                contractName: c.contractName,
                validFrom: c.validFrom,
                validTo: c.validTo,
            })),
        };
    }
    return { status: "matched", contract: validContracts[0] };
}
/* ------------------------------------------------------------------ */
/*  Auto-fill builders                                                 */
/* ------------------------------------------------------------------ */
function buildRateApplicableText(lineItem, contract) {
    const rate = contract.rates.find((r) => r.roomType.toLowerCase() === (lineItem.roomCategory ?? "").toLowerCase() &&
        r.mealPlan.toLowerCase() === (lineItem.basis ?? "").toLowerCase() &&
        lineItem.requiredDate >= r.periodFrom &&
        lineItem.requiredDate <= r.periodTo);
    if (!rate)
        return "";
    const mp = rate.mealPlan;
    const cur = contract.currency;
    const parts = [];
    if (rate.sgl)
        parts.push(`Single-${mp} ${cur} ${rate.sgl}`);
    if (rate.dbl)
        parts.push(`Double-${mp} ${cur} ${rate.dbl}`);
    if (rate.twn)
        parts.push(`Twin-${mp} ${cur} ${rate.twn}`);
    if (rate.tpl)
        parts.push(`Triple-${mp} ${cur} ${rate.tpl}`);
    return parts.join(" / ");
}
function buildGuideText(totalPax, guideRule, currency) {
    if (!guideRule)
        return "";
    const minPersons = Number(guideRule.minPersons) || 0;
    if (guideRule.focEnabled && totalPax >= minPersons && minPersons > 0) {
        return `${guideRule.focQuantity || "1"} ${guideRule.focRole || "Guide"} FOC on ${guideRule.focMealPlan || guideRule.mealPlan}`;
    }
    if (guideRule.rate) {
        return `${guideRule.focRole || "Guide"} – ${guideRule.mealPlan} ${currency} ${guideRule.rate}`;
    }
    return "";
}
function buildSurchargeText(lineItem, surcharges, currency) {
    const match = surcharges.find((s) => s.dateFrom &&
        s.dateTo &&
        lineItem.requiredDate >= s.dateFrom &&
        lineItem.requiredDate <= s.dateTo);
    if (!match)
        return null;
    return `${match.name}: ${currency} ${match.amount} ${(match.rule ?? "").toLowerCase()}`;
}
function buildEventText(lineItem, events, currency) {
    const match = events.find((e) => e.eventDate === lineItem.requiredDate && e.mandatory);
    if (!match)
        return null;
    const isBB = (lineItem.basis ?? "").toUpperCase() === "BB";
    const rate = isBB ? match.bbRate : match.hbfbRate;
    const label = isBB ? "BB" : "HB/FB";
    return `${match.eventName} (${label}): ${currency} ${rate} per ${(match.per ?? "person").toLowerCase()}`;
}
/* ------------------------------------------------------------------ */
/*  Orchestrator                                                       */
/* ------------------------------------------------------------------ */
export function autoFillFromContract(voucher, contracts, forcedContractId) {
    const matchResult = matchContract(voucher, contracts, forcedContractId);
    if (matchResult.status === "no-match") {
        return { status: "no-match", warnings: [matchResult.warning] };
    }
    if (matchResult.status === "multiple") {
        return {
            status: "multiple",
            warnings: ["Multiple matching contracts found. Please select one."],
            candidateContracts: matchResult.contracts,
        };
    }
    const contract = matchResult.contract;
    const warnings = [];
    // Rate text per line item (deduplicated)
    const rateTexts = [];
    for (const li of voucher.lineItems) {
        const text = buildRateApplicableText(li, contract);
        if (!text) {
            warnings.push(`No matching rate for ${li.roomCategory || "unknown room"} / ${li.basis || "unknown basis"} on ${li.requiredDate || "unknown date"}.`);
        }
        else if (!rateTexts.includes(text)) {
            rateTexts.push(text);
        }
    }
    // Surcharges per line item (deduplicated)
    const surchargeTexts = [];
    for (const li of voucher.lineItems) {
        const text = buildSurchargeText(li, contract.surcharges, contract.currency);
        if (text && !surchargeTexts.includes(text))
            surchargeTexts.push(text);
    }
    // Events per line item (deduplicated)
    const eventTexts = [];
    for (const li of voucher.lineItems) {
        const text = buildEventText(li, contract.events, contract.currency);
        if (text && !eventTexts.includes(text))
            eventTexts.push(text);
    }
    const totalPax = voucher.totalPax ?? 0;
    const guideText = buildGuideText(totalPax, contract.guideRule, contract.currency);
    return {
        status: "matched",
        warnings,
        matchedContractId: contract.id,
        rateApplicableText: rateTexts.join("\n"),
        guideText,
        surchargeText: surchargeTexts.join("\n"),
        eventSupplementText: eventTexts.join("\n"),
        billingInstructions: contract.billingTemplate || undefined,
    };
}
