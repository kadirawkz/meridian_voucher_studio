import {
  AlertTriangle,
  CheckCircle2,
  Circle,
  Plus,
  RotateCcw,
  Save,
  SkipForward,
  Trash2,
} from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import type { HotelRateRecord, HotelRateRecordSummary, HotelRef, MarketRef, RoomCategoryRef, SectionStatus } from "../../electron/shared/types";
import { hotels as fallbackHotels, markets as fallbackMarkets, roomCategories as fallbackRoomCategories, mealBasisOptions } from "../domain/referenceData";
import { Button } from "./ui-kit/Button";
import { Field as UiField } from "./ui-kit/Field";
import { Select } from "./ui-kit/Inputs";
import { Panel } from "./ui-kit/Panel";

/* ---------- shared design tokens ---------- */

const controlClass =
  "app-input";

const selectClass = "app-select";


/* ---------- default billing instruction ---------- */

const defaultBillingText = `• All payments will be made based on the room rates provided above.
• All extras to be collected directly from the client.
• Please forward the Tax Invoice addressed to Meridian (Pvt) Ltd along with the signed off voucher.`;

/* ---------- helper types ---------- */

interface RateRow {
  from: string;
  to: string;
  roomCategory: string;
  basis: string;
  sgl: string;
  dbl: string;
  twn: string;
  tpl: string;
}

interface RoomSupplementRow {
  roomCategory: string;
  supplementName: string;
  supplementAmount: string;
  per: string;
}

interface ChildRateRow {
  from: string;
  to: string;
  roomCategory: string;
  basis: string;
  age_2_5_sharing: string;
  age_2_5_extra_bed: string;
  age_2_5_own_room: string;
  age_6_11_sharing: string;
  age_6_11_extra_bed: string;
  age_6_11_own_room: string;
}



interface EventRow {
  date: string;
  event: string;
  bb: string;
  hb: string;
  fb: string;
  per: string;
  mandatory: boolean;
}


interface ContractDetails {
  hotelName: string;
  market: string;
  currency: string;
  contractName: string;
  validFrom: string;
  validTo: string;
}

interface GuideRateRow {
  basis: string;
  amount: string;
}

type FocRules = {
  enabled: boolean;
  appliesTo: string;
  minimumPersons: string;
  focQuantity: string;
  basis: string;
};

/* ---------- text generators ---------- */

function createRateApplicableText(rate: Pick<RateRow, "basis" | "sgl" | "dbl" | "twn" | "tpl"> | null, currency = "USD"): string {
  if (!rate) return "No matching rate selected";
  const parts: string[] = [];
  if (rate.sgl) parts.push(`Single-${rate.basis} ${currency} ${rate.sgl}`);
  if (rate.dbl) parts.push(`Double-${rate.basis} ${currency} ${rate.dbl}`);
  if (rate.twn) parts.push(`Twin-${rate.basis} ${currency} ${rate.twn}`);
  if (rate.tpl) parts.push(`Triple-${rate.basis} ${currency} ${rate.tpl}`);
  return parts.length ? parts.join(" / ") : "This section is empty";
}

function createFocRuleText(rule: FocRules): string {
  if (!rule.enabled) return "Guide FOC not applied";
  const personText = rule.minimumPersons ? `when ${rule.minimumPersons}+ persons` : "when person count rule is met";
  const qtyText = rule.focQuantity || "1";
  const who = rule.appliesTo || "Guide";
  const basisText = rule.basis ? ` on ${rule.basis.split(",").join("/")}` : "";
  return `${qtyText} ${who} FOC${basisText} ${personText}`;
}

/* ---------- reusable sub-components ---------- */

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Panel className="app-panel-body-lg">
      <h3 className="mb-5 app-section-title">{title}</h3>
      {children}
    </Panel>
  );
}

const Field = UiField;

