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
import type { HotelRateRecord, HotelRateRecordSummary, SectionStatus } from "../../electron/shared/types";
import { hotels as referenceHotels, markets, roomCategories, mealBasisOptions } from "../domain/referenceData";
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



interface EventRow {
  date: string;
  event: string;
  bb: string;
  hbfb: string;
  per: string;
  mandatory: boolean;
}

interface PolicyRule {
  id: string;
  title: string;
  content: string;
  appliesTo: string;
  notes: string;
  isActive: boolean;
}

interface ContractDetails {
  hotelName: string;
  market: string;
  currency: string;
  contractName: string;
  validFrom: string;
  validTo: string;
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
  if (!rule.enabled) return "Guide / Driver FOC not applied";
  const personText = rule.minimumPersons ? `when ${rule.minimumPersons}+ persons` : "when person count rule is met";
  const qtyText = rule.focQuantity || "1";
  const who = rule.appliesTo || "Guide";
  const basisText = rule.basis ? ` on ${rule.basis}` : "";
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
};

export function HotelRateMasterScreen({ onManageRates, initialEditId }: Props = {}) {
  const [contract, setContract] = useState<ContractDetails>({
    hotelName: "",
    market: "",
    currency: "",
    contractName: "",
    validFrom: "",
    validTo: "",
  });

  const [rates, setRates] = useState<RateRow[]>([]);

  const [seasonalSurcharges, setSeasonalSurcharges] = useState<Array<{ name: string; amount: string; from: string; to: string; appliesTo: string; rule: string }>>([]);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [focRules, setFocRules] = useState<FocRules>({ enabled: false, appliesTo: "Guide", minimumPersons: "15", focQuantity: "1", basis: "HB" });
  const [billingText, setBillingText] = useState("");
  const [cancellationRules, setCancellationRules] = useState<PolicyRule[]>([]);
  const [voucherRules, setVoucherRules] = useState<PolicyRule[]>([]);
  const [skippedSections, setSkippedSections] = useState<string[]>([]);
  const [saveNotice, setSaveNotice] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [hotels, setHotels] = useState<string[]>([...referenceHotels]);
  const [hotelMode, setHotelMode] = useState<"select" | "create">("select");
  const [newHotelName, setNewHotelName] = useState("");
  const [hotelSelectValue, setHotelSelectValue] = useState("");
  const [selectedHotelName, setSelectedHotelName] = useState("");
  const [hotelRateSummaries, setHotelRateSummaries] = useState<HotelRateRecordSummary[]>([]);
  const [selectedHotelRateId, setSelectedHotelRateId] = useState<string>(initialEditId || "");

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
    if (!window.meridian?.listHotelsFromRates) return;
    void window.meridian
      .listHotelsFromRates()
      .then((items) => {
        const set = new Set<string>();
        for (const h of referenceHotels) set.add(h);
        for (const h of items) if (h?.trim()) set.add(h.trim());
        setHotels(Array.from(set).sort((a, b) => a.localeCompare(b)));
      })
      .catch(() => setHotels([...referenceHotels]));
  }, []);

  useEffect(() => {
    setHotelSelectValue(selectedHotelName);
  }, [selectedHotelName]);

  async function loadSelectedRateRecord(hotelRateId: string) {
    if (!window.meridian?.getHotelRates) return;
    const record = await window.meridian.getHotelRates(hotelRateId);

    setContract({
      hotelName: record.hotel_name ?? "",
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



    setSeasonalSurcharges(
      (record.seasonal_surcharges ?? []).map((s) => ({
        name: s.name ?? "",
        amount: s.amount == null ? "" : String(s.amount),
        from: String(s.date_from ?? ""),
        to: String(s.date_to ?? ""),
        appliesTo: String(s.applies_to ?? ""),
        rule: String(s.rule ?? ""),
      }))
    );

    setEvents(
      (record.compulsory_events ?? []).map((e) => ({
        date: e.event_date ?? "",
        event: e.event_name ?? "",
        bb: e.bb_rate == null ? "" : String(e.bb_rate),
        hbfb: e.hbfb_rate == null ? "" : String(e.hbfb_rate),
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

    setBillingText(record.billing_instruction ?? "");
    if (record.cancellation_policy) {
      const rules: PolicyRule[] = Object.entries(record.cancellation_policy).map(([title, val]) => {
        if (typeof val === 'string') return { id: crypto.randomUUID(), title, content: val, appliesTo: "", notes: "", isActive: true };
        const v = val as Record<string, unknown>;
        return { 
          id: crypto.randomUUID(), 
          title: (v.title as string) || title, 
          content: (v.content as string) || "", 
          appliesTo: (v.appliesTo as string) || "", 
          notes: (v.notes as string) || "", 
          isActive: v.isActive !== false 
        };
      });
      setCancellationRules(rules);
    }
    if (record.voucher_text_rules) {
      const rules: PolicyRule[] = Object.entries(record.voucher_text_rules).map(([title, val]) => {
        if (typeof val === 'string') return { id: crypto.randomUUID(), title, content: val, appliesTo: "", notes: "", isActive: true };
        const v = val as Record<string, unknown>;
        return { 
          id: crypto.randomUUID(), 
          title: (v.title as string) || title, 
          content: (v.content as string) || "", 
          appliesTo: (v.appliesTo as string) || "", 
          notes: (v.notes as string) || "", 
          isActive: v.isActive !== false 
        };
      });
      setVoucherRules(rules);
    }
    setSkippedSections(record.skipped_sections ?? []);
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



  const addEvent = () =>
    setEvents([...events, { date: "", event: "", bb: "", hbfb: "", per: "Person", mandatory: true }]);

  const updateEvent = (i: number, field: keyof EventRow, value: string | boolean) => {
    const copy = [...events];
    copy[i] = { ...copy[i], [field]: value } as EventRow;
    setEvents(copy);
  };

  const removeEvent = (i: number) => setEvents(events.filter((_, idx) => idx !== i));

  const addSeasonalSurcharge = () =>
    setSeasonalSurcharges([
      ...seasonalSurcharges,
      { name: "", amount: "", from: "", to: "", appliesTo: "", rule: "" },
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
    setNewHotelName("");
    setHotelRateSummaries([]);
    setSelectedHotelRateId("");
    setContract({ hotelName: "", market: "", currency: "", contractName: "", validFrom: "", validTo: "" });
    setRates([]);
    setSeasonalSurcharges([]);
    setEvents([]);
    setFocRules({ enabled: false, appliesTo: "Guide", minimumPersons: "", focQuantity: "1", basis: "HB" });
    setBillingText("");
    setCancellationRules([]);
    setVoucherRules([]);
    setSkippedSections([]);
    setSaveNotice("Cleared");
  }

  function skipSection(sectionName: string) {
    setSkippedSections((cur) => (cur.includes(sectionName) ? cur : [...cur, sectionName]));
    // Enforce skipped-section save behavior (store empty arrays/objects/disabled rules)
    if (sectionName === "Room Rates") setRates([]);
    if (sectionName === "Seasonal Surcharges") setSeasonalSurcharges([]);
    if (sectionName === "Compulsory Events") setEvents([]);
    if (sectionName === "FOC Rules") setFocRules({ enabled: false, appliesTo: "Guide", minimumPersons: "", focQuantity: "1", basis: "HB" });
    if (sectionName === "Billing Instructions") setBillingText("");
    if (sectionName === "Cancellation Policy") setCancellationRules([]);
    if (sectionName === "Voucher Text Rules") setVoucherRules([]);
  }

  function sectionStatus(sectionName: string, isEmpty: boolean): SectionStatus {
    if (skippedSections.includes(sectionName)) return "Skipped";
    return isEmpty ? "Empty" : "Completed";
  }

  const sectionStates = useMemo(() => {
    const basicEmpty =
      !contract.hotelName.trim() ||
      !contract.market.trim() ||
      !contract.currency.trim() ||
      !contract.contractName.trim() ||
      !contract.validFrom ||
      !contract.validTo;

    const roomRatesEmpty = rates.length === 0 || rates.some((r) => !r.roomCategory || !r.basis);
    const seasonalEmpty = seasonalSurcharges.length === 0 || seasonalSurcharges.every((s) => !s.name && !s.amount && !s.from && !s.to);
    const eventsEmpty = events.length === 0 || events.every((e) => !e.date && !e.event && !e.bb && !e.hbfb);
    const focEmpty = !focRules.enabled;
    const billingEmpty = !billingText.trim();
    const cancellationEmpty = cancellationRules.length === 0 || cancellationRules.some(r => !r.title.trim() || !r.content.trim());
    const voucherTextEmpty = voucherRules.length === 0 || voucherRules.some(r => !r.title.trim() || !r.content.trim());

    return [
      { name: "Basic Information", status: sectionStatus("Basic Information", basicEmpty), empty: basicEmpty },
      { name: "Room Rates", status: sectionStatus("Room Rates", roomRatesEmpty), empty: roomRatesEmpty },
      { name: "Seasonal Surcharges", status: sectionStatus("Seasonal Surcharges", seasonalEmpty), empty: seasonalEmpty },
      { name: "Compulsory Events", status: sectionStatus("Compulsory Events", eventsEmpty), empty: eventsEmpty },
      { name: "FOC Rules", status: sectionStatus("FOC Rules", focEmpty), empty: focEmpty },
      { name: "Billing Instructions", status: sectionStatus("Billing Instructions", billingEmpty), empty: billingEmpty },
      { name: "Cancellation Policy", status: sectionStatus("Cancellation Policy", cancellationEmpty), empty: cancellationEmpty },
      { name: "Voucher Text Rules", status: sectionStatus("Voucher Text Rules", voucherTextEmpty), empty: voucherTextEmpty },
    ] as const;
  }, [billingText, cancellationRules, contract, events, focRules, rates, seasonalSurcharges, skippedSections, voucherRules]);

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
        room_rates: skippedSections.includes("Room Rates")
          ? []
          : rates.map((r) => ({
              from: r.from,
              to: r.to,
              room_category: r.roomCategory,
              basis: r.basis,
              sgl: r.sgl ? Number(r.sgl) : null,
              dbl: r.dbl ? Number(r.dbl) : null,
              twn: r.twn ? Number(r.twn) : null,
              tpl: r.tpl ? Number(r.tpl) : null,
            })),

        seasonal_surcharges: skippedSections.includes("Seasonal Surcharges")
          ? []
          : seasonalSurcharges.map((s) => ({
              name: s.name,
              amount: s.amount ? Number(s.amount) : null,
              date_from: s.from || null,
              date_to: s.to || null,
              applies_to: s.appliesTo || null,
              rule: s.rule || null,
            })),
        compulsory_events: skippedSections.includes("Compulsory Events")
          ? []
          : events.map((e) => ({
              event_date: e.date,
              event_name: e.event,
              bb_rate: e.bb ? Number(e.bb) : null,
              hbfb_rate: e.hbfb ? Number(e.hbfb) : null,
              per: e.per,
              mandatory: e.mandatory,
            })),

        foc_rules: skippedSections.includes("FOC Rules")
          ? { enabled: false }
          : {
              enabled: focRules.enabled,
              applies_to: focRules.appliesTo,
              minimum_persons: focRules.minimumPersons ? Number(focRules.minimumPersons) : null,
              foc_quantity: focRules.focQuantity ? Number(focRules.focQuantity) : null,
              basis: focRules.basis,
            },
        billing_instruction: skippedSections.includes("Billing Instructions") ? "" : billingText,
        cancellation_policy: skippedSections.includes("Cancellation Policy") ? {} : cancellationRules.reduce((acc, r) => ({ 
          ...acc, 
          [r.title]: { title: r.title, content: r.content, appliesTo: r.appliesTo, notes: r.notes, isActive: r.isActive } 
        }), {}),
        voucher_text_rules: skippedSections.includes("Voucher Text Rules") ? {} : voucherRules.reduce((acc, r) => ({ 
          ...acc, 
          [r.title]: { title: r.title, content: r.content, appliesTo: r.appliesTo, notes: r.notes, isActive: r.isActive } 
        }), {}),
        skipped_sections: skippedSections,
      };

      const result = await window.meridian.saveHotelRates(payload);
      setSelectedHotelRateId(result.id);
      setSaveNotice(`Saved (${result.id.slice(0, 8)})`);
    } catch (error) {
      setSaveNotice(error instanceof Error ? error.message : "Unable to save");
    } finally {
      setIsSaving(false);
    }
  }

  /* ---------- table helper class ---------- */

  const cellControl =
    "app-input h-9 px-2";

  const cellSelect =
    "app-select h-9 px-2";

  /* ---------- render ---------- */

  return (
    <div className="mx-auto max-w-[1400px] p-8">
      {/* Page header */}
      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
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
            <Button variant="secondary" onClick={onManageRates} className="h-10 shrink-0 whitespace-nowrap px-4">
              Manage Rates
            </Button>
          )}
          <Button type="button" variant="primary" disabled={isSaving || !canSave} onClick={handleSave} className="h-10 shrink-0 whitespace-nowrap px-4">
            <Save size={17} /> {isSaving ? "Saving..." : "Save Data"}
          </Button>
          <Button type="button" variant="secondary" disabled={isSaving} onClick={clearAll} className="h-10 shrink-0 whitespace-nowrap px-4">
            <RotateCcw size={17} /> Clear Form
          </Button>
          <Button
            type="button"
            variant="secondary"
            className="h-10 shrink-0 whitespace-nowrap px-4"
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
                setSaveNotice(`Seeded ${result.seeded} hotels`);
                if (window.meridian?.listHotelsFromRates) {
                  const items = await window.meridian.listHotelsFromRates();
                  setHotels(items);
                }
              } catch (e) {
                setSaveNotice(e instanceof Error ? e.message : "Seed failed");
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
                      setNewHotelName("");
                    }}
                    className={`rounded px-3 py-1 text-xs font-bold transition ${
                      hotelMode === "select"
                        ? "bg-white text-navy shadow-sm"
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
                        ? "bg-white text-navy shadow-sm"
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
                      value={newHotelName}
                      autoFocus
                      onChange={(e) => setNewHotelName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key !== "Enter") return;
                        const name = newHotelName.trim();
                        if (!name) return;
                        setHotels((cur) => (cur.includes(name) ? cur : [...cur, name].sort((a, b) => a.localeCompare(b))));
                        setSelectedHotelName(name);
                        setHotelSelectValue(name);
                        setContract((cur) => ({ ...cur, hotelName: name }));
                        setNewHotelName("");
                        setHotelMode("select");
                      }}
                    />
                    <Button
                      type="button"
                      variant="primary"
                      onClick={() => {
                        const name = newHotelName.trim();
                        if (!name) return;
                        setHotels((cur) => (cur.includes(name) ? cur : [...cur, name].sort((a, b) => a.localeCompare(b))));
                        setSelectedHotelName(name);
                        setHotelSelectValue(name);
                        setContract((cur) => ({ ...cur, hotelName: name }));
                        setNewHotelName("");
                        setHotelMode("select");
                      }}
                    >
                      Add
                    </Button>
                  </div>
                )}

                {selectedHotelName && (
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
                    setSkippedSections([]);
                    setRates([]);
                    setSeasonalSurcharges([]);
                    setEvents([]);
                    setFocRules({ enabled: false, appliesTo: "Guide", minimumPersons: "", focQuantity: "1", basis: "HB" });
                    setBillingText("");
                    setCancellationRules([]);
                    setVoucherRules([]);
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
              <div className="flex items-start justify-between gap-4">
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
                <div className="mt-3 flex items-center gap-2 rounded-app bg-red-50 px-3 py-2.5">
                  <AlertTriangle size={14} className="text-red-700 flex-shrink-0" />
                  <p className="text-xs font-semibold text-red-700">
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
            {sectionStates[0].status === "Empty" && (
              <button type="button" onClick={() => skipSection("Basic Hotel Rate Info")} className="flex items-center gap-2 rounded-app border border-line bg-white px-3 py-2 text-sm font-bold text-navy">
                <SkipForward size={16} /> Ignore
              </button>
            )}
          </div>
          {sectionStates[0].status === "Empty" && (
            <p className="mb-4 flex items-center gap-2 rounded-app border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
              <AlertTriangle size={16} /> This section is empty
            </p>
          )}
          <div className="grid grid-cols-2 gap-5 md:grid-cols-3">
            <Field label="Hotel Name">
              <Select className="w-full" title="Hotel Name" value={contract.hotelName} onChange={(e) => updateContract("hotelName", e.target.value)}>
                <option value="">Select Hotel Name</option>
                {referenceHotels.map((hotel) => (
                  <option value={hotel} key={hotel}>{hotel}</option>
                ))}
              </Select>
            </Field>
            <Field label="Market">
              <Select className="w-full" title="Market" value={contract.market} onChange={(e) => updateContract("market", e.target.value)}>
                <option value="">Select Market</option>
                {markets.map((m) => (
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
            {sectionStates[1].status === "Empty" && (
              <button type="button" onClick={() => skipSection("Room Rates")} className="flex items-center gap-2 rounded-app border border-line bg-white px-3 py-2 text-sm font-bold text-navy">
                <SkipForward size={16} /> Ignore
              </button>
            )}
          </div>
          {sectionStates[1].status === "Empty" && (
            <p className="mb-4 flex items-center gap-2 rounded-app border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
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
                        {roomCategories.map((cat) => (
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
                    <td className="px-2 py-2"><input className={cellControl} aria-label="Single rate" title="Single rate" value={rate.sgl} onChange={(e) => updateRate(i, "sgl", e.target.value)} /></td>
                    <td className="px-2 py-2"><input className={cellControl} aria-label="Double rate" title="Double rate" value={rate.dbl} onChange={(e) => updateRate(i, "dbl", e.target.value)} /></td>
                    <td className="px-2 py-2"><input className={cellControl} aria-label="Twin rate" title="Twin rate" value={rate.twn} onChange={(e) => updateRate(i, "twn", e.target.value)} /></td>
                    <td className="px-2 py-2"><input className={cellControl} aria-label="Triple rate" title="Triple rate" value={rate.tpl} onChange={(e) => updateRate(i, "tpl", e.target.value)} /></td>
                    <td className="px-2 py-2">
                      <button type="button" onClick={() => removeRate(i)} className="rounded-app p-2 text-steel hover:bg-red-50 hover:text-red-700" title="Remove row">
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
        <Section title="3. Seasonal Surcharges">
          <div className="mb-5 flex items-center justify-between">
            <StatusPill status={sectionStates[2].status} />
            {sectionStates[2].status === "Empty" && (
              <button type="button" onClick={() => skipSection("Seasonal Surcharges")} className="flex items-center gap-2 rounded-app border border-line bg-white px-3 py-2 text-sm font-bold text-navy">
                <SkipForward size={16} /> Ignore
              </button>
            )}
          </div>
          {sectionStates[2].status === "Empty" && (
            <p className="mb-4 flex items-center gap-2 rounded-app border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
              <AlertTriangle size={16} /> This section is empty
            </p>
          )}
          <div className="space-y-3">
            <div className="grid grid-cols-6 gap-3 px-3 text-[10px] font-bold uppercase tracking-wider text-steel">
              <div>Name</div>
              <div>Amount</div>
              <div>From</div>
              <div>To</div>
              <div className="col-span-1">Applies To</div>
              <div></div>
            </div>
            {seasonalSurcharges.map((s, i) => (
              <div key={i} className="grid grid-cols-6 gap-3 rounded-app border border-line bg-cloud p-3">
                <input className={cellControl} aria-label="Surcharge name" title="Surcharge name" placeholder="Name" value={s.name} onChange={(e) => updateSeasonalSurcharge(i, "name", e.target.value)} />
                <input className={cellControl} aria-label="Surcharge amount" title="Surcharge amount" placeholder="Amount" value={s.amount} onChange={(e) => updateSeasonalSurcharge(i, "amount", e.target.value)} />
                <input type="date" className={cellControl} aria-label="From" title="From" value={s.from} onChange={(e) => updateSeasonalSurcharge(i, "from", e.target.value)} />
                <input type="date" className={cellControl} aria-label="To" title="To" value={s.to} onChange={(e) => updateSeasonalSurcharge(i, "to", e.target.value)} />
                <input className={cellControl} aria-label="Surcharge applies to" title="Surcharge applies to" placeholder="Applies to" value={s.appliesTo} onChange={(e) => updateSeasonalSurcharge(i, "appliesTo", e.target.value)} />
                <button type="button" onClick={() => removeSeasonalSurcharge(i)} className="rounded-app p-2 text-steel hover:bg-red-50 hover:text-red-700" title="Remove surcharge">
                  <Trash2 size={16} />
                </button>
                <div className="col-span-6">
                  <input className={cellControl} aria-label="Surcharge rule" title="Surcharge rule" placeholder="Rule" value={s.rule} onChange={(e) => updateSeasonalSurcharge(i, "rule", e.target.value)} />
                </div>
              </div>
            ))}
          </div>
          <button type="button" onClick={addSeasonalSurcharge} className="mt-4 flex items-center gap-2 rounded-app border border-line px-3 py-2 text-sm font-bold text-navy">
            <Plus size={16} /> Add Seasonal Surcharge
          </button>
        </Section>


        {/* 4. Compulsory Events */}
        <Section title="4. Compulsory Events / Gala Dinner">
          <div className="mb-5 flex items-center justify-between">
            <StatusPill status={sectionStates[3].status} />
            {sectionStates[3].status === "Empty" && (
              <button type="button" onClick={() => skipSection("Compulsory Events")} className="flex items-center gap-2 rounded-app border border-line bg-white px-3 py-2 text-sm font-bold text-navy">
                <SkipForward size={16} /> Skip
              </button>
            )}
          </div>
          {sectionStates[3].status === "Empty" && (
            <p className="mb-4 flex items-center gap-2 rounded-app border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
              <AlertTriangle size={16} /> This section is empty
            </p>
          )}
          <div className="thin-scrollbar overflow-x-auto">
            <table className="w-full min-w-[850px] table-fixed border-collapse text-sm">
              <thead>
                <tr className="border-y border-line bg-cloud text-left text-xs font-bold uppercase tracking-wide text-steel">
                  {["Date", "Event", "BB Rate", "HB/FB Rate", "Per", "Mandatory", ""].map((h) => (
                    <th className="px-2 py-3" key={h || "action"}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {events.map((ev, i) => (
                  <tr key={i}>
                    <td className="px-2 py-2"><input type="date" className={cellControl} aria-label="Event date" title="Event date" value={ev.date} onChange={(e) => updateEvent(i, "date", e.target.value)} /></td>
                    <td className="px-2 py-2"><input className={cellControl} aria-label="Event name" title="Event name" value={ev.event} onChange={(e) => updateEvent(i, "event", e.target.value)} /></td>
                    <td className="px-2 py-2"><input className={cellControl} aria-label="BB rate" title="BB rate" value={ev.bb} onChange={(e) => updateEvent(i, "bb", e.target.value)} /></td>
                    <td className="px-2 py-2"><input className={cellControl} aria-label="HB/FB rate" title="HB/FB rate" value={ev.hbfb} onChange={(e) => updateEvent(i, "hbfb", e.target.value)} /></td>
                    <td className="px-2 py-2">
                      <Select className={cellSelect} aria-label="Event per" title="Event per" value={ev.per} onChange={(e) => updateEvent(i, "per", e.target.value)}>
                        <option>Person</option><option>Room</option>
                      </Select>
                    </td>
                    <td className="px-2 py-2 text-center">
                      <input type="checkbox" aria-label="Event mandatory" title="Event mandatory" checked={ev.mandatory} onChange={(e) => updateEvent(i, "mandatory", e.target.checked)} className="h-5 w-5 rounded border-line accent-navy" />
                    </td>
                    <td className="px-2 py-2">
                      <button type="button" onClick={() => removeEvent(i)} className="rounded-app p-2 text-steel hover:bg-red-50 hover:text-red-700" title="Remove event">
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

        {/* 5. FOC Rules */}
        <Section title="5. FOC Rules">
          <div className="mb-5 flex items-center justify-between">
            <StatusPill status={sectionStates[4].status} />
            {sectionStates[4].status === "Empty" && (
              <button type="button" onClick={() => skipSection("FOC Rules")} className="flex items-center gap-2 rounded-app border border-line bg-white px-3 py-2 text-sm font-bold text-navy">
                <SkipForward size={16} /> Ignore
              </button>
            )}
          </div>
          {sectionStates[4].status === "Empty" && (
            <p className="mb-4 flex items-center gap-2 rounded-app border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
              <AlertTriangle size={16} /> This section is empty
            </p>
          )}
          <div className="rounded-app border border-line bg-cloud p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <p className="text-xs font-bold uppercase tracking-wide text-steel">FOC Rule by Number of Persons</p>
              <label className="flex items-center gap-2 text-sm font-bold text-navy">
                <input type="checkbox" checked={focRules.enabled} onChange={(e) => setFocRules({ ...focRules, enabled: e.target.checked })} className="accent-navy" />
                Enable FOC
              </label>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <Field label="Applies To">
                <input className={controlClass} title="Applies To" value={focRules.appliesTo} onChange={(e) => setFocRules({ ...focRules, appliesTo: e.target.value })} placeholder="Guide" />
              </Field>
              <Field label="Minimum Persons">
                <input className={controlClass} title="Minimum Persons" value={focRules.minimumPersons} onChange={(e) => setFocRules({ ...focRules, minimumPersons: e.target.value })} placeholder="15" />
              </Field>
              <Field label="FOC Quantity">
                <input className={controlClass} title="FOC Quantity" value={focRules.focQuantity} onChange={(e) => setFocRules({ ...focRules, focQuantity: e.target.value })} placeholder="1" />
              </Field>
              <Field label="Basis">
                <input className={controlClass} title="Basis" value={focRules.basis} onChange={(e) => setFocRules({ ...focRules, basis: e.target.value })} placeholder="HB" />
              </Field>
              <Field label="Generated Rule Preview">
                <input className={controlClass} title="Generated Rule Preview" value={previewFocText} readOnly />
              </Field>
            </div>
          </div>
        </Section>

        {/* 6. Billing Instructions */}
        <Section title="6. Billing Instructions">
          <div className="mb-5 flex items-center justify-between">
            <StatusPill status={sectionStates[5].status} />
            {sectionStates[5].status === "Empty" && (
                <button type="button" onClick={() => skipSection("Billing Instructions")} className="flex items-center gap-2 rounded-app border border-line bg-white px-3 py-2 text-sm font-bold text-navy">
                  <SkipForward size={16} /> Skip
                </button>
              )}
              <button
                type="button"
                onClick={() => setBillingText(defaultBillingText)}
                className="flex items-center gap-2 rounded-app border border-line bg-white px-3 py-2 text-sm font-bold text-navy"
              >
                <Circle size={16} /> Use Default Billing Instruction
              </button>
          </div>
          {sectionStates[5].status === "Empty" && (
            <p className="mb-4 flex items-center gap-2 rounded-app border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
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

        {/* 7. Cancellation Policy */}
        <Section title="7. Cancellation Policy">
          <div className="mb-5 flex items-center justify-between">
            <StatusPill status={sectionStates[6].status} />
            {sectionStates[6].status === "Empty" && (
              <button type="button" onClick={() => skipSection("Cancellation Policy")} className="flex items-center gap-2 rounded-app border border-line bg-white px-3 py-2 text-sm font-bold text-navy">
                <SkipForward size={16} /> Skip
              </button>
            )}
          </div>
          {sectionStates[6].status === "Empty" && (
            <p className="mb-4 flex items-center gap-2 rounded-app border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
              <AlertTriangle size={16} /> This section is empty
            </p>
          )}
          <div className="space-y-4">
            {cancellationRules.map((rule, i) => (
              <div key={rule.id} className="relative flex flex-col gap-4 rounded-app border border-line bg-white p-5 pt-10">
                <div className="absolute right-4 top-4 flex items-center gap-2">
                  <label className="flex items-center gap-2 text-xs font-bold text-steel">
                    <input 
                      type="checkbox" 
                      checked={rule.isActive} 
                      onChange={(e) => { const n = [...cancellationRules]; n[i].isActive = e.target.checked; setCancellationRules(n); }} 
                      className="accent-navy"
                    />
                    Active
                  </label>
                  <button type="button" onClick={() => setCancellationRules(cancellationRules.filter((_, idx) => idx !== i))} className="p-2 text-steel hover:text-red-600 transition-colors" aria-label="Remove cancellation policy" title="Remove cancellation policy">
                    <Trash2 size={16} />
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <UiField label="Policy Title">
                    <input className={controlClass} placeholder="e.g., Early Bird Cancellation" value={rule.title} onChange={(e) => { const n = [...cancellationRules]; n[i].title = e.target.value; setCancellationRules(n); }} />
                  </UiField>
                  <UiField label="Applies To">
                    <input className={controlClass} placeholder="e.g., All Markets" value={rule.appliesTo} onChange={(e) => { const n = [...cancellationRules]; n[i].appliesTo = e.target.value; setCancellationRules(n); }} />
                  </UiField>
                </div>
                <UiField label="Policy Description">
                  <textarea className="app-textarea min-h-24" placeholder="Full policy text..." value={rule.content} onChange={(e) => { const n = [...cancellationRules]; n[i].content = e.target.value; setCancellationRules(n); }} />
                </UiField>
                <UiField label="Internal Notes">
                  <input className={controlClass} placeholder="Internal references..." value={rule.notes} onChange={(e) => { const n = [...cancellationRules]; n[i].notes = e.target.value; setCancellationRules(n); }} />
                </UiField>
              </div>
            ))}
          </div>
          <button type="button" onClick={() => setCancellationRules([...cancellationRules, { id: crypto.randomUUID(), title: "", content: "", appliesTo: "", notes: "", isActive: true }])} className="mt-4 flex items-center gap-2 rounded-app border border-line px-3 py-2 text-sm font-bold text-navy shadow-sm hover:bg-cloud transition-all">
            <Plus size={16} /> Add Policy Section
          </button>
        </Section>

        {/* 8. Voucher Text Rules */}
        <Section title="8. Voucher Text Rules">
          <div className="mb-5 flex items-center justify-between">
            <StatusPill status={sectionStates[7].status} />
            {sectionStates[7].status === "Empty" && (
              <button type="button" onClick={() => skipSection("Voucher Text Rules")} className="flex items-center gap-2 rounded-app border border-line bg-white px-3 py-2 text-sm font-bold text-navy">
                <SkipForward size={16} /> Skip
              </button>
            )}
          </div>
          {sectionStates[7].status === "Empty" && (
            <p className="mb-4 flex items-center gap-2 rounded-app border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
              <AlertTriangle size={16} /> This section is empty
            </p>
          )}
          <div className="space-y-4">
            {voucherRules.map((rule, i) => (
              <div key={rule.id} className="relative flex flex-col gap-4 rounded-app border border-line bg-white p-5 pt-10">
                <div className="absolute right-4 top-4 flex items-center gap-2">
                  <label className="flex items-center gap-2 text-xs font-bold text-steel">
                    <input 
                      type="checkbox" 
                      checked={rule.isActive} 
                      onChange={(e) => { const n = [...voucherRules]; n[i].isActive = e.target.checked; setVoucherRules(n); }} 
                      className="accent-navy"
                    />
                    Active
                  </label>
                  <button type="button" onClick={() => setVoucherRules(voucherRules.filter((_, idx) => idx !== i))} className="p-2 text-steel hover:text-red-600 transition-colors" aria-label="Remove voucher text rule" title="Remove voucher text rule">
                    <Trash2 size={16} />
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <UiField label="Rule Title">
                    <input className={controlClass} placeholder="e.g., Arrival Instructions" value={rule.title} onChange={(e) => { const n = [...voucherRules]; n[i].title = e.target.value; setVoucherRules(n); }} />
                  </UiField>
                  <UiField label="Applies To">
                    <input className={controlClass} placeholder="e.g., Fit Travelers" value={rule.appliesTo} onChange={(e) => { const n = [...voucherRules]; n[i].appliesTo = e.target.value; setVoucherRules(n); }} />
                  </UiField>
                </div>
                <UiField label="Rule Content">
                  <textarea className="app-textarea min-h-24" placeholder="Content text..." value={rule.content} onChange={(e) => { const n = [...voucherRules]; n[i].content = e.target.value; setVoucherRules(n); }} />
                </UiField>
                <UiField label="Internal Notes">
                  <input className={controlClass} placeholder="Internal references..." value={rule.notes} onChange={(e) => { const n = [...voucherRules]; n[i].notes = e.target.value; setVoucherRules(n); }} />
                </UiField>
              </div>
            ))}
          </div>
          <button type="button" onClick={() => setVoucherRules([...voucherRules, { id: crypto.randomUUID(), title: "", content: "", appliesTo: "", notes: "", isActive: true }])} className="mt-4 flex items-center gap-2 rounded-app border border-line px-3 py-2 text-sm font-bold text-navy shadow-sm hover:bg-cloud transition-all">
            <Plus size={16} /> Add Voucher Text Rule
          </button>
        </Section>
      </div>
    </div>
  );
}
