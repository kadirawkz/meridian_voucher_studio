import {
  AlertTriangle,
  CheckCircle2,
  Plus,
  RotateCcw,
  Save,
  SkipForward,
  Trash2,
} from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import type {
  HotelRateRecord,
  HotelRef,
  MarketRef,
  RoomCategoryRef,
  MealBasisRef,
  CurrencyRef,
  SectionStatus,
} from "../../electron/shared/types";
import {
  hotels as fallbackHotels,
  markets as fallbackMarkets,
  roomCategories as fallbackRoomCategories,
  mealBasisOptions,
} from "../domain/referenceData";
import { Button } from "./ui-kit/Button";
import { Field as UiField } from "./ui-kit/Field";
import { Select } from "./ui-kit/Inputs";
import { Panel } from "./ui-kit/Panel";
import { friendlyErrorMessage } from "../utils/errors";

/* ---------- shared design tokens ---------- */

const controlClass = "app-input";

const selectClass = "app-select";

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
  countAdults: boolean;
  countChild2_5: boolean;
  countChild6_11: boolean;
  paxCustomText: string;
  guideCustomText: string;
};

function createFocRuleText(rule: FocRules, target: "Pax" | "Guide"): string {
  if (!rule.enabled) return "FOC not applied";
  const personText = rule.minimumPersons
    ? `when ${rule.minimumPersons}+ persons`
    : "when person count rule is met";
  const qtyText = rule.focQuantity || "1";
  const basisText = rule.basis ? ` on ${rule.basis.split(",").join("/")}` : "";

  const categories = [];
  if (rule.countAdults) categories.push("Adults");
  if (rule.countChild2_5) categories.push("Child (2-5.99)");
  if (rule.countChild6_11) categories.push("Child (6-11.99)");
  const countDesc =
    categories.length > 0
      ? ` (counting ${categories.join("+")})`
      : " (counting none)";

  return `${qtyText} ${target} FOC${basisText} ${personText}${countDesc}`;
}

/* ---------- reusable sub-components ---------- */