function StatusPill({ status }: { status: SectionStatus }) {
  const color =
    status === "Completed"
      ? "bg-emerald-100 text-emerald-800"
      : status === "Skipped"
        ? "bg-amber-100 text-amber-800"
        : "bg-red-100 text-red-800";

  const Icon = status === "Completed" ? CheckCircle2 : status === "Skipped" ? SkipForward : AlertTriangle;

  return (
    <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-bold ${color}`}>
      <Icon size={14} /> {status}
    </span>
  );
}

/* ---------- main screen ---------- */

type Props = {
  onBack?: () => void;
  onManageRates?: () => void;
  initialEditId?: string;
  addNotice?: (message: string, type?: "info" | "success" | "error") => void;
};

export function HotelRateMasterScreen({ onManageRates, initialEditId, addNotice }: Props = {}) {
  const [contract, setContract] = useState<ContractDetails>({
    hotelName: "",
    market: "",
    currency: "",
    contractName: "",
    validFrom: "",
    validTo: "",
  });

  const [rates, setRates] = useState<RateRow[]>([]);
  const [childRates, setChildRates] = useState<ChildRateRow[]>([]);
  const [roomSupplements, setRoomSupplements] = useState<RoomSupplementRow[]>([]);
  const [guideRates, setGuideRates] = useState<GuideRateRow[]>([]);

  const [seasonalSurcharges, setSeasonalSurcharges] = useState<Array<{ name: string; amount: string; from: string; to: string; appliesTo: string }>>([]);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [focRules, setFocRules] = useState<FocRules>({ enabled: false, appliesTo: "Guide", minimumPersons: "15", focQuantity: "1", basis: "" });
  const [billingText, setBillingText] = useState("");
  const [saveNotice, setSaveNotice] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [hotels, setHotels] = useState<string[]>([...fallbackHotels]);
  const [marketOptions, setMarketOptions] = useState<readonly string[]>(fallbackMarkets);
  const [roomCategoryOptions, setRoomCategoryOptions] = useState<readonly string[]>(fallbackRoomCategories);
  const [hotelMode, setHotelMode] = useState<"select" | "create">("select");
  const [hotelSelectValue, setHotelSelectValue] = useState("");
  const [selectedHotelName, setSelectedHotelName] = useState("");
  const [hotelRateSummaries, setHotelRateSummaries] = useState<HotelRateRecordSummary[]>([]);
  const [selectedHotelRateId, setSelectedHotelRateId] = useState<string>(initialEditId || "");
  const [skippedSections, setSkippedSections] = useState<string[]>([]);

  useEffect(() => {
    if (!selectedHotelName || !window.meridian?.listHotelRates) {
      setHotelRateSummaries([]);
      setSelectedHotelRateId("");
      return;
    }
    void window.meridian
      .listHotelRates(selectedHotelName)
      .then((items) => setHotelRateSummaries(items.filter((i) => i.hotel_name === selectedHotelName)))
      .catch(() => setHotelRateSummaries([]));
  }, [selectedHotelName]);

  useEffect(() => {
    if (initialEditId) {
      void loadSelectedRateRecord(initialEditId);
    }
  }, [initialEditId]);

  /* ---------- previews ---------- */

  const previewRateText = useMemo(
    () => createRateApplicableText(rates[0] ?? null, contract.currency || "USD"),
    [rates, contract.currency]
  );

  const previewFocText = useMemo(
    () => createFocRuleText(focRules),
    [focRules]
  );

  /* ---------- load hotels + selected hotel rate summaries ---------- */

  useEffect(() => {
    // Load hotels from API
    if (window.meridian?.listHotels) {
      void window.meridian.listHotels()
        .then((refs: HotelRef[]) => {
          const names = refs.map((h) => h.name).filter(Boolean);
          const set = new Set<string>(names);
          for (const h of fallbackHotels) set.add(h);
          setHotels(Array.from(set).sort((a, b) => a.localeCompare(b)));
        })
        .catch(() => setHotels([...fallbackHotels]));
    }

    // Load markets from API
    if (window.meridian?.listMarkets) {
      void window.meridian.listMarkets()
        .then((refs: MarketRef[]) => {
          const codes = refs.map((m) => m.code).filter(Boolean);
          if (codes.length > 0) setMarketOptions(codes);
        })
        .catch(() => {});
    }

    // Load room categories from API
    if (window.meridian?.listRoomCategories) {
      void window.meridian.listRoomCategories()
        .then((refs: RoomCategoryRef[]) => {
          const names = refs.map((r) => r.name).filter(Boolean);
          if (names.length > 0) setRoomCategoryOptions(names);
        })
        .catch(() => {});
    }
  }, []);

  useEffect(() => {
    setHotelSelectValue(selectedHotelName);
  }, [selectedHotelName]);

  async function loadSelectedRateRecord(hotelRateId: string) {
    if (!window.meridian?.getHotelRates) return;
    const record = await window.meridian.getHotelRates(hotelRateId);

    const hName = record.hotel_name ?? "";
    setSelectedHotelName(hName);
    setHotelSelectValue(hName);

    setContract({
      hotelName: hName,
      market: record.market ?? "",
      currency: record.currency ?? "",
      contractName: record.contract_name ?? "",
      validFrom: record.valid_from ?? "",
      validTo: record.valid_to ?? "",
    });

    setRates(
      (record.room_rates ?? []).map((r) => ({
        from: r.from || "",
        to: r.to || "",
        roomCategory: r.room_category || "",
        basis: r.basis || "",
        sgl: r.sgl == null ? "" : String(r.sgl),
        dbl: r.dbl == null ? "" : String(r.dbl),
        twn: r.twn == null ? "" : String(r.twn),
        tpl: r.tpl == null ? "" : String(r.tpl),
      }))
    );

    setChildRates(
      (record.child_rates ?? []).map((r) => ({
        from: r.from || "",
        to: r.to || "",
        roomCategory: r.room_category || "",
        basis: r.basis || "",
        age_2_5_sharing: r.age_2_5_sharing == null ? "" : String(r.age_2_5_sharing),
        age_2_5_extra_bed: r.age_2_5_extra_bed == null ? "" : String(r.age_2_5_extra_bed),
        age_2_5_own_room: r.age_2_5_own_room == null ? "" : String(r.age_2_5_own_room),
        age_6_11_sharing: r.age_6_11_sharing == null ? "" : String(r.age_6_11_sharing),
        age_6_11_extra_bed: r.age_6_11_extra_bed == null ? "" : String(r.age_6_11_extra_bed),
        age_6_11_own_room: r.age_6_11_own_room == null ? "" : String(r.age_6_11_own_room),
      }))
    );

    setRoomSupplements(
      (record.room_supplements ?? []).map((s) => ({
        roomCategory: s.room_category || "",
        supplementName: s.supplement_name || "",
        supplementAmount: s.supplement_amount == null ? "" : String(s.supplement_amount),
        per: s.per || "per room per night",
      }))
    );

    setGuideRates(
      Object.entries(record.guide_rates ?? {}).map(([basis, amount]) => ({
        basis,
        amount: amount == null ? "" : String(amount),
      }))
    );



    setSeasonalSurcharges(
      (record.seasonal_surcharges ?? []).map((s) => ({
        name: s.name ?? "",
        amount: s.amount == null ? "" : String(s.amount),
        from: String(s.date_from ?? ""),
        to: String(s.date_to ?? ""),
        appliesTo: String(s.applies_to ?? ""),
      }))
    );

    setEvents(
      (record.compulsory_events ?? []).map((e) => ({
        date: e.event_date ?? "",
        event: e.event_name ?? "",
        bb: e.bb_rate == null ? "" : String(e.bb_rate),
        hb: e.hb_rate == null ? ((e as Record<string, unknown>).hbfb_rate == null ? "" : String((e as Record<string, unknown>).hbfb_rate)) : String(e.hb_rate),
        fb: e.fb_rate == null ? ((e as Record<string, unknown>).hbfb_rate == null ? "" : String((e as Record<string, unknown>).hbfb_rate)) : String(e.fb_rate),
        per: String(e.per ?? "Person"),
        mandatory: Boolean(e.mandatory ?? true),
      }))
    );

    setFocRules({
      enabled: Boolean(record.foc_rules?.enabled ?? false),
      appliesTo: String(record.foc_rules?.applies_to ?? "Guide"),
      minimumPersons: record.foc_rules?.minimum_persons == null ? "" : String(record.foc_rules.minimum_persons),
      focQuantity: record.foc_rules?.foc_quantity == null ? "1" : String(record.foc_rules.foc_quantity),
      basis: String(record.foc_rules?.basis ?? "HB"),
    });

    setSkippedSections(record.skipped_sections || []);
    setBillingText(record.billing_instruction ?? "");
  }

  /* ---------- updaters ---------- */

  const updateContract = (field: keyof ContractDetails, value: string) =>
    setContract((cur) => ({ ...cur, [field]: value }));

  const addRate = () =>
    setRates([...rates, { from: "", to: "", roomCategory: "", basis: "", sgl: "", dbl: "", twn: "", tpl: "" }]);

  const updateRate = (i: number, field: keyof RateRow, value: string) => {
    const copy = [...rates];
    copy[i] = { ...copy[i], [field]: value };
    setRates(copy);
  };

  const removeRate = (i: number) => setRates(rates.filter((_, idx) => idx !== i));

  const addChildRate = () =>
    setChildRates([...childRates, { from: "", to: "", roomCategory: "", basis: "", age_2_5_sharing: "", age_2_5_extra_bed: "", age_2_5_own_room: "", age_6_11_sharing: "", age_6_11_extra_bed: "", age_6_11_own_room: "" }]);

  const updateChildRate = (i: number, field: keyof ChildRateRow, value: string) => {
    const copy = [...childRates];
    copy[i] = { ...copy[i], [field]: value };
    setChildRates(copy);
  };

  const removeChildRate = (i: number) => setChildRates(childRates.filter((_, idx) => idx !== i));

  const addSupplement = () =>
    setRoomSupplements([...roomSupplements, { roomCategory: "", supplementName: "", supplementAmount: "", per: "per room per night" }]);

  const updateSupplement = (i: number, field: keyof RoomSupplementRow, value: string) => {
    const copy = [...roomSupplements];
    copy[i] = { ...copy[i], [field]: value };
    setRoomSupplements(copy);
  };

  const removeSupplement = (i: number) => setRoomSupplements(roomSupplements.filter((_, idx) => idx !== i));

  const addGuideRate = () =>
    setGuideRates([...guideRates, { basis: "", amount: "" }]);

  const updateGuideRate = (i: number, field: keyof GuideRateRow, value: string) => {
    const copy = [...guideRates];
    copy[i] = { ...copy[i], [field]: value };
    setGuideRates(copy);
  };

  const removeGuideRate = (i: number) => setGuideRates(guideRates.filter((_, idx) => idx !== i));



  const addEvent = () =>
    setEvents([...events, { date: "", event: "", bb: "", hb: "", fb: "", per: "Person", mandatory: true }]);

  const updateEvent = (i: number, field: keyof EventRow, value: string | boolean) => {
    const copy = [...events];
    copy[i] = { ...copy[i], [field]: value } as EventRow;
    setEvents(copy);
  };

  const removeEvent = (i: number) => setEvents(events.filter((_, idx) => idx !== i));

  const addSeasonalSurcharge = () =>
    setSeasonalSurcharges([
      ...seasonalSurcharges,
      { name: "", amount: "", from: "", to: "", appliesTo: "" },
    ]);

  const updateSeasonalSurcharge = (
    i: number,
    field: keyof (typeof seasonalSurcharges)[number],
    value: string
  ) => {
    const copy = [...seasonalSurcharges];
    copy[i] = { ...copy[i], [field]: value };
    setSeasonalSurcharges(copy);
  };

  const removeSeasonalSurcharge = (i: number) =>
    setSeasonalSurcharges(seasonalSurcharges.filter((_, idx) => idx !== i));

  function clearAll() {
    setSelectedHotelName("");
    setHotelSelectValue("");
    setHotelRateSummaries([]);
    setSelectedHotelRateId("");
    setContract({ hotelName: "", market: "", currency: "", contractName: "", validFrom: "", validTo: "" });
    setRates([]);
    setChildRates([]);
    setRoomSupplements([]);
    setGuideRates([]);
    setSeasonalSurcharges([]);
    setEvents([]);
    setFocRules({ enabled: false, appliesTo: "Guide", minimumPersons: "", focQuantity: "1", basis: "" });
    setSkippedSections([]);
    setBillingText("");
    setSaveNotice("Cleared");
  }



  function sectionStatus(sectionName: string, isEmpty: boolean): SectionStatus {
    if (skippedSections.includes(sectionName)) return "Skipped";
    return isEmpty ? "Empty" : "Completed";
  }

  function toggleSkip(sectionName: string) {
    setSkippedSections((cur) =>
      cur.includes(sectionName)
        ? cur.filter((s) => s !== sectionName)
        : [...cur, sectionName]
    );
  }

  const sectionStates = useMemo(() => {
    const basicEmpty =
      !contract.hotelName.trim() ||
      !contract.market.trim() ||
      !contract.currency.trim() ||
      !contract.contractName.trim() ||
      !contract.validFrom ||
      !contract.validTo;

    const roomRatesEmpty = rates.length === 0 || rates.some((r) => !r.roomCategory || !r.basis || !r.sgl || !r.dbl || !r.twn || !r.tpl);
    const childRatesEmpty = childRates.length === 0 || childRates.some((r) => !r.roomCategory || !r.basis || (!r.age_2_5_sharing && !r.age_2_5_extra_bed && !r.age_2_5_own_room && !r.age_6_11_sharing && !r.age_6_11_extra_bed && !r.age_6_11_own_room));
    const supplementsEmpty = roomSupplements.length === 0 || roomSupplements.some((s) => !s.supplementName || !s.supplementAmount);
    const guideRatesEmpty = guideRates.length === 0 || guideRates.some((r) => !r.basis.trim() || !r.amount.trim());
    const seasonalEmpty = seasonalSurcharges.length === 0 || seasonalSurcharges.some((s) => !s.name || !s.amount || !s.from || !s.to || !s.appliesTo);
    const eventsEmpty = events.length === 0 || events.some((e) => !e.date || !e.event || !e.bb || !e.hb || !e.fb);
    const focEmpty = !focRules.enabled || !focRules.appliesTo || !focRules.minimumPersons || !focRules.focQuantity || !focRules.basis;
    const billingEmpty = !billingText.trim();

    return [
      { name: "Basic Information", status: sectionStatus("Basic Information", basicEmpty), empty: basicEmpty },
      { name: "Room Rates", status: sectionStatus("Room Rates", roomRatesEmpty), empty: roomRatesEmpty },
      { name: "Child Rates", status: sectionStatus("Child Rates", childRatesEmpty), empty: childRatesEmpty },
      { name: "Room Supplements", status: sectionStatus("Room Supplements", supplementsEmpty), empty: supplementsEmpty },
      { name: "Guide Rates", status: sectionStatus("Guide Rates", guideRatesEmpty), empty: guideRatesEmpty },
      { name: "Guide FOC Rule", status: sectionStatus("Guide FOC Rule", focEmpty), empty: focEmpty },
      { name: "Seasonal Surcharges", status: sectionStatus("Seasonal Surcharges", seasonalEmpty), empty: seasonalEmpty },
      { name: "Compulsory Events", status: sectionStatus("Compulsory Events", eventsEmpty), empty: eventsEmpty },
      { name: "Billing Instructions", status: sectionStatus("Billing Instructions", billingEmpty), empty: billingEmpty },
    ] as const;
  }, [billingText, contract, events, focRules, guideRates, rates, roomSupplements, seasonalSurcharges, childRates, skippedSections]);

  const canSave = sectionStates.every((s) => s.status !== "Empty");

  /* ---------- save to backend ---------- */

  async function handleSave() {
    if (!window.meridian?.saveHotelRates) {
      setSaveNotice("Desktop bridge unavailable");
      return;
    }

    if (!canSave) {
      setSaveNotice("Cannot save: empty sections must be completed or skipped.");
      return;
    }

    setIsSaving(true);
    setSaveNotice("");

    try {
      const payload: HotelRateRecord = {
        id: selectedHotelRateId || undefined,
        hotel_name: contract.hotelName,
        market: contract.market,
        currency: contract.currency,
        contract_name: contract.contractName,
        valid_from: contract.validFrom,
        valid_to: contract.validTo,
        room_rates: rates.map((r) => ({
              from: contract.validFrom,
              to: contract.validTo,
              room_category: r.roomCategory,
              basis: r.basis,
              sgl: r.sgl ? Number(r.sgl) : null,
              dbl: r.dbl ? Number(r.dbl) : null,
              twn: r.twn ? Number(r.twn) : null,
              tpl: r.tpl ? Number(r.tpl) : null,
            })),
        child_rates: childRates.map((r) => ({
              from: contract.validFrom,
              to: contract.validTo,
              room_category: r.roomCategory,
              basis: r.basis,
              age_2_5_sharing: r.age_2_5_sharing || null,
              age_2_5_extra_bed: r.age_2_5_extra_bed || null,
              age_2_5_own_room: r.age_2_5_own_room || null,
              age_6_11_sharing: r.age_6_11_sharing || null,
              age_6_11_extra_bed: r.age_6_11_extra_bed || null,
              age_6_11_own_room: r.age_6_11_own_room || null,
            })),
        room_supplements: roomSupplements
              .filter((s) => s.supplementName.trim() && s.supplementAmount.trim())
              .map((s) => ({
                from: contract.validFrom,
                to: contract.validTo,
                room_category: s.roomCategory,
                supplement_name: s.supplementName.trim(),
                supplement_amount: Number(s.supplementAmount),
                per: s.per || "per room per night",
              })),
        guide_rates: Object.fromEntries(
              guideRates
                .filter((row) => row.basis.trim())
                .map((row) => [row.basis.trim().toUpperCase(), row.amount ? Number(row.amount) : null])
            ),

        seasonal_surcharges: seasonalSurcharges.map((s) => ({
              name: s.name,
              amount: s.amount ? Number(s.amount) : null,
              date_from: s.from || null,
              date_to: s.to || null,
              applies_to: s.appliesTo || null,
            })),
        compulsory_events: events.map((e) => ({
              event_date: e.date,
              event_name: e.event,
              bb_rate: e.bb ? Number(e.bb) : null,
              hb_rate: e.hb ? Number(e.hb) : null,
              fb_rate: e.fb ? Number(e.fb) : null,
              per: e.per,
              mandatory: e.mandatory,
            })),

        foc_rules: {
              enabled: focRules.enabled,
              applies_to: focRules.appliesTo,
              minimum_persons: focRules.minimumPersons ? Number(focRules.minimumPersons) : null,
              foc_quantity: focRules.focQuantity ? Number(focRules.focQuantity) : null,
              basis: focRules.basis,
            },
        skipped_sections: skippedSections,
        billing_instruction: billingText,
      };

      const result = await window.meridian.saveHotelRates(payload);
      const savedName = contract.hotelName;
      
      // Update hotels list if it's a new hotel
      setHotels((cur) => (cur.includes(savedName) ? cur : [...cur, savedName].sort((a, b) => a.localeCompare(b))));
      
      // Sync selection states
      setSelectedHotelName(savedName);
      setHotelSelectValue(savedName);
      setHotelMode("select");
      
      setSelectedHotelRateId(result.id);
      setSaveNotice("");
      if (addNotice) addNotice(`Rate master saved successfully (${result.id.slice(0, 8)})`, "success");
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Unable to save";
      setSaveNotice(msg);
      if (addNotice) addNotice(`Save failed: ${msg}`, "error");
    } finally {
      setIsSaving(false);
    }
  }

  /* ---------- table helper class ---------- */

  const cellControl =
    "app-table-control";

  const cellSelect =
    "app-table-control";

  /* ---------- render ---------- */

  return (
    <div className="mx-auto max-w-[1400px] p-4 md:p-8">
      {/* Page header */}
      <div className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-steel">
            Operations / Data Management
          </p>
          <h2 className="mt-1 font-display text-3xl font-bold text-navy">
            Rate Master Seed
          </h2>
          <p className="mt-2 text-sm text-steel">
            Create or update one hotel + one market + one contract record in `hotel_rates`.
          </p>
        </div>
        <div className="flex max-w-full flex-wrap items-center justify-end gap-2">
          {onManageRates && (
            <Button variant="secondary" onClick={onManageRates} className="h-10 shrink-0 whitespace-nowrap px-4 w-40">
              Manage Rates
            </Button>
          )}
          <Button type="button" variant="primary" disabled={isSaving || !canSave} onClick={handleSave} className="h-10 shrink-0 whitespace-nowrap px-4 w-40">
            <Save size={17} /> {isSaving ? "Saving..." : "Save Data"}
          </Button>
          <Button type="button" variant="secondary" disabled={isSaving} onClick={clearAll} className="h-10 shrink-0 whitespace-nowrap px-4 w-40">
            <RotateCcw size={17} /> Clear Form
          </Button>
          <Button
            type="button"
            variant="secondary"
            className="h-10 shrink-0 whitespace-nowrap px-4 w-40"
            disabled={isSaving}
            onClick={async () => {
              if (!window.meridian?.seedRateMaster) {
                setSaveNotice("Desktop bridge unavailable");
                return;
              }
              setIsSaving(true);
              setSaveNotice("");
              try {
                const result = await window.meridian.seedRateMaster();
                setSaveNotice("");
                if (addNotice) addNotice(`Seeded ${result.seeded} hotels successfully`, "success");
                if (window.meridian?.listHotelsFromRates) {
                  const items = await window.meridian.listHotelsFromRates();
                  setHotels(items);
                }
              } catch (e) {
                const msg = e instanceof Error ? e.message : "Seed failed";
                setSaveNotice(msg);
                if (addNotice) addNotice(`Seed failed: ${msg}`, "error");
              } finally {
                setIsSaving(false);
              }
            }}
          >
            Seed Hotels
          </Button>
          {saveNotice && (
            <span className="w-full text-right text-sm font-medium text-steel">{saveNotice}</span>
          )}
        </div>
      </div>

      <div className="space-y-6">
        {/* ── Selection panel ── */}
        <Panel className="app-panel-body-lg">
          <div className="space-y-5">
            {/* Row 1: Hotel Selection */}
            <div>
              <div className="mb-3 flex items-center gap-3">
                <p className="text-xs font-bold uppercase tracking-wide text-steel">Hotel</p>
                <div className="inline-flex rounded-app border border-line bg-cloud p-0.5">
                  <button
                    type="button"
                    onClick={() => {
                      setHotelMode("select");
                    }}
                    className={`rounded px-3 py-1 text-xs font-bold transition ${
                      hotelMode === "select"
                        ? "bg-surface text-navy shadow-sm"
                        : "text-steel hover:text-ink"
                    }`}
                  >
                    Select
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setHotelMode("create");
                      setHotelSelectValue("");
                      setSelectedHotelName("");
                      setContract((cur) => ({ ...cur, hotelName: "" }));
                      setSelectedHotelRateId("");
                    }}
                    className={`flex items-center gap-1 rounded px-3 py-1 text-xs font-bold transition ${
                      hotelMode === "create"
                        ? "bg-surface text-navy shadow-sm"
                        : "text-steel hover:text-ink"
                    }`}
                  >
                    <Plus size={12} /> Create
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                {/* Select mode */}
                {hotelMode === "select" && (
                  <Select
                    className="w-full"
                    aria-label="Select hotel"
                    value={hotelSelectValue}
                    onChange={(e) => {
                      const value = e.target.value;
                      setHotelSelectValue(value);
                      setSelectedHotelName(value);
                      setContract((cur) => ({ ...cur, hotelName: value }));
                    }}
                  >
                    <option value="">— select a hotel —</option>
                    {hotels.map((h) => (
                      <option value={h} key={h}>{h}</option>
                    ))}
                  </Select>
                )}

                {/* Create mode */}
                {hotelMode === "create" && (
                  <div className="flex gap-2">
                    <input
                      className={controlClass}
                      aria-label="New hotel name"
                      placeholder="e.g. Grand Hotel – Colombo"
                      value={contract.hotelName}
                      autoFocus
                      onChange={(e) => setContract((cur) => ({ ...cur, hotelName: e.target.value }))}
                    />
                  </div>
                )}

                {hotelMode === "create" && selectedHotelName && (
                  <p className="flex items-center gap-2 rounded-app bg-green-50 px-3 py-2 text-xs font-semibold text-green-700">
                    <CheckCircle2 size={14} /> {selectedHotelName}
                  </p>
                )}
              </div>
            </div>

            {/* Row 2: Market/Contract Selection */}
            <div>
              <p className="mb-3 text-xs font-bold uppercase tracking-wide text-steel">Market & Contract</p>
              <Select
                className="w-full"
                aria-label="Select market/contract record"
                value={selectedHotelRateId}
                disabled={!selectedHotelName}
                onChange={(e) => {
                  const id = e.target.value;
                  setSelectedHotelRateId(id);
                  if (id) {
                    void loadSelectedRateRecord(id);
                  } else {
                    setRates([]);
                    setSeasonalSurcharges([]);
                    setEvents([]);
                    setFocRules({ enabled: false, appliesTo: "Guide", minimumPersons: "", focQuantity: "1", basis: "" });
                    setBillingText("");
                    setContract((cur) => ({ ...cur, market: "", currency: "", contractName: "", validFrom: "", validTo: "" }));
                  }
                }}
              >
                <option value="">+ New market / contract</option>
                {hotelRateSummaries.map((s) => (
                  <option value={s.id} key={s.id}>
                    {s.market} — {s.contract_name} ({s.valid_from} → {s.valid_to})
                  </option>
                ))}
              </Select>
              <div className="mt-2 flex gap-3 text-xs text-steel">
                {!selectedHotelName && (
                  <p>Select a hotel first</p>
                )}
                {selectedHotelName && hotelRateSummaries.length === 0 && (
                  <p>No contracts — create one below</p>
                )}
              </div>
            </div>

            {/* Row 3: Save Requirements & Status */}
            <div className="rounded-app border border-line bg-cloud p-4">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                <div className="flex-1">
                  <p className="text-xs font-bold uppercase tracking-wide text-steel">Save Requirements</p>
                  <p className="mt-1.5 text-xs text-steel">
                    Complete or ignore all sections before saving.
                  </p>
                </div>
                <div className="flex flex-wrap justify-end gap-1.5">
                  {sectionStates.map((s) => (
                    <StatusPill status={s.status} key={s.name} />
                  ))}
                </div>
              </div>
              {!canSave && (
                <div className="mt-3 flex items-center gap-2 rounded-app border border-red-500/20 bg-red-500/10 px-3 py-2.5">
                  <AlertTriangle size={14} className="text-red-500 flex-shrink-0" />
                  <p className="text-xs font-semibold text-red-500">
                    {sectionStates.filter(s => s.status === "Empty").length} section(s) need attention
                  </p>
                </div>
              )}
            </div>
          </div>
        </Panel>

        {/* Live preview */}
        <Panel className="app-panel-body-lg">
          <h3 className="mb-4 app-section-title">Live Voucher Preview</h3>
          <div className="rounded-app border border-line bg-cloud p-5 text-sm">
            <p className="font-bold text-steel">Rate Applicable:</p>
            <p className="mt-1 text-ink">{previewRateText}</p>
            <p className="mt-4 font-bold text-steel">FOC Rule:</p>
            <p className="mt-1 text-ink">{previewFocText}</p>
          </div>
        </Panel>

        {/* 1. Basic Hotel Rate Info */}
        <Section title="1. Basic Information">
          <div className="mb-5 flex items-center justify-between">
            <StatusPill status={sectionStates[0].status} />
          </div>
          {sectionStates[0].status === "Empty" && (
            <p className="mb-4 flex items-center gap-2 rounded-app border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm font-semibold text-red-500">
              <AlertTriangle size={16} /> This section is empty
            </p>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 md:grid-cols-3">
            <Field label="Market">
              <Select className="w-full" title="Market" value={contract.market} onChange={(e) => updateContract("market", e.target.value)}>
                <option value="">Select Market</option>
                {marketOptions.map((m: string) => (
                  <option value={m} key={m}>{m}</option>
                ))}
              </Select>
            </Field>
            <Field label="Currency">
              <Select className="w-full" title="Currency" value={contract.currency} onChange={(e) => updateContract("currency", e.target.value)}>
                <option value="">Select Currency</option>
                <option value="USD">USD</option>
                <option value="LKR">LKR</option>
              </Select>
            </Field>
            <Field label="Contract Name">
              <input className={controlClass} title="Contract Name" value={contract.contractName} onChange={(e) => updateContract("contractName", e.target.value)} placeholder="Winter 25/26" />
            </Field>
            <Field label="Valid From">
              <input
                type="date"
                className={controlClass}
                aria-label="Valid from"
                title="Valid from"
                value={contract.validFrom}
                onChange={(e) => updateContract("validFrom", e.target.value)}
              />
            </Field>
            <Field label="Valid To">
              <input
                type="date"
                className={controlClass}
                aria-label="Valid to"
                title="Valid to"
                value={contract.validTo}
                onChange={(e) => updateContract("validTo", e.target.value)}
              />
            </Field>
          </div>
        </Section>

        {/* 2. Room Rates */}
        <Section title="2. Room Rates">
          <div className="mb-5 flex items-center justify-between">
            <StatusPill status={sectionStates[1].status} />
          </div>
          {sectionStates[1].status === "Empty" && (
            <p className="mb-4 flex items-center gap-2 rounded-app border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm font-semibold text-red-500">
              <AlertTriangle size={16} /> This section is empty
            </p>
          )}
          <div className="thin-scrollbar overflow-x-auto">
            <table className="w-full min-w-[1000px] table-fixed border-collapse text-sm">
              <thead>
                <tr className="border-y border-line bg-cloud text-left text-xs font-bold uppercase tracking-wide text-steel">
                  <th className="px-4 py-3 text-left font-bold text-navy uppercase tracking-wider text-[11px]">Room Category</th>
                  {["Basis", "SGL", "DBL", "TWN", "TPL", ""].map((h) => (
                    <th className="px-2 py-3" key={h || "action"}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rates.map((rate, i) => (
                  <tr key={i}>
                    <td className="px-4 py-2">
                      <Select
                        className="w-full"
                        aria-label="Room category"
                        title="Room category"
                        value={rate.roomCategory}
                        onChange={(e) => updateRate(i, "roomCategory", e.target.value)}
                      >
                        <option value="">Select</option>
                        {roomCategoryOptions.map((cat: string) => (
                          <option value={cat} key={cat}>
                            {cat}
                          </option>
                        ))}
                      </Select>
                    </td>
                    <td className="px-2 py-2">
                      <Select
                        className="w-full"
                        aria-label="Meal basis"
                        title="Meal basis"
                        value={rate.basis}
                        onChange={(e) => updateRate(i, "basis", e.target.value)}
                      >
                        <option value="">Select Basis</option>
                        {mealBasisOptions.map((opt) => (
                          <option value={opt} key={opt}>
                            {opt}
                          </option>
                        ))}
                      </Select>
                    </td>
                    <td className="px-2 py-2"><input type="number" step="1" className={cellControl} aria-label="Single rate" title="Single rate" value={rate.sgl} onChange={(e) => updateRate(i, "sgl", e.target.value.replace(/\D/g, ''))} /></td>
                    <td className="px-2 py-2"><input type="number" step="1" className={cellControl} aria-label="Double rate" title="Double rate" value={rate.dbl} onChange={(e) => updateRate(i, "dbl", e.target.value.replace(/\D/g, ''))} /></td>
                    <td className="px-2 py-2"><input type="number" step="1" className={cellControl} aria-label="Twin rate" title="Twin rate" value={rate.twn} onChange={(e) => updateRate(i, "twn", e.target.value.replace(/\D/g, ''))} /></td>
                    <td className="px-2 py-2"><input type="number" step="1" className={cellControl} aria-label="Triple rate" title="Triple rate" value={rate.tpl} onChange={(e) => updateRate(i, "tpl", e.target.value.replace(/\D/g, ''))} /></td>
                    <td className="px-2 py-2">
                      <button type="button" onClick={() => removeRate(i)} className="rounded-app p-2 text-steel hover:bg-red-500/10 hover:text-red-500" title="Remove row">
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button type="button" onClick={addRate} className="mt-4 flex items-center gap-2 rounded-app border border-line px-3 py-2 text-sm font-bold text-navy">
            <Plus size={16} /> Add Rate Row
          </button>
        </Section>
        {/* 3. Child Rates */}
        <Section title="3. Child Rates">
          <div className="mb-5 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <StatusPill status={sectionStates[2].status} />
              <button
                type="button"
                onClick={() => toggleSkip("Child Rates")}
                className={`flex items-center gap-1.5 rounded-app px-3 py-1.5 text-xs font-bold transition-all ${
                  skippedSections.includes("Child Rates")
                    ? "bg-amber-50 text-amber-700 border border-amber-200"
                    : "bg-cloud text-steel hover:bg-line hover:text-navy border border-line"
                }`}
              >
                <SkipForward size={14} />
                {skippedSections.includes("Child Rates") ? "Undo Skip" : "Skip Section"}
              </button>
            </div>
          </div>
          {sectionStates[2].status === "Empty" && (
            <p className="mb-4 flex items-center gap-2 rounded-app border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm font-semibold text-red-500">
              <AlertTriangle size={16} /> This section is empty
            </p>
          )}
          <div className="thin-scrollbar overflow-x-auto">
            <table className="w-full min-w-[1000px] table-fixed border-collapse text-sm">
              <thead>
                <tr className="border-y border-line bg-cloud text-left text-xs font-bold uppercase tracking-wide text-steel">
                  <th className="px-4 py-3 text-left font-bold text-navy uppercase tracking-wider text-[11px] w-[180px]">Room Category</th>
                  <th className="px-2 py-3 w-[90px]">Basis</th>
                  <th className="px-2 py-3 text-center border-x border-line bg-blue-50/50" colSpan={3}>Child (2 - 5.99 Years)</th>
                  <th className="px-2 py-3 text-center bg-amber-50/50" colSpan={3}>Child (6 - 11.99 Years)</th>
                  <th className="px-2 py-3 w-[50px]"></th>
                </tr>
                <tr className="border-b border-line bg-cloud/50 text-[10px] font-bold uppercase tracking-wider text-steel">
                  <th className="px-4 py-1"></th>
                  <th className="px-2 py-1"></th>
                  <th className="px-2 py-1 text-center border-l border-line bg-blue-50/30">Sharing</th>
                  <th className="px-2 py-1 text-center bg-blue-50/30">Bed</th>
                  <th className="px-2 py-1 text-center border-r border-line bg-blue-50/30">ICON</th>
                  <th className="px-2 py-1 text-center bg-amber-50/30">Sharing</th>
                  <th className="px-2 py-1 text-center bg-amber-50/30">Bed</th>
                  <th className="px-2 py-1 text-center bg-amber-50/30">ICON</th>
                  <th className="px-2 py-1"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {childRates.map((rate, i) => (
                  <tr key={i}>
                    <td className="px-4 py-2">
                      <Select
                        className="w-full"
                        aria-label="Room category"
                        title="Room category"
                        value={rate.roomCategory}
                        onChange={(e) => updateChildRate(i, "roomCategory", e.target.value)}
                      >
                        <option value="">Select</option>
                        {roomCategoryOptions.map((cat: string) => (
                          <option value={cat} key={cat}>
                            {cat}
                          </option>
                        ))}
                      </Select>
                    </td>
                    <td className="px-2 py-2">
                      <Select
                        className="w-full"
                        aria-label="Meal basis"
                        title="Meal basis"
                        value={rate.basis}
                        onChange={(e) => updateChildRate(i, "basis", e.target.value)}
                      >
                        <option value="">Select Basis</option>
                        {mealBasisOptions.map((opt) => (
                          <option value={opt} key={opt}>
                            {opt}
                          </option>
                        ))}
                      </Select>
                    </td>
                    <td className="px-2 py-2 border-l border-line bg-blue-50/10"><input className={cellControl} aria-label="2-5 sharing" value={rate.age_2_5_sharing} onChange={(e) => updateChildRate(i, "age_2_5_sharing", e.target.value)} /></td>
                    <td className="px-2 py-2 bg-blue-50/10"><input className={cellControl} aria-label="2-5 bed" value={rate.age_2_5_extra_bed} onChange={(e) => updateChildRate(i, "age_2_5_extra_bed", e.target.value)} /></td>
                    <td className="px-2 py-2 border-r border-line bg-blue-50/10"><input className={cellControl} aria-label="2-5 own room" value={rate.age_2_5_own_room} onChange={(e) => updateChildRate(i, "age_2_5_own_room", e.target.value)} /></td>
                    <td className="px-2 py-2 bg-amber-50/10"><input className={cellControl} aria-label="6-11 sharing" value={rate.age_6_11_sharing} onChange={(e) => updateChildRate(i, "age_6_11_sharing", e.target.value)} /></td>
                    <td className="px-2 py-2 bg-amber-50/10"><input className={cellControl} aria-label="6-11 bed" value={rate.age_6_11_extra_bed} onChange={(e) => updateChildRate(i, "age_6_11_extra_bed", e.target.value)} /></td>
                    <td className="px-2 py-2 bg-amber-50/10"><input className={cellControl} aria-label="6-11 own room" value={rate.age_6_11_own_room} onChange={(e) => updateChildRate(i, "age_6_11_own_room", e.target.value)} /></td>
                    <td className="px-2 py-2">
                      <button type="button" onClick={() => removeChildRate(i)} className="rounded-app p-2 text-steel hover:bg-red-500/10 hover:text-red-500" title="Remove row">
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button type="button" onClick={addChildRate} className="mt-4 flex items-center gap-2 rounded-app border border-line px-3 py-2 text-sm font-bold text-navy">
            <Plus size={16} /> Add Child Rate Row
          </button>
        </Section>

        {/* 4. Room Supplements */}
        <Section title="4. Room Supplements">
          <div className="mb-5 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <StatusPill status={sectionStates[3].status} />
              <button
                type="button"
                onClick={() => toggleSkip("Room Supplements")}
                className={`flex items-center gap-1.5 rounded-app px-3 py-1.5 text-xs font-bold transition-all ${
                  skippedSections.includes("Room Supplements")
                    ? "bg-amber-50 text-amber-700 border border-amber-200"
                    : "bg-cloud text-steel hover:bg-line hover:text-navy border border-line"
                }`}
              >
                <SkipForward size={14} />
                {skippedSections.includes("Room Supplements") ? "Undo Skip" : "Skip Section"}
              </button>
            </div>
          </div>
          {sectionStates[3].status === "Empty" && (
            <p className="mb-4 flex items-center gap-2 rounded-app border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm font-semibold text-red-500">
              <AlertTriangle size={16} /> This section is empty
            </p>
          )}
          <p className="mb-4 text-xs text-steel">
            Flat per-room-per-night uplift for upgraded room categories (e.g. Deluxe Supplement, Suite Supplement). These appear in the Rate Applicable text automatically.
          </p>
          <div className="thin-scrollbar overflow-x-auto">
            <table className="w-full min-w-[600px] table-fixed border-collapse text-sm">
              <thead>
                <tr className="border-y border-line bg-cloud text-left text-xs font-bold uppercase tracking-wide text-steel">
                  <th className="px-4 py-3 text-[11px] font-bold text-navy uppercase tracking-wider">Room Category</th>
                  <th className="px-2 py-3 text-[11px] font-bold text-navy uppercase tracking-wider">Supplement Name</th>
                  <th className="px-2 py-3 text-[11px] font-bold text-navy uppercase tracking-wider">Amount</th>
                  <th className="px-2 py-3 text-[11px] font-bold text-navy uppercase tracking-wider">Per</th>
                  <th className="px-2 py-3 w-[60px]"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {roomSupplements.map((supp, i) => (
                  <tr key={i}>
                    <td className="px-4 py-2">
                      <Select className={selectClass} aria-label="Supplement room category" title="Supplement room category" value={supp.roomCategory} onChange={(e) => updateSupplement(i, "roomCategory", e.target.value)}>
                        <option value="">Select category</option>
                        {roomCategoryOptions.map((cat) => <option key={cat} value={cat}>{cat}</option>)}
                      </Select>
                    </td>
                    <td className="px-2 py-2">
                      <input className={controlClass} aria-label="Supplement name" title="Supplement name" placeholder="e.g. Deluxe Room Supplement" value={supp.supplementName} onChange={(e) => updateSupplement(i, "supplementName", e.target.value)} />
                    </td>
                    <td className="px-2 py-2">
                      <input type="number" step="1" className={controlClass} aria-label="Supplement amount" title="Supplement amount" placeholder="20" value={supp.supplementAmount} onChange={(e) => updateSupplement(i, "supplementAmount", e.target.value)} />
                    </td>
                    <td className="px-2 py-2">
                      <input className={controlClass} aria-label="Supplement per unit" title="Supplement per unit" placeholder="per room per night" value={supp.per} onChange={(e) => updateSupplement(i, "per", e.target.value)} />
                    </td>
                    <td className="px-2 py-2 text-center">
                      <button type="button" onClick={() => removeSupplement(i)} className="rounded-app p-2 text-steel hover:bg-red-500/10 hover:text-red-500" title="Remove supplement">
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button type="button" onClick={addSupplement} className="mt-4 flex items-center gap-2 rounded-app border border-line px-3 py-2 text-sm font-bold text-navy">
            <Plus size={16} /> Add Supplement Row
          </button>
        </Section>

        <Section title="5. Guide Rates">
          <div className="mb-5 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <StatusPill status={sectionStates[4].status} />
              <button
                type="button"
                onClick={() => toggleSkip("Guide Rates")}
                className={`flex items-center gap-1.5 rounded-app px-3 py-1.5 text-xs font-bold transition-all ${
                  skippedSections.includes("Guide Rates")
                    ? "bg-amber-50 text-amber-700 border border-amber-200"
                    : "bg-cloud text-steel hover:bg-line hover:text-navy border border-line"
                }`}
              >
                <SkipForward size={14} />
                {skippedSections.includes("Guide Rates") ? "Undo Skip" : "Skip Section"}
              </button>
            </div>
          </div>
          {sectionStates[4].status === "Empty" && (
            <p className="mb-4 flex items-center gap-2 rounded-app border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm font-semibold text-red-500">
              <AlertTriangle size={16} /> This section is empty
            </p>
          )}
          <div className="thin-scrollbar overflow-x-auto">
            <table className="w-full min-w-[500px] table-fixed border-collapse text-sm">
              <thead>
                <tr className="border-y border-line bg-cloud text-left text-xs font-bold uppercase tracking-wide text-steel">
                  <th className="px-4 py-3 text-[11px] font-bold text-navy uppercase tracking-wider">Guide Basis</th>
                  <th className="px-2 py-3 text-[11px] font-bold text-navy uppercase tracking-wider">Amount</th>
                  <th className="px-2 py-3 w-[60px]"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {guideRates.map((rate, i) => (
                  <tr key={`${rate.basis}-${i}`}>
                    <td className="px-4 py-2">
                      <Select className={cellSelect} aria-label="Guide basis" title="Guide basis" value={rate.basis} onChange={(e) => updateGuideRate(i, "basis", e.target.value)}>
                        <option value="">Select basis</option>
                        {mealBasisOptions.map((basis) => (
                          <option key={basis} value={basis}>
                            {basis}
                          </option>
                        ))}
                      </Select>
                    </td>
                    <td className="px-2 py-2">
                      <input type="number" step="1" className={cellControl} aria-label="Guide rate amount" title="Guide rate amount" placeholder="Amount" value={rate.amount} onChange={(e) => updateGuideRate(i, "amount", e.target.value.replace(/\D/g, ''))} />
                    </td>
                    <td className="px-2 py-2 text-center">
                      <button type="button" onClick={() => removeGuideRate(i)} className="rounded-app p-2 text-steel hover:bg-red-500/10 hover:text-red-500" title="Remove guide rate">
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button type="button" onClick={addGuideRate} className="mt-4 flex items-center gap-2 rounded-app border border-line px-3 py-2 text-sm font-bold text-navy">
            <Plus size={16} /> Add Guide Rate
          </button>
        </Section>

        {/* 6. Guide FOC Rule */}
        <Section title="6. Guide FOC Rule">
          <div className="mb-5 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <StatusPill status={sectionStates[5].status} />
              <button
                type="button"
                onClick={() => toggleSkip("Guide FOC Rule")}
                className={`flex items-center gap-1.5 rounded-app px-3 py-1.5 text-xs font-bold transition-all ${
                  skippedSections.includes("Guide FOC Rule")
                    ? "bg-amber-50 text-amber-700 border border-amber-200"
                    : "bg-cloud text-steel hover:bg-line hover:text-navy border border-line"
                }`}
              >
                <SkipForward size={14} />
                {skippedSections.includes("Guide FOC Rule") ? "Undo Skip" : "Skip Section"}
              </button>
            </div>
          </div>
          {sectionStates[5].status === "Empty" && (
            <p className="mb-4 flex items-center gap-2 rounded-app border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm font-semibold text-red-500">
              <AlertTriangle size={16} /> This section is empty
            </p>
          )}
          <div className="rounded-app border border-line bg-cloud p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <p className="text-xs font-bold uppercase tracking-wide text-steel">Guide FOC by Number of Persons</p>
              <label className="flex items-center gap-2 text-sm font-bold text-navy">
                <input type="checkbox" checked={focRules.enabled} onChange={(e) => setFocRules({ ...focRules, enabled: e.target.checked })} className="accent-navy" />
                Enable FOC
              </label>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <Field label="Applies To">
                <input className={controlClass} title="Applies To" value={focRules.appliesTo} onChange={(e) => setFocRules({ ...focRules, appliesTo: e.target.value })} placeholder="Guide" />
              </Field>
              <Field label="Minimum Persons">
                <input type="number" step="1" className={controlClass} title="Minimum Persons" value={focRules.minimumPersons} onChange={(e) => setFocRules({ ...focRules, minimumPersons: e.target.value.replace(/\D/g, '') })} placeholder="15" />
              </Field>
              <Field label="FOC Quantity">
                <input type="number" step="1" className={controlClass} title="FOC Quantity" value={focRules.focQuantity} onChange={(e) => setFocRules({ ...focRules, focQuantity: e.target.value.replace(/\D/g, '') })} placeholder="1" />
              </Field>
              <Field label="Basis (select all that apply)">
                <div className="flex flex-wrap items-center gap-4 py-2">
                  {mealBasisOptions.map((opt) => {
                    const selected = focRules.basis.split(",").filter(Boolean);
                    const isChecked = selected.includes(opt);
                    return (
                      <label key={opt} className="flex items-center gap-1.5 text-sm font-bold text-navy cursor-pointer">
                        <input
                          type="checkbox"
                          className="h-4 w-4 accent-navy"
                          checked={isChecked}
                          onChange={(e) => {
                            const next = e.target.checked
                              ? [...selected, opt]
                              : selected.filter((b) => b !== opt);
                            setFocRules({ ...focRules, basis: next.join(",") });
                          }}
                        />
                        {opt}
                      </label>
                    );
                  })}
                </div>
              </Field>
              <Field label="Generated Rule Preview">
                <input className={controlClass} title="Generated Rule Preview" value={previewFocText} readOnly />
              </Field>
            </div>
          </div>
        </Section>

        <Section title="7. Seasonal Surcharges">
          <div className="mb-5 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <StatusPill status={sectionStates[6].status} />
              <button
                type="button"
                onClick={() => toggleSkip("Seasonal Surcharges")}
                className={`flex items-center gap-1.5 rounded-app px-3 py-1.5 text-xs font-bold transition-all ${
                  skippedSections.includes("Seasonal Surcharges")
                    ? "bg-amber-50 text-amber-700 border border-amber-200"
                    : "bg-cloud text-steel hover:bg-line hover:text-navy border border-line"
                }`}
              >
                <SkipForward size={14} />
                {skippedSections.includes("Seasonal Surcharges") ? "Undo Skip" : "Skip Section"}
              </button>
            </div>
          </div>
          {sectionStates[6].status === "Empty" && (
            <p className="mb-4 flex items-center gap-2 rounded-app border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm font-semibold text-red-500">
              <AlertTriangle size={16} /> This section is empty
            </p>
          )}
          <div className="space-y-3">
            <div className="hidden lg:grid grid-cols-6 gap-3 px-3 text-[10px] font-bold uppercase tracking-wider text-steel">
              <div>Name</div>
              <div>Amount</div>
              <div>From</div>
              <div>To</div>
              <div className="col-span-1">Applies To</div>
              <div></div>
            </div>
            {seasonalSurcharges.map((s, i) => (
              <div key={i} className="grid grid-cols-1 lg:grid-cols-6 gap-3 rounded-app border border-line bg-cloud p-3">
                <input className={cellControl} aria-label="Surcharge name" title="Surcharge name" placeholder="Name" value={s.name} onChange={(e) => updateSeasonalSurcharge(i, "name", e.target.value)} />
                <input type="number" step="1" className={cellControl} aria-label="Surcharge amount" title="Surcharge amount" placeholder="Amount" value={s.amount} onChange={(e) => updateSeasonalSurcharge(i, "amount", e.target.value.replace(/\D/g, ''))} />
                <input type="date" className={cellControl} aria-label="From" title="From" value={s.from} onChange={(e) => updateSeasonalSurcharge(i, "from", e.target.value)} />
                <input type="date" className={cellControl} aria-label="To" title="To" value={s.to} onChange={(e) => updateSeasonalSurcharge(i, "to", e.target.value)} />
                <Select className={cellSelect} aria-label="Surcharge applies to" title="Surcharge applies to" value={s.appliesTo} onChange={(e) => updateSeasonalSurcharge(i, "appliesTo", e.target.value)}>
                  <option value="">Select</option>
                  <option value="All">All Categories</option>
                  {roomCategoryOptions.map((cat: string) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </Select>
                <button type="button" onClick={() => removeSeasonalSurcharge(i)} className="rounded-app p-2 text-steel hover:bg-red-500/10 hover:text-red-500" title="Remove surcharge">
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
          <button type="button" onClick={addSeasonalSurcharge} className="mt-4 flex items-center gap-2 rounded-app border border-line px-3 py-2 text-sm font-bold text-navy">
            <Plus size={16} /> Add Seasonal Surcharge
          </button>
        </Section>


        {/* 8. Compulsory Events */}
        <Section title="8. Compulsory Events / Gala Dinner">
          <div className="mb-5 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <StatusPill status={sectionStates[7].status} />
              <button
                type="button"
                onClick={() => toggleSkip("Compulsory Events")}
                className={`flex items-center gap-1.5 rounded-app px-3 py-1.5 text-xs font-bold transition-all ${
                  skippedSections.includes("Compulsory Events")
                    ? "bg-amber-50 text-amber-700 border border-amber-200"
                    : "bg-cloud text-steel hover:bg-line hover:text-navy border border-line"
                }`}
              >
                <SkipForward size={14} />
                {skippedSections.includes("Compulsory Events") ? "Undo Skip" : "Skip Section"}
              </button>
            </div>
          </div>
          {sectionStates[7].status === "Empty" && (
            <p className="mb-4 flex items-center gap-2 rounded-app border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm font-semibold text-red-500">
              <AlertTriangle size={16} /> This section is empty
            </p>
          )}
          <div className="thin-scrollbar overflow-x-auto">
            <table className="w-full min-w-[1000px] table-fixed border-collapse text-sm">
              <thead>
                <tr className="border-y border-line bg-cloud text-left text-xs font-bold uppercase tracking-wide text-steel">
                  {["Date", "Event", "BB Rate", "HB Rate", "FB Rate", "Per", "Mandatory", ""].map((h) => (
                    <th className="px-2 py-3" key={h || "action"}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {events.map((ev, i) => (
                  <tr key={i}>
                    <td className="px-2 py-2"><input type="date" className={cellControl} aria-label="Event date" title="Event date" value={ev.date} onChange={(e) => updateEvent(i, "date", e.target.value)} /></td>
                    <td className="px-2 py-2"><input className={cellControl} aria-label="Event name" title="Event name" value={ev.event} onChange={(e) => updateEvent(i, "event", e.target.value)} /></td>
                    <td className="px-2 py-2"><input type="number" step="1" className={cellControl} aria-label="BB rate" title="BB rate" value={ev.bb} onChange={(e) => updateEvent(i, "bb", e.target.value.replace(/\D/g, ''))} /></td>
                    <td className="px-2 py-2"><input type="number" step="1" className={cellControl} aria-label="HB rate" title="HB rate" value={ev.hb} onChange={(e) => updateEvent(i, "hb", e.target.value.replace(/\D/g, ''))} /></td>
                    <td className="px-2 py-2"><input type="number" step="1" className={cellControl} aria-label="FB rate" title="FB rate" value={ev.fb} onChange={(e) => updateEvent(i, "fb", e.target.value.replace(/\D/g, ''))} /></td>
                    <td className="px-2 py-2">
                      <Select className={cellSelect} aria-label="Event per" title="Event per" value={ev.per} onChange={(e) => updateEvent(i, "per", e.target.value)}>
                        <option>Person</option><option>Room</option>
                      </Select>
                    </td>
                    <td className="px-2 py-2 text-center">
                      <input type="checkbox" aria-label="Event mandatory" title="Event mandatory" checked={ev.mandatory} onChange={(e) => updateEvent(i, "mandatory", e.target.checked)} className="h-5 w-5 rounded border-line accent-navy" />
                    </td>
                    <td className="px-2 py-2">
                      <button type="button" onClick={() => removeEvent(i)} className="rounded-app p-2 text-steel hover:bg-red-500/10 hover:text-red-500" title="Remove event">
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button type="button" onClick={addEvent} className="mt-4 flex items-center gap-2 rounded-app border border-line px-3 py-2 text-sm font-bold text-navy">
            <Plus size={16} /> Add Event
          </button>
        </Section>

        {/* Old FOC section removed — now at position 6 after Guide Rates */}

        {/* 9. Billing Instructions */}
        <Section title="9. Billing Instructions">
          <div className="mb-5 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <StatusPill status={sectionStates[8].status} />
              <button
                type="button"
                onClick={() => toggleSkip("Billing Instructions")}
                className={`flex items-center gap-1.5 rounded-app px-3 py-1.5 text-xs font-bold transition-all ${
                  skippedSections.includes("Billing Instructions")
                    ? "bg-amber-50 text-amber-700 border border-amber-200"
                    : "bg-cloud text-steel hover:bg-line hover:text-navy border border-line"
                }`}
              >
                <SkipForward size={14} />
                {skippedSections.includes("Billing Instructions") ? "Undo Skip" : "Skip Section"}
              </button>
            </div>
          </div>
          <div className="mb-4">
            <button
              type="button"
              onClick={() => setBillingText(defaultBillingText)}
              className="flex items-center gap-2 rounded-app border border-line bg-surface px-3 py-2 text-sm font-bold text-navy"
            >
              <Circle size={16} /> Use Default Billing Instruction
            </button>
          </div>
          {sectionStates[8].status === "Empty" && (
            <p className="mb-4 flex items-center gap-2 rounded-app border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm font-semibold text-red-500">
              <AlertTriangle size={16} /> This section is empty
            </p>
          )}
          <textarea
            className="min-h-32 w-full rounded-app border border-line px-3 py-2.5 text-sm"
            aria-label="Billing instructions"
            title="Billing instructions"
            value={billingText}
            onChange={(e) => setBillingText(e.target.value)}
          />
        </Section>

      </div>
    </div>
  );
}