function Section({
  title,
  id,
  children,
}: {
  title: string;
  id?: string;
  children: ReactNode;
}) {
  return (
    <Panel id={id} className="app-panel-body-lg scroll-mt-6">
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

  const Icon =
    status === "Completed"
      ? CheckCircle2
      : status === "Skipped"
        ? SkipForward
        : AlertTriangle;

  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-bold ${color}`}
    >
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
  onRatesChanged?: () => void;
};

export function HotelRateMasterScreen({
  onBack,
  onManageRates,
  initialEditId,
  addNotice,
  onRatesChanged,
}: Props = {}) {
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
  const [roomSupplements, setRoomSupplements] = useState<RoomSupplementRow[]>(
    [],
  );
  const [guideRates, setGuideRates] = useState<GuideRateRow[]>([]);

  const [seasonalSurcharges, setSeasonalSurcharges] = useState<
    Array<{
      name: string;
      amount: string;
      from: string;
      to: string;
      appliesTo: string;
    }>
  >([]);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [focRules, setFocRules] = useState<FocRules>({
    enabled: false,
    appliesTo: "Guide",
    minimumPersons: "15",
    focQuantity: "1",
    basis: "",
    countAdults: true,
    countChild2_5: false,
    countChild6_11: false,
    paxCustomText: "",
    guideCustomText: "",
  });
  const [billingText, setBillingText] = useState("");
  const [saveNotice, setSaveNotice] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [hotels, setHotels] = useState<string[]>([...fallbackHotels]);
  const [marketOptions, setMarketOptions] =
    useState<readonly string[]>(fallbackMarkets);
  const [roomCategoryOptions, setRoomCategoryOptions] = useState<
    readonly string[]
  >(fallbackRoomCategories);
  const [mealBasisOptionsState, setMealBasisOptionsState] = useState<
    readonly string[]
  >([...mealBasisOptions]);
  const [currencyOptions, setCurrencyOptions] = useState<readonly string[]>([]);
  const [hotelMode, setHotelMode] = useState<"select" | "create">("select");
  const [hotelSelectValue, setHotelSelectValue] = useState("");
  const [selectedHotelName, setSelectedHotelName] = useState("");
  const [selectedHotelRateId, setSelectedHotelRateId] = useState<string>(
    initialEditId || "",
  );
  const [skippedSections, setSkippedSections] = useState<string[]>([]);
  const [activeSection, setActiveSection] =
    useState<string>("Basic Information");

  useEffect(() => {
    if (initialEditId) {
      void loadSelectedRateRecord(initialEditId);
    }
  }, [initialEditId]);

  const previewPaxText = useMemo(
    () => createFocRuleText(focRules, "Pax"),
    [focRules],
  );
  const previewGuideText = useMemo(
    () => createFocRuleText(focRules, "Guide"),
    [focRules],
  );

  const [lastPaxGen, setLastPaxGen] = useState("");
  const [lastGuideGen, setLastGuideGen] = useState("");

  useEffect(() => {
    const nextPaxGen = createFocRuleText(focRules, "Pax");
    const nextGuideGen = createFocRuleText(focRules, "Guide");

    let updated = false;
    let nextPaxVal = focRules.paxCustomText;
    let nextGuideVal = focRules.guideCustomText;

    if (!focRules.paxCustomText || focRules.paxCustomText === lastPaxGen) {
      if (focRules.paxCustomText !== nextPaxGen) {
        nextPaxVal = nextPaxGen;
        updated = true;
      }
    }

    if (
      !focRules.guideCustomText ||
      focRules.guideCustomText === lastGuideGen
    ) {
      if (focRules.guideCustomText !== nextGuideGen) {
        nextGuideVal = nextGuideGen;
        updated = true;
      }
    }

    if (updated) {
      setFocRules((prev) => ({
        ...prev,
        paxCustomText: nextPaxVal,
        guideCustomText: nextGuideVal,
      }));
    }

    setLastPaxGen(nextPaxGen);
    setLastGuideGen(nextGuideGen);
  }, [
    focRules.enabled,
    focRules.minimumPersons,
    focRules.focQuantity,
    focRules.basis,
    focRules.countAdults,
    focRules.countChild2_5,
    focRules.countChild6_11,
    focRules.appliesTo,
    lastPaxGen,
    lastGuideGen,
  ]);

  /* ---------- load hotels + selected hotel rate summaries ---------- */

  useEffect(() => {
    // Load hotels from API
    if (window.meridian?.listHotels) {
      void window.meridian
        .listHotels()
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
      void window.meridian
        .listMarkets()
        .then((refs: MarketRef[]) => {
          const codes = refs.map((m) => m.code).filter(Boolean);
          if (codes.length > 0) setMarketOptions(codes);
        })
        .catch(() => {});
    }

    // Load room categories from API
    if (window.meridian?.listRoomCategories) {
      void window.meridian
        .listRoomCategories()
        .then((refs: RoomCategoryRef[]) => {
          const names = refs.map((r) => r.name).filter(Boolean);
          if (names.length > 0) setRoomCategoryOptions(names);
        })
        .catch(() => {});
    }

    // Load meal basis from API
    if (window.meridian?.listMealBasis) {
      void window.meridian
        .listMealBasis()
        .then((refs: MealBasisRef[]) => {
          const codes = refs.map((b) => b.code).filter(Boolean);
          if (codes.length > 0) setMealBasisOptionsState(codes);
        })
        .catch(() => {});
    }

    // Load currencies from API
    if (window.meridian?.listCurrencies) {
      void window.meridian
        .listCurrencies()
        .then((refs: CurrencyRef[]) => {
          const codes = refs.map((c) => c.code).filter(Boolean);
          if (codes.length > 0) setCurrencyOptions(codes);
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
      })),
    );

    setChildRates(
      (record.child_rates ?? []).map((r) => ({
        from: r.from || "",
        to: r.to || "",
        roomCategory: r.room_category || "",
        basis: r.basis || "",
        age_2_5_sharing:
          r.age_2_5_99_sharing == null ? "" : String(r.age_2_5_99_sharing),
        age_2_5_extra_bed:
          r.age_2_5_99_extra_bed == null ? "" : String(r.age_2_5_99_extra_bed),
        age_2_5_own_room:
          r.age_2_5_99_own_room == null ? "" : String(r.age_2_5_99_own_room),
        age_6_11_sharing:
          r.age_6_11_99_sharing == null ? "" : String(r.age_6_11_99_sharing),
        age_6_11_extra_bed:
          r.age_6_11_99_extra_bed == null
            ? ""
            : String(r.age_6_11_99_extra_bed),
        age_6_11_own_room:
          r.age_6_11_99_own_room == null ? "" : String(r.age_6_11_99_own_room),
      })),
    );

    setRoomSupplements(
      (record.room_supplements ?? []).map((s) => ({
        roomCategory: s.room_category || "",
        supplementName: s.supplement_name || "",
        supplementAmount:
          s.supplement_amount == null ? "" : String(s.supplement_amount),
        per: s.per || "per room per night",
      })),
    );

    setGuideRates(
      Object.entries(record.guide_rates ?? {}).map(([basis, amount]) => ({
        basis,
        amount: amount == null ? "" : String(amount),
      })),
    );

    setSeasonalSurcharges(
      (record.seasonal_surcharges ?? []).map((s) => ({
        name: s.name ?? "",
        amount: s.amount == null ? "" : String(s.amount),
        from: String(s.date_from ?? ""),
        to: String(s.date_to ?? ""),
        appliesTo: String(s.applies_to ?? ""),
      })),
    );

    setEvents(
      (record.compulsory_events ?? []).map((e) => ({
        date: e.event_date ?? "",
        event: e.event_name ?? "",
        bb: e.bb_rate == null ? "" : String(e.bb_rate),
        hb:
          e.hb_rate == null
            ? (e as Record<string, unknown>).hbfb_rate == null
              ? ""
              : String((e as Record<string, unknown>).hbfb_rate)
            : String(e.hb_rate),
        fb:
          e.fb_rate == null
            ? (e as Record<string, unknown>).hbfb_rate == null
              ? ""
              : String((e as Record<string, unknown>).hbfb_rate)
            : String(e.fb_rate),
        per: String(e.per ?? "Person"),
        mandatory: Boolean(e.mandatory ?? true),
      })),
    );

    setFocRules({
      enabled: Boolean(record.foc_rules?.enabled ?? false),
      appliesTo: String(record.foc_rules?.applies_to ?? "Guide"),
      minimumPersons:
        record.foc_rules?.minimum_persons == null
          ? ""
          : String(record.foc_rules.minimum_persons),
      focQuantity:
        record.foc_rules?.foc_quantity == null
          ? "1"
          : String(record.foc_rules.foc_quantity),
      basis: String(record.foc_rules?.basis ?? "HB"),
      countAdults: Boolean(record.foc_rules?.count_adults ?? true),
      countChild2_5: Boolean(record.foc_rules?.count_child_2_5_99 ?? false),
      countChild6_11: Boolean(record.foc_rules?.count_child_6_11_99 ?? false),
      paxCustomText: record.foc_rules?.pax_custom_text ?? "",
      guideCustomText: record.foc_rules?.guide_custom_text ?? "",
    });

    setSkippedSections(record.skipped_sections || []);
    setBillingText(record.billing_instruction ?? "");
  }

  /* ---------- updaters ---------- */

  const updateContract = (field: keyof ContractDetails, value: string) =>
    setContract((cur) => ({ ...cur, [field]: value }));

  const addRate = () =>
    setRates([
      ...rates,
      {
        from: "",
        to: "",
        roomCategory: "",
        basis: "",
        sgl: "",
        dbl: "",
        twn: "",
        tpl: "",
      },
    ]);

  const updateRate = (i: number, field: keyof RateRow, value: string) => {
    const copy = [...rates];
    copy[i] = { ...copy[i], [field]: value };
    setRates(copy);
  };

  const removeRate = (i: number) =>
    setRates(rates.filter((_, idx) => idx !== i));

  const addChildRate = () =>
    setChildRates([
      ...childRates,
      {
        from: "",
        to: "",
        roomCategory: "",
        basis: "",
        age_2_5_sharing: "",
        age_2_5_extra_bed: "",
        age_2_5_own_room: "",
        age_6_11_sharing: "",
        age_6_11_extra_bed: "",
        age_6_11_own_room: "",
      },
    ]);

  const updateChildRate = (
    i: number,
    field: keyof ChildRateRow,
    value: string,
  ) => {
    const copy = [...childRates];
    copy[i] = { ...copy[i], [field]: value };
    setChildRates(copy);
  };

  const removeChildRate = (i: number) =>
    setChildRates(childRates.filter((_, idx) => idx !== i));

  const addSupplement = () =>
    setRoomSupplements([
      ...roomSupplements,
      {
        roomCategory: "",
        supplementName: "",
        supplementAmount: "",
        per: "per room per night",
      },
    ]);

  const updateSupplement = (
    i: number,
    field: keyof RoomSupplementRow,
    value: string,
  ) => {
    const copy = [...roomSupplements];
    copy[i] = { ...copy[i], [field]: value };
    setRoomSupplements(copy);
  };

  const removeSupplement = (i: number) =>
    setRoomSupplements(roomSupplements.filter((_, idx) => idx !== i));

  const addGuideRate = () =>
    setGuideRates([...guideRates, { basis: "", amount: "" }]);

  const updateGuideRate = (
    i: number,
    field: keyof GuideRateRow,
    value: string,
  ) => {
    const copy = [...guideRates];
    copy[i] = { ...copy[i], [field]: value };
    setGuideRates(copy);
  };

  const removeGuideRate = (i: number) =>
    setGuideRates(guideRates.filter((_, idx) => idx !== i));

  const addEvent = () =>
    setEvents([
      ...events,
      {
        date: "",
        event: "",
        bb: "",
        hb: "",
        fb: "",
        per: "Person",
        mandatory: true,
      },
    ]);

  const updateEvent = (
    i: number,
    field: keyof EventRow,
    value: string | boolean,
  ) => {
    const copy = [...events];
    copy[i] = { ...copy[i], [field]: value } as EventRow;
    setEvents(copy);
  };

  const removeEvent = (i: number) =>
    setEvents(events.filter((_, idx) => idx !== i));

  const addSeasonalSurcharge = () =>
    setSeasonalSurcharges([
      ...seasonalSurcharges,
      { name: "", amount: "", from: "", to: "", appliesTo: "" },
    ]);

  const updateSeasonalSurcharge = (
    i: number,
    field: keyof (typeof seasonalSurcharges)[number],
    value: string,
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
    setSelectedHotelRateId("");
    setContract({
      hotelName: "",
      market: "",
      currency: "",
      contractName: "",
      validFrom: "",
      validTo: "",
    });
    setRates([]);
    setChildRates([]);
    setRoomSupplements([]);
    setGuideRates([]);
    setSeasonalSurcharges([]);
    setEvents([]);
    setFocRules({
      enabled: false,
      appliesTo: "Guide",
      minimumPersons: "",
      focQuantity: "1",
      basis: "",
      countAdults: true,
      countChild2_5: false,
      countChild6_11: false,
      paxCustomText: "",
      guideCustomText: "",
    });
    setSkippedSections([]);
    setBillingText("");
    setSaveNotice("Cleared");
    if (addNotice) addNotice("Rate master form cleared", "info");
  }

  function sectionStatus(sectionName: string, isEmpty: boolean): SectionStatus {
    if (skippedSections.includes(sectionName)) return "Skipped";
    return isEmpty ? "Empty" : "Completed";
  }

  function toggleSkip(sectionName: string) {
    setSkippedSections((cur) =>
      cur.includes(sectionName)
        ? cur.filter((s) => s !== sectionName)
        : [...cur, sectionName],
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

    const roomRatesEmpty =
      rates.length === 0 ||
      rates.some(
        (r) =>
          !r.roomCategory || !r.basis || !r.sgl || !r.dbl || !r.twn || !r.tpl,
      );
    const childRatesEmpty =
      childRates.length === 0 ||
      childRates.some(
        (r) =>
          !r.roomCategory ||
          !r.basis ||
          (!r.age_2_5_sharing &&
            !r.age_2_5_extra_bed &&
            !r.age_2_5_own_room &&
            !r.age_6_11_sharing &&
            !r.age_6_11_extra_bed &&
            !r.age_6_11_own_room),
      );
    const supplementsEmpty =
      roomSupplements.length === 0 ||
      roomSupplements.some((s) => !s.supplementName || !s.supplementAmount);
    const guideRatesEmpty =
      guideRates.length === 0 ||
      guideRates.some((r) => !r.basis.trim() || !r.amount.trim());
    const seasonalEmpty =
      seasonalSurcharges.length === 0 ||
      seasonalSurcharges.some(
        (s) => !s.name || !s.amount || !s.from || !s.to || !s.appliesTo,
      );
    const eventsEmpty =
      events.length === 0 ||
      events.some((e) => !e.date || !e.event || !e.bb || !e.hb || !e.fb);
    const focEmpty =
      !focRules.enabled ||
      !focRules.appliesTo ||
      !focRules.minimumPersons ||
      !focRules.focQuantity ||
      !focRules.basis;
    const billingEmpty = !billingText.trim();

    return [
      {
        name: "Basic Information",
        status: sectionStatus("Basic Information", basicEmpty),
        empty: basicEmpty,
      },
      {
        name: "Room Rates",
        status: sectionStatus("Room Rates", roomRatesEmpty),
        empty: roomRatesEmpty,
      },
      {
        name: "Child Rates",
        status: sectionStatus("Child Rates", childRatesEmpty),
        empty: childRatesEmpty,
      },
      {
        name: "Room Supplements",
        status: sectionStatus("Room Supplements", supplementsEmpty),
        empty: supplementsEmpty,
      },
      {
        name: "Guide Rates",
        status: sectionStatus("Guide Rates", guideRatesEmpty),
        empty: guideRatesEmpty,
      },
      {
        name: "FOC Rule",
        status: sectionStatus("FOC Rule", focEmpty),
        empty: focEmpty,
      },
      {
        name: "Seasonal Surcharges",
        status: sectionStatus("Seasonal Surcharges", seasonalEmpty),
        empty: seasonalEmpty,
      },
      {
        name: "Compulsory Events",
        status: sectionStatus("Compulsory Events", eventsEmpty),
        empty: eventsEmpty,
      },
      {
        name: "Billing Instructions",
        status: sectionStatus("Billing Instructions", billingEmpty),
        empty: billingEmpty,
      },
    ] as const;
  }, [
    billingText,
    contract,
    events,
    focRules,
    guideRates,
    rates,
    roomSupplements,
    seasonalSurcharges,
    childRates,
    skippedSections,
  ]);

  const canSave = sectionStates.every((s) => s.status !== "Empty");

  /* ---------- save to backend ---------- */

  async function handleSave() {
    if (!window.meridian?.saveHotelRates) {
      setSaveNotice("Desktop bridge unavailable");
      return;
    }

    if (!canSave) {
      setSaveNotice(
        "Cannot save: empty sections must be completed or skipped.",
      );
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
          age_2_5_99_sharing: r.age_2_5_sharing || null,
          age_2_5_99_extra_bed: r.age_2_5_extra_bed || null,
          age_2_5_99_own_room: r.age_2_5_own_room || null,
          age_6_11_99_sharing: r.age_6_11_sharing || null,
          age_6_11_99_extra_bed: r.age_6_11_extra_bed || null,
          age_6_11_99_own_room: r.age_6_11_own_room || null,
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
            .map((row) => [
              row.basis.trim().toUpperCase(),
              row.amount ? Number(row.amount) : null,
            ]),
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
          minimum_persons: focRules.minimumPersons
            ? Number(focRules.minimumPersons)
            : null,
          foc_quantity: focRules.focQuantity
            ? Number(focRules.focQuantity)
            : null,
          basis: focRules.basis,
          count_adults: focRules.countAdults,
          count_child_2_5_99: focRules.countChild2_5,
          count_child_6_11_99: focRules.countChild6_11,
          pax_custom_text: focRules.paxCustomText,
          guide_custom_text: focRules.guideCustomText,
        },
        skipped_sections: skippedSections,
        billing_instruction: billingText,
      };

      const result = await window.meridian.saveHotelRates(payload);
      const savedName = contract.hotelName;

      // Update hotels list if it's a new hotel
      setHotels((cur) =>
        cur.includes(savedName)
          ? cur
          : [...cur, savedName].sort((a, b) => a.localeCompare(b)),
      );

      // Sync selection states
      setSelectedHotelName(savedName);
      setHotelSelectValue(savedName);
      setHotelMode("select");

      setSelectedHotelRateId(result.id);
      setSaveNotice("");
      if (addNotice)
        addNotice(
          `Rate master saved successfully (${result.id.slice(0, 8)})`,
          "success",
        );
      if (onRatesChanged) onRatesChanged();
    } catch (error) {
      const msg = friendlyErrorMessage(error, "Unable to save rates");
      setSaveNotice(msg);
      if (addNotice) addNotice(msg, "error");
    } finally {
      setIsSaving(false);
    }
  }

  /* ---------- table helper class ---------- */

  const cellControl = "app-table-control";

  const cellSelect = "app-table-control";

  const activeSectionIndex = useMemo(() => {
    return sectionStates.findIndex((s) => s.name === activeSection);
  }, [sectionStates, activeSection]);

  return (
    <div className="mx-auto max-w-[1400px] p-4 md:p-8">
      {/* Page header */}
      <div className="mb-6 flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-line/65 pb-5">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-steel">
            Operations / Data Management
          </p>
          <h2 className="mt-1 font-display text-3xl font-bold text-navy">
            Rate Master
          </h2>
          <p className="mt-2 text-sm text-steel">
            Create or update hotel contract rates, room categories, markets, and
            seasonal surcharges in the rate master.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {onManageRates && (
            <Button
              variant="secondary"
              onClick={onManageRates}
              className="h-10 px-4 whitespace-nowrap shrink-0"
            >
              Manage Rates
            </Button>
          )}
          {onBack && (
            <Button
              variant="secondary"
              onClick={onBack}
              className="h-10 px-4 whitespace-nowrap shrink-0"
            >
              Back to Entry
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 items-start">
        {/* Left Side: Sidebar HUD & Hotel Selection */}
        <div className="xl:col-span-3 space-y-5 xl:sticky xl:top-6">
          {/* Hotel Selection */}
          <Panel className="app-panel-body-lg">
            <div className="space-y-4">
              <div>
                <div className="mb-2.5">
                  <p className="text-xs font-bold uppercase tracking-wide text-steel">
                    Hotel
                  </p>
                  <div className="grid grid-cols-2 w-full mt-2 rounded-app border border-line bg-cloud p-0.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => setHotelMode("select")}
                      className={`rounded py-1 text-center text-[10px] font-bold transition ${
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
                      className={`flex items-center justify-center gap-1 rounded py-1 text-[10px] font-bold transition ${
                        hotelMode === "create"
                          ? "bg-surface text-navy shadow-sm"
                          : "text-steel hover:text-ink"
                      }`}
                    >
                      <Plus size={10} /> Create
                    </button>
                  </div>
                </div>

                {hotelMode === "select" ? (
                  <Select
                    className="w-full text-xs font-semibold text-ink"
                    aria-label="Select hotel"
                    value={hotelSelectValue}
                    onChange={(e) => {
                      const value = e.target.value;
                      setHotelSelectValue(value);
                      setSelectedHotelName(value);
                      setSelectedHotelRateId("");
                      setContract({
                        hotelName: value,
                        market: "",
                        currency: "",
                        contractName: "",
                        validFrom: "",
                        validTo: "",
                      });
                      setRates([]);
                      setChildRates([]);
                      setRoomSupplements([]);
                      setGuideRates([]);
                      setSeasonalSurcharges([]);
                      setEvents([]);
                      setFocRules({
                        enabled: false,
                        appliesTo: "Guide",
                        minimumPersons: "15",
                        focQuantity: "1",
                        basis: "",
                        countAdults: true,
                        countChild2_5: false,
                        countChild6_11: false,
                        paxCustomText: "",
                        guideCustomText: "",
                      });
                      setSkippedSections([]);
                      setBillingText("");
                    }}
                  >
                    <option value="">Select a Hotel</option>
                    {hotels.map((h) => (
                      <option value={h} key={h}>
                        {h}
                      </option>
                    ))}
                  </Select>
                ) : (
                  <input
                    className={`${controlClass} text-xs font-semibold`}
                    aria-label="New hotel name"
                    placeholder="Grand Hotel – Colombo"
                    value={contract.hotelName}
                    autoFocus
                    onChange={(e) =>
                      setContract((cur) => ({
                        ...cur,
                        hotelName: e.target.value,
                      }))
                    }
                  />
                )}

                {hotelMode === "create" && selectedHotelName && (
                  <p className="mt-2 flex items-center gap-2 rounded bg-green-50 px-2 py-1 text-[10px] font-bold text-green-700">
                    <CheckCircle2 size={12} /> {selectedHotelName}
                  </p>
                )}
              </div>
            </div>
          </Panel>

          {/* Section selector HUD */}
          <Panel className="app-panel-body-lg">
            <h3 className="mb-4 app-section-title">Contract Progress</h3>
            <div className="space-y-1">
              {sectionStates.map((s, idx) => {
                const isActive = activeSection === s.name;
                const status = s.status;
                const dotColor =
                  status === "Completed"
                    ? "bg-emerald-500"
                    : status === "Skipped"
                      ? "bg-amber-500"
                      : "bg-rose-500";

                return (
                  <button
                    key={s.name}
                    type="button"
                    onClick={() => setActiveSection(s.name)}
                    className={`flex items-center justify-between w-full rounded-md px-3 py-2 text-left text-xs font-semibold transition ${
                      isActive
                        ? "bg-navy text-white shadow-sm"
                        : "text-steel hover:bg-cloud hover:text-navy"
                    }`}
                  >
                    <span className="truncate">
                      {idx + 1}. {s.name}
                    </span>
                    <span
                      className={`h-2 w-2 rounded-full shrink-0 ${dotColor} ${
                        isActive ? "ring-2 ring-white" : ""
                      }`}
                    />
                  </button>
                );
              })}
            </div>
          </Panel>

          {/* Actions HUD panel */}
          <Panel className="app-panel-body-lg space-y-4">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-steel">
                Save Verification
              </p>
              <p className="mt-1 text-[10px] text-steel">
                All sections must be Complete or Skipped to save.
              </p>
            </div>

            {sectionStates.some((s) => s.status === "Empty") ? (
              <div className="flex items-start gap-2 rounded-app border border-rose-500/20 bg-rose-500/10 p-2.5">
                <AlertTriangle
                  size={14}
                  className="text-rose-500 shrink-0 mt-0.5"
                />
                <p className="text-[10px] font-bold text-rose-600">
                  {sectionStates.filter((s) => s.status === "Empty").length}{" "}
                  section(s) require action
                </p>
              </div>
            ) : (
              <div className="flex items-start gap-2 rounded-app border border-emerald-500/20 bg-emerald-500/10 p-2.5">
                <CheckCircle2
                  size={14}
                  className="text-emerald-500 shrink-0 mt-0.5"
                />
                <p className="text-[10px] font-bold text-emerald-600">
                  Contract validation passed. Ready to save!
                </p>
              </div>
            )}

            <div className="space-y-2 pt-1 border-t border-line/40">
              <Button
                type="button"
                variant="primary"
                disabled={isSaving || !canSave}
                onClick={handleSave}
                className="w-full py-2.5 text-xs font-bold shadow-md"
              >
                <Save size={14} /> {isSaving ? "Saving..." : "Save Data"}
              </Button>
              <Button
                type="button"
                variant="secondary"
                disabled={isSaving}
                onClick={clearAll}
                className="w-full py-2.5 text-xs font-bold"
              >
                <RotateCcw size={14} /> Clear Form
              </Button>
            </div>

            {saveNotice && (
              <p className="text-[10px] font-bold text-rose-600 text-center leading-normal break-words">
                {saveNotice}
              </p>
            )}
          </Panel>
        </div>

        {/* Right Side: Active Section Form Sheet */}
        <div className="xl:col-span-9 space-y-6">
          {/* Section navigation header bar */}
          <div className="flex items-center justify-between bg-surface border border-line rounded-lg p-4 shadow-sm">
            <Button
              type="button"
              variant="secondary"
              disabled={activeSectionIndex === 0}
              onClick={() =>
                setActiveSection(sectionStates[activeSectionIndex - 1].name)
              }
              className="px-4 py-2 text-xs font-bold"
            >
              Previous Section
            </Button>

            {activeSection !== "Basic Information" &&
              activeSection !== "Room Rates" &&
              activeSection !== "Guide Rates" && (
                <button
                  type="button"
                  onClick={() => toggleSkip(activeSection)}
                  className={`flex items-center gap-1.5 rounded-app px-3 py-2 text-xs font-bold transition-all ${
                    skippedSections.includes(activeSection)
                      ? "bg-amber-50 text-amber-700 border border-amber-200"
                      : "bg-cloud text-steel hover:bg-line hover:text-navy border border-line"
                  }`}
                >
                  <SkipForward size={14} />
                  {skippedSections.includes(activeSection)
                    ? "Undo Skip"
                    : "Skip Section"}
                </button>
              )}

            <Button
              type="button"
              variant={activeSectionIndex === 8 ? "primary" : "secondary"}
              disabled={activeSectionIndex === 8 && (!canSave || isSaving)}
              onClick={() => {
                if (activeSectionIndex === 8) {
                  void handleSave();
                } else {
                  setActiveSection(sectionStates[activeSectionIndex + 1].name);
                }
              }}
              className="px-4 py-2 text-xs font-bold"
            >
              {activeSectionIndex === 8 ? "Save Contract" : "Next Section"}
            </Button>
          </div>

          {/* Active section sheet renderer */}
          <div className="transition-all duration-200">
            {activeSection === "Basic Information" && (
              <Section id="sec-basic" title="1. Basic Information">
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
                    <Select
                      className="w-full"
                      title="Market"
                      value={contract.market}
                      onChange={(e) => updateContract("market", e.target.value)}
                    >
                      <option value="">Select Market</option>
                      {marketOptions.map((m: string) => (
                        <option value={m} key={m}>
                          {m}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Field label="Currency">
                    <Select
                      className="w-full"
                      title="Currency"
                      value={contract.currency}
                      onChange={(e) =>
                        updateContract("currency", e.target.value)
                      }
                    >
                      <option value="">Select Currency</option>
                      {currencyOptions.map((c) => (
                        <option value={c} key={c}>
                          {c}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Field label="Contract Name">
                    <input
                      className={controlClass}
                      title="Contract Name"
                      value={contract.contractName}
                      onChange={(e) =>
                        updateContract("contractName", e.target.value)
                      }
                      placeholder="Winter 25/26"
                    />
                  </Field>
                  <Field label="Valid From">
                    <input
                      type="date"
                      className={controlClass}
                      aria-label="Valid from"
                      title="Valid from"
                      value={contract.validFrom}
                      onChange={(e) =>
                        updateContract("validFrom", e.target.value)
                      }
                    />
                  </Field>
                  <Field label="Valid To">
                    <input
                      type="date"
                      className={controlClass}
                      aria-label="Valid to"
                      title="Valid to"
                      value={contract.validTo}
                      onChange={(e) =>
                        updateContract("validTo", e.target.value)
                      }
                    />
                  </Field>
                </div>
              </Section>
            )}

            {activeSection === "Room Rates" && (
              <Section id="sec-room-rates" title="2. Room Rates">
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
                        <th className="px-4 py-3 text-left font-bold text-navy uppercase tracking-wider text-[11px]">
                          Room Category
                        </th>
                        {["Basis", "SGL", "DBL", "TWN", "TPL", ""].map((h) => (
                          <th className="px-2 py-3" key={h || "action"}>
                            {h}
                          </th>
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
                              onChange={(e) =>
                                updateRate(i, "roomCategory", e.target.value)
                              }
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
                              onChange={(e) =>
                                updateRate(i, "basis", e.target.value)
                              }
                            >
                              <option value="">Select Basis</option>
                              {mealBasisOptionsState.map((opt) => (
                                <option value={opt} key={opt}>
                                  {opt}
                                </option>
                              ))}
                            </Select>
                          </td>
                          <td className="px-2 py-2">
                            <input
                              type="number"
                              step="1"
                              className={cellControl}
                              aria-label="Single rate"
                              title="Single rate"
                              value={rate.sgl}
                              onChange={(e) =>
                                updateRate(
                                  i,
                                  "sgl",
                                  e.target.value.replace(/\D/g, ""),
                                )
                              }
                            />
                          </td>
                          <td className="px-2 py-2">
                            <input
                              type="number"
                              step="1"
                              className={cellControl}
                              aria-label="Double rate"
                              title="Double rate"
                              value={rate.dbl}
                              onChange={(e) =>
                                updateRate(
                                  i,
                                  "dbl",
                                  e.target.value.replace(/\D/g, ""),
                                )
                              }
                            />
                          </td>
                          <td className="px-2 py-2">
                            <input
                              type="number"
                              step="1"
                              className={cellControl}
                              aria-label="Twin rate"
                              title="Twin rate"
                              value={rate.twn}
                              onChange={(e) =>
                                updateRate(
                                  i,
                                  "twn",
                                  e.target.value.replace(/\D/g, ""),
                                )
                              }
                            />
                          </td>
                          <td className="px-2 py-2">
                            <input
                              type="number"
                              step="1"
                              className={cellControl}
                              aria-label="Triple rate"
                              title="Triple rate"
                              value={rate.tpl}
                              onChange={(e) =>
                                updateRate(
                                  i,
                                  "tpl",
                                  e.target.value.replace(/\D/g, ""),
                                )
                              }
                            />
                          </td>
                          <td className="px-2 py-2">
                            <button
                              type="button"
                              onClick={() => removeRate(i)}
                              className="rounded-app p-2 text-steel hover:bg-rose-500/10 hover:text-rose-500"
                              title="Remove row"
                            >
                              <Trash2 size={16} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <button
                  type="button"
                  onClick={addRate}
                  className="mt-4 flex items-center gap-2 rounded-app border border-line px-3 py-2 text-sm font-bold text-navy"
                >
                  <Plus size={16} /> Add Rate Row
                </button>
              </Section>
            )}

            {activeSection === "Child Rates" && (
              <Section id="sec-child-rates" title="3. Child Rates">
                <div className="mb-5 flex items-center justify-between">
                  <StatusPill status={sectionStates[2].status} />
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
                        <th className="px-4 py-3 text-left font-bold text-navy uppercase tracking-wider text-[11px] w-[180px]">
                          Room Category
                        </th>
                        <th className="px-2 py-3 w-[90px]">Basis</th>
                        <th
                          className="px-2 py-3 text-center border-x border-line"
                          colSpan={3}
                        >
                          Child (2-5.99)
                        </th>
                        <th className="px-2 py-3 text-center" colSpan={3}>
                          Child (6-11.99)
                        </th>
                        <th className="px-2 py-3 w-[50px]"></th>
                      </tr>
                      <tr className="border-b border-line bg-cloud/50 text-[10px] font-bold uppercase tracking-wider text-steel">
                        <th className="px-4 py-1"></th>
                        <th className="px-2 py-1"></th>
                        <th className="px-2 py-1 text-center border-l border-line">
                          Sharing
                        </th>
                        <th className="px-2 py-1 text-center">Bed</th>
                        <th className="px-2 py-1 text-center border-r border-line">
                          Own Room
                        </th>
                        <th className="px-2 py-1 text-center">Sharing</th>
                        <th className="px-2 py-1 text-center">Bed</th>
                        <th className="px-2 py-1 text-center">Own Room</th>
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
                              onChange={(e) =>
                                updateChildRate(
                                  i,
                                  "roomCategory",
                                  e.target.value,
                                )
                              }
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
                              onChange={(e) =>
                                updateChildRate(i, "basis", e.target.value)
                              }
                            >
                              <option value="">Select Basis</option>
                              {mealBasisOptionsState.map((opt) => (
                                <option value={opt} key={opt}>
                                  {opt}
                                </option>
                              ))}
                            </Select>
                          </td>
                          <td className="px-2 py-2 border-l border-line">
                            <input
                              className={cellControl}
                              aria-label="2-5 sharing"
                              value={rate.age_2_5_sharing}
                              onChange={(e) =>
                                updateChildRate(
                                  i,
                                  "age_2_5_sharing",
                                  e.target.value,
                                )
                              }
                            />
                          </td>
                          <td className="px-2 py-2">
                            <input
                              className={cellControl}
                              aria-label="2-5 bed"
                              value={rate.age_2_5_extra_bed}
                              onChange={(e) =>
                                updateChildRate(
                                  i,
                                  "age_2_5_extra_bed",
                                  e.target.value,
                                )
                              }
                            />
                          </td>
                          <td className="px-2 py-2 border-r border-line">
                            <input
                              className={cellControl}
                              aria-label="2-5 own room"
                              value={rate.age_2_5_own_room}
                              onChange={(e) =>
                                updateChildRate(
                                  i,
                                  "age_2_5_own_room",
                                  e.target.value,
                                )
                              }
                            />
                          </td>
                          <td className="px-2 py-2">
                            <input
                              className={cellControl}
                              aria-label="6-11 sharing"
                              value={rate.age_6_11_sharing}
                              onChange={(e) =>
                                updateChildRate(
                                  i,
                                  "age_6_11_sharing",
                                  e.target.value,
                                )
                              }
                            />
                          </td>
                          <td className="px-2 py-2">
                            <input
                              className={cellControl}
                              aria-label="6-11 bed"
                              value={rate.age_6_11_extra_bed}
                              onChange={(e) =>
                                updateChildRate(
                                  i,
                                  "age_6_11_extra_bed",
                                  e.target.value,
                                )
                              }
                            />
                          </td>
                          <td className="px-2 py-2">
                            <input
                              className={cellControl}
                              aria-label="6-11 own room"
                              value={rate.age_6_11_own_room}
                              onChange={(e) =>
                                updateChildRate(
                                  i,
                                  "age_6_11_own_room",
                                  e.target.value,
                                )
                              }
                            />
                          </td>
                          <td className="px-2 py-2">
                            <button
                              type="button"
                              onClick={() => removeChildRate(i)}
                              className="rounded-app p-2 text-steel hover:bg-rose-500/10 hover:text-rose-500"
                              title="Remove row"
                            >
                              <Trash2 size={16} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <button
                  type="button"
                  onClick={addChildRate}
                  className="mt-4 flex items-center gap-2 rounded-app border border-line px-3 py-2 text-sm font-bold text-navy"
                >
                  <Plus size={16} /> Add Child Rate Row
                </button>
              </Section>
            )}

            {activeSection === "Room Supplements" && (
              <Section id="sec-room-supplements" title="4. Room Supplements">
                <div className="mb-5 flex items-center justify-between">
                  <StatusPill status={sectionStates[3].status} />
                </div>
                {sectionStates[3].status === "Empty" && (
                  <p className="mb-4 flex items-center gap-2 rounded-app border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm font-semibold text-red-500">
                    <AlertTriangle size={16} /> This section is empty
                  </p>
                )}
                <p className="mb-4 text-xs text-steel">
                  Flat per-room-per-night uplift for upgraded room categories
                  (e.g. Deluxe Supplement, Suite Supplement). These appear in
                  the Rate Applicable text automatically.
                </p>
                <div className="thin-scrollbar overflow-x-auto">
                  <table className="w-full min-w-[600px] table-fixed border-collapse text-sm">
                    <thead>
                      <tr className="border-y border-line bg-cloud text-left text-xs font-bold uppercase tracking-wide text-steel">
                        <th className="px-4 py-3 text-[11px] font-bold text-navy uppercase tracking-wider">
                          Room Category
                        </th>
                        <th className="px-2 py-3 text-[11px] font-bold text-navy uppercase tracking-wider">
                          Supplement Name
                        </th>
                        <th className="px-2 py-3 text-[11px] font-bold text-navy uppercase tracking-wider">
                          Amount
                        </th>
                        <th className="px-2 py-3 text-[11px] font-bold text-navy uppercase tracking-wider">
                          Per
                        </th>
                        <th className="px-2 py-3 w-[60px]"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line">
                      {roomSupplements.map((supp, i) => (
                        <tr key={i}>
                          <td className="px-4 py-2">
                            <Select
                              className={selectClass}
                              aria-label="Supplement room category"
                              title="Supplement room category"
                              value={supp.roomCategory}
                              onChange={(e) =>
                                updateSupplement(
                                  i,
                                  "roomCategory",
                                  e.target.value,
                                )
                              }
                            >
                              <option value="">Select category</option>
                              {roomCategoryOptions.map((cat) => (
                                <option key={cat} value={cat}>
                                  {cat}
                                </option>
                              ))}
                            </Select>
                          </td>
                          <td className="px-2 py-2">
                            <input
                              className={controlClass}
                              aria-label="Supplement name"
                              title="Supplement name"
                              placeholder="Deluxe Room Supplement"
                              value={supp.supplementName}
                              onChange={(e) =>
                                updateSupplement(
                                  i,
                                  "supplementName",
                                  e.target.value,
                                )
                              }
                            />
                          </td>
                          <td className="px-2 py-2">
                            <input
                              type="number"
                              step="1"
                              className={controlClass}
                              aria-label="Supplement amount"
                              title="Supplement amount"
                              placeholder="20"
                              value={supp.supplementAmount}
                              onChange={(e) =>
                                updateSupplement(
                                  i,
                                  "supplementAmount",
                                  e.target.value,
                                )
                              }
                            />
                          </td>
                          <td className="px-2 py-2">
                            <input
                              className={controlClass}
                              aria-label="Supplement per unit"
                              title="Supplement per unit"
                              placeholder="per room per night"
                              value={supp.per}
                              onChange={(e) =>
                                updateSupplement(i, "per", e.target.value)
                              }
                            />
                          </td>
                          <td className="px-2 py-2 text-center">
                            <button
                              type="button"
                              onClick={() => removeSupplement(i)}
                              className="rounded-app p-2 text-steel hover:bg-rose-500/10 hover:text-rose-500"
                              title="Remove supplement"
                            >
                              <Trash2 size={16} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <button
                  type="button"
                  onClick={addSupplement}
                  className="mt-4 flex items-center gap-2 rounded-app border border-line px-3 py-2 text-sm font-bold text-navy"
                >
                  <Plus size={16} /> Add Supplement Row
                </button>
              </Section>
            )}

            {activeSection === "Guide Rates" && (
              <Section id="sec-guide-rates" title="5. Guide Rates">
                <div className="mb-5 flex items-center justify-between">
                  <StatusPill status={sectionStates[4].status} />
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
                        <th className="px-4 py-3 text-[11px] font-bold text-navy uppercase tracking-wider">
                          Guide Basis
                        </th>
                        <th className="px-2 py-3 text-[11px] font-bold text-navy uppercase tracking-wider">
                          Amount
                        </th>
                        <th className="px-2 py-3 w-[60px]"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line">
                      {guideRates.map((rate, i) => (
                        <tr key={`${rate.basis}-${i}`}>
                          <td className="px-4 py-2">
                            <Select
                              className={cellSelect}
                              aria-label="Guide basis"
                              title="Guide basis"
                              value={rate.basis}
                              onChange={(e) =>
                                updateGuideRate(i, "basis", e.target.value)
                              }
                            >
                              <option value="">Select basis</option>
                              {mealBasisOptionsState.map((basis) => (
                                <option key={basis} value={basis}>
                                  {basis}
                                </option>
                              ))}
                            </Select>
                          </td>
                          <td className="px-2 py-2">
                            <input
                              type="number"
                              step="1"
                              className={cellControl}
                              aria-label="Guide rate amount"
                              title="Guide rate amount"
                              placeholder="Amount"
                              value={rate.amount}
                              onChange={(e) =>
                                updateGuideRate(
                                  i,
                                  "amount",
                                  e.target.value.replace(/\D/g, ""),
                                )
                              }
                            />
                          </td>
                          <td className="px-2 py-2 text-center">
                            <button
                              type="button"
                              onClick={() => removeGuideRate(i)}
                              className="rounded-app p-2 text-steel hover:bg-rose-500/10 hover:text-rose-500"
                              title="Remove guide rate"
                            >
                              <Trash2 size={16} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <button
                  type="button"
                  onClick={addGuideRate}
                  className="mt-4 flex items-center gap-2 rounded-app border border-line px-3 py-2 text-sm font-bold text-navy"
                >
                  <Plus size={16} /> Add Guide Rate
                </button>
              </Section>
            )}

            {activeSection === "FOC Rule" && (
              <Section id="sec-foc-rules" title="6. FOC Rule">
                <div className="mb-5 flex items-center justify-between">
                  <StatusPill status={sectionStates[5].status} />
                </div>
                {sectionStates[5].status === "Empty" && (
                  <p className="mb-4 flex items-center gap-2 rounded-app border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm font-semibold text-red-500">
                    <AlertTriangle size={16} /> This section is empty
                  </p>
                )}
                <div className="rounded-app border border-line bg-cloud p-4">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <p className="text-xs font-bold uppercase tracking-wide text-steel">
                      FOC by Number of Persons
                    </p>
                    <label className="flex items-center gap-2 text-sm font-bold text-navy">
                      <input
                        type="checkbox"
                        checked={focRules.enabled}
                        onChange={(e) =>
                          setFocRules({
                            ...focRules,
                            enabled: e.target.checked,
                          })
                        }
                        className="accent-navy"
                      />
                      Enable FOC
                    </label>
                  </div>
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                    <Field label="Minimum Persons">
                      <input
                        type="number"
                        step="1"
                        className={controlClass}
                        title="Minimum Persons"
                        value={focRules.minimumPersons}
                        onChange={(e) =>
                          setFocRules({
                            ...focRules,
                            minimumPersons: e.target.value.replace(/\D/g, ""),
                          })
                        }
                        placeholder="15"
                      />
                    </Field>
                    <Field label="FOC Quantity">
                      <input
                        type="number"
                        step="1"
                        className={controlClass}
                        title="FOC Quantity"
                        value={focRules.focQuantity}
                        onChange={(e) =>
                          setFocRules({
                            ...focRules,
                            focQuantity: e.target.value.replace(/\D/g, ""),
                          })
                        }
                        placeholder="1"
                      />
                    </Field>
                    <Field label="Basis (select all that apply)">
                      <div className="flex flex-wrap items-center gap-4 py-2">
                        {mealBasisOptionsState.map((opt) => {
                          const selected = focRules.basis
                            .split(",")
                            .filter(Boolean);
                          const isChecked = selected.includes(opt);
                          return (
                            <label
                              key={opt}
                              className="flex items-center gap-1.5 text-sm font-bold text-navy cursor-pointer"
                            >
                              <input
                                type="checkbox"
                                className="h-4 w-4 accent-navy"
                                checked={isChecked}
                                onChange={(e) => {
                                  const next = e.target.checked
                                    ? [...selected, opt]
                                    : selected.filter((b) => b !== opt);
                                  setFocRules({
                                    ...focRules,
                                    basis: next.join(","),
                                  });
                                }}
                              />
                              {opt}
                            </label>
                          );
                        })}
                      </div>
                    </Field>
                    <Field label="Count Towards Minimum Persons (select all that apply)">
                      <div className="flex flex-wrap items-center gap-4 py-2">
                        <label className="flex items-center gap-1.5 text-sm font-bold text-navy cursor-pointer">
                          <input
                            type="checkbox"
                            className="h-4 w-4 accent-navy"
                            checked={focRules.countAdults}
                            onChange={(e) =>
                              setFocRules({
                                ...focRules,
                                countAdults: e.target.checked,
                              })
                            }
                          />
                          Adults / Rooms
                        </label>
                        <label className="flex items-center gap-1.5 text-sm font-bold text-navy cursor-pointer">
                          <input
                            type="checkbox"
                            className="h-4 w-4 accent-navy"
                            checked={focRules.countChild2_5}
                            onChange={(e) =>
                              setFocRules({
                                ...focRules,
                                countChild2_5: e.target.checked,
                              })
                            }
                          />
                          Child (2-5.99)
                        </label>
                        <label className="flex items-center gap-1.5 text-sm font-bold text-navy cursor-pointer">
                          <input
                            type="checkbox"
                            className="h-4 w-4 accent-navy"
                            checked={focRules.countChild6_11}
                            onChange={(e) =>
                              setFocRules({
                                ...focRules,
                                countChild6_11: e.target.checked,
                              })
                            }
                          />
                          Child (6-11.99)
                        </label>
                      </div>
                    </Field>

                    <div className="lg:col-span-3 border-t border-line/50 pt-4 mt-2">
                      <p className="text-xs font-bold uppercase tracking-wide text-steel mb-3">
                        Applies To & Rule Descriptions
                      </p>
                      <div className="space-y-4">
                        {/* Pax Row */}
                        <div className="flex flex-col md:flex-row md:items-center gap-4 bg-cloud p-3 rounded-app border border-line/30">
                          <label className="flex items-center gap-2 text-sm font-bold text-navy cursor-pointer min-w-[120px] select-none">
                            <input
                              type="checkbox"
                              className="h-4 w-4 accent-navy"
                              checked={focRules.appliesTo
                                .toLowerCase()
                                .includes("pax")}
                              onChange={(e) => {
                                const selected = focRules.appliesTo
                                  .split(",")
                                  .map((x) => x.trim())
                                  .filter(Boolean);
                                const next = e.target.checked
                                  ? [
                                      ...selected.filter(
                                        (x) => x.toLowerCase() !== "pax",
                                      ),
                                      "Pax",
                                    ]
                                  : selected.filter(
                                      (x) => x.toLowerCase() !== "pax",
                                    );
                                setFocRules({
                                  ...focRules,
                                  appliesTo: next.join(","),
                                });
                              }}
                            />
                            Pax FOC
                          </label>
                          <div className="flex-1">
                            {focRules.appliesTo
                              .toLowerCase()
                              .includes("pax") ? (
                              <div className="flex flex-col gap-1 w-full">
                                <label className="text-[10px] font-bold uppercase tracking-wider text-steel">
                                  Rule Description (Pax)
                                </label>
                                <input
                                  className={controlClass}
                                  title="Rule Description (Pax)"
                                  value={focRules.paxCustomText}
                                  onChange={(e) =>
                                    setFocRules({
                                      ...focRules,
                                      paxCustomText: e.target.value,
                                    })
                                  }
                                  placeholder={previewPaxText}
                                />
                              </div>
                            ) : (
                              <span className="text-xs text-steel italic flex items-center min-h-[38px]">
                                Check Pax FOC to customize rule description
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Guide Row */}
                        <div className="flex flex-col md:flex-row md:items-center gap-4 bg-cloud p-3 rounded-app border border-line/30">
                          <label className="flex items-center gap-2 text-sm font-bold text-navy cursor-pointer min-w-[120px] select-none">
                            <input
                              type="checkbox"
                              className="h-4 w-4 accent-navy"
                              checked={focRules.appliesTo
                                .toLowerCase()
                                .includes("guide")}
                              onChange={(e) => {
                                const selected = focRules.appliesTo
                                  .split(",")
                                  .map((x) => x.trim())
                                  .filter(Boolean);
                                const next = e.target.checked
                                  ? [
                                      ...selected.filter(
                                        (x) => x.toLowerCase() !== "guide",
                                      ),
                                      "Guide",
                                    ]
                                  : selected.filter(
                                      (x) => x.toLowerCase() !== "guide",
                                    );
                                setFocRules({
                                  ...focRules,
                                  appliesTo: next.join(","),
                                });
                              }}
                            />
                            Guide FOC
                          </label>
                          <div className="flex-1">
                            {focRules.appliesTo
                              .toLowerCase()
                              .includes("guide") ? (
                              <div className="flex flex-col gap-1 w-full">
                                <label className="text-[10px] font-bold uppercase tracking-wider text-steel">
                                  Rule Description (Guide)
                                </label>
                                <input
                                  className={controlClass}
                                  title="Rule Description (Guide)"
                                  value={focRules.guideCustomText}
                                  onChange={(e) =>
                                    setFocRules({
                                      ...focRules,
                                      guideCustomText: e.target.value,
                                    })
                                  }
                                  placeholder={previewGuideText}
                                />
                              </div>
                            ) : (
                              <span className="text-xs text-steel italic flex items-center min-h-[38px]">
                                Check Guide FOC to customize rule description
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </Section>
            )}

            {activeSection === "Seasonal Surcharges" && (
              <Section
                id="sec-seasonal-surcharges"
                title="7. Seasonal Surcharges"
              >
                <div className="mb-5 flex items-center justify-between">
                  <StatusPill status={sectionStates[6].status} />
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
                    <div
                      key={i}
                      className="grid grid-cols-1 lg:grid-cols-6 gap-3 rounded-app border border-line bg-cloud p-3"
                    >
                      <input
                        className={cellControl}
                        aria-label="Surcharge name"
                        title="Surcharge name"
                        placeholder="Name"
                        value={s.name}
                        onChange={(e) =>
                          updateSeasonalSurcharge(i, "name", e.target.value)
                        }
                      />
                      <input
                        type="number"
                        step="1"
                        className={cellControl}
                        aria-label="Surcharge amount"
                        title="Surcharge amount"
                        placeholder="Amount"
                        value={s.amount}
                        onChange={(e) =>
                          updateSeasonalSurcharge(
                            i,
                            "amount",
                            e.target.value.replace(/\D/g, ""),
                          )
                        }
                      />
                      <input
                        type="date"
                        className={cellControl}
                        aria-label="From"
                        title="From"
                        value={s.from}
                        onChange={(e) =>
                          updateSeasonalSurcharge(i, "from", e.target.value)
                        }
                      />
                      <input
                        type="date"
                        className={cellControl}
                        aria-label="To"
                        title="To"
                        value={s.to}
                        onChange={(e) =>
                          updateSeasonalSurcharge(i, "to", e.target.value)
                        }
                      />
                      <Select
                        className={cellSelect}
                        aria-label="Surcharge applies to"
                        title="Surcharge applies to"
                        value={s.appliesTo}
                        onChange={(e) =>
                          updateSeasonalSurcharge(
                            i,
                            "appliesTo",
                            e.target.value,
                          )
                        }
                      >
                        <option value="">Select</option>
                        <option value="All">All Categories</option>
                        {roomCategoryOptions.map((cat: string) => (
                          <option key={cat} value={cat}>
                            {cat}
                          </option>
                        ))}
                      </Select>
                      <button
                        type="button"
                        onClick={() => removeSeasonalSurcharge(i)}
                        className="rounded-app p-2 text-steel hover:bg-rose-500/10 hover:text-rose-500"
                        title="Remove surcharge"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={addSeasonalSurcharge}
                  className="mt-4 flex items-center gap-2 rounded-app border border-line px-3 py-2 text-sm font-bold text-navy"
                >
                  <Plus size={16} /> Add Seasonal Surcharge
                </button>
              </Section>
            )}

            {activeSection === "Compulsory Events" && (
              <Section
                id="sec-compulsory-events"
                title="8. Compulsory Events / Gala Dinner"
              >
                <div className="mb-5 flex items-center justify-between">
                  <StatusPill status={sectionStates[7].status} />
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
                        {[
                          "Date",
                          "Event",
                          "BB Rate",
                          "HB Rate",
                          "FB Rate",
                          "Per",
                          "Mandatory",
                          "",
                        ].map((h) => (
                          <th className="px-2 py-3" key={h || "action"}>
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line">
                      {events.map((ev, i) => (
                        <tr key={i}>
                          <td className="px-2 py-2">
                            <input
                              type="date"
                              className={cellControl}
                              aria-label="Event date"
                              title="Event date"
                              value={ev.date}
                              onChange={(e) =>
                                updateEvent(i, "date", e.target.value)
                              }
                            />
                          </td>
                          <td className="px-2 py-2">
                            <input
                              className={cellControl}
                              aria-label="Event name"
                              title="Event name"
                              value={ev.event}
                              onChange={(e) =>
                                updateEvent(i, "event", e.target.value)
                              }
                            />
                          </td>
                          <td className="px-2 py-2">
                            <input
                              type="number"
                              step="1"
                              className={cellControl}
                              aria-label="BB rate"
                              title="BB rate"
                              value={ev.bb}
                              onChange={(e) =>
                                updateEvent(
                                  i,
                                  "bb",
                                  e.target.value.replace(/\D/g, ""),
                                )
                              }
                            />
                          </td>
                          <td className="px-2 py-2">
                            <input
                              type="number"
                              step="1"
                              className={cellControl}
                              aria-label="HB rate"
                              title="HB rate"
                              value={ev.hb}
                              onChange={(e) =>
                                updateEvent(
                                  i,
                                  "hb",
                                  e.target.value.replace(/\D/g, ""),
                                )
                              }
                            />
                          </td>
                          <td className="px-2 py-2">
                            <input
                              type="number"
                              step="1"
                              className={cellControl}
                              aria-label="FB rate"
                              title="FB rate"
                              value={ev.fb}
                              onChange={(e) =>
                                updateEvent(
                                  i,
                                  "fb",
                                  e.target.value.replace(/\D/g, ""),
                                )
                              }
                            />
                          </td>
                          <td className="px-2 py-2">
                            <Select
                              className={cellSelect}
                              aria-label="Event per"
                              title="Event per"
                              value={ev.per}
                              onChange={(e) =>
                                updateEvent(i, "per", e.target.value)
                              }
                            >
                              <option>Person</option>
                              <option>Room</option>
                            </Select>
                          </td>
                          <td className="px-2 py-2 text-center">
                            <input
                              type="checkbox"
                              aria-label="Event mandatory"
                              title="Event mandatory"
                              checked={ev.mandatory}
                              onChange={(e) =>
                                updateEvent(i, "mandatory", e.target.checked)
                              }
                              className="h-5 w-5 rounded border-line accent-navy"
                            />
                          </td>
                          <td className="px-2 py-2">
                            <button
                              type="button"
                              onClick={() => removeEvent(i)}
                              className="rounded-app p-2 text-steel hover:bg-rose-500/10 hover:text-rose-500"
                              title="Remove event"
                            >
                              <Trash2 size={16} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <button
                  type="button"
                  onClick={addEvent}
                  className="mt-4 flex items-center gap-2 rounded-app border border-line px-3 py-2 text-sm font-bold text-navy"
                >
                  <Plus size={16} /> Add Event
                </button>
              </Section>
            )}

            {activeSection === "Billing Instructions" && (
              <Section
                id="sec-billing-instructions"
                title="9. Billing Instructions"
              >
                <div className="mb-5 flex items-center justify-between">
                  <StatusPill status={sectionStates[8].status} />
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
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
