import React from "react";
import { UseFormReturn, Controller, FieldArrayWithId, UseFieldArrayAppend } from "react-hook-form";
import { VoucherFormValues } from "../domain/voucherSchema";
import { Button } from "./ui-kit/Button";
import { Field } from "./ui-kit/Field";
import { Select } from "./ui-kit/Inputs";
import { Panel } from "./ui-kit/Panel";
import { RotateCcw, Save, FileText, ChevronDown, FileDown, Hotel, ReceiptText } from "lucide-react";
import { VoucherTable } from "./VoucherTable";

import { LivePreviewWidget } from "./LivePreviewWidget";

interface VoucherEntryScreenProps {
  form: UseFormReturn<VoucherFormValues>;
  actionState: "idle" | "saving" | "generating-docx" | "generating-pdf";
  hasChanges: boolean;
  handleClearForm: () => void;
  handleSave: (values: VoucherFormValues) => void;
  handleGenerateDocx: (values: VoucherFormValues, customOutputDir?: string) => void;
  handleGeneratePdf: (values: VoucherFormValues, customOutputDir?: string) => void;
  docxDropdownOpen: boolean;
  setDocxDropdownOpen: React.Dispatch<React.SetStateAction<boolean>>;
  pdfDropdownOpen: boolean;
  setPdfDropdownOpen: React.Dispatch<React.SetStateAction<boolean>>;
  tourTypeOptions: readonly string[];
  hotelOptions: string[];
  marketOptions: readonly string[];
  uniqueContractNames: string[];
  customerOptions: string[];
  roomCategoryOptions: readonly string[];
  mealBasisOptionsState: readonly string[];
  availableSupplements: { supplement_name: string; room_category: string; supplement_amount: number; per: string; }[];
  lineItems: VoucherFormValues["lineItems"];
  dailyRooms: { date: string; rooms: number; children: number; }[];
  fields: FieldArrayWithId<VoucherFormValues, "lineItems", "id">[];
  append: UseFieldArrayAppend<VoucherFormValues, "lineItems">;
  remove: (index: number) => void;
  manualRates: boolean;
  setManualRates: React.Dispatch<React.SetStateAction<boolean>>;
  previewMode: "collapsed" | "thumbnail" | "expanded";
  setPreviewMode: React.Dispatch<React.SetStateAction<"collapsed" | "thumbnail" | "expanded">>;
  previewPos: { x: number; y: number };
  windowSize: { width: number; height: number };
  isDraggingPreview: boolean;
  startDragPreview: (e: React.MouseEvent) => void;
}

function FieldError({ message }: { message?: string }) {
  if (message) return null;
  return null;
}

function SectionIndicator({ isComplete, shakeTrigger }: { isComplete: boolean; shakeTrigger?: number }) {
  if (isComplete) {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wide uppercase bg-emerald-100/80 text-emerald-800 border border-emerald-200">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-600 animate-pulse" />
        Filled
      </span>
    );
  }
  return (
    <span 
      key={shakeTrigger}
      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wide uppercase bg-amber-100/80 text-amber-800 border border-amber-200 ${shakeTrigger ? "shake-pill-active" : ""}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-amber-600" />
      Incomplete
    </span>
  );
}

const voucherTypes = [
  { value: "reservation", label: "Reservation", description: "Hotel booking voucher", icon: Hotel },
  { value: "amendment", label: "Amendment", description: "Change existing booking", icon: ReceiptText },
  { value: "pptp", label: "PPTP", description: "Point-to-point transport", icon: FileDown }
] as const;

export function VoucherEntryScreen({
  form,
  actionState,
  hasChanges,
  handleClearForm,
  handleSave,
  handleGenerateDocx,
  handleGeneratePdf,
  docxDropdownOpen,
  setDocxDropdownOpen,
  pdfDropdownOpen,
  setPdfDropdownOpen,
  tourTypeOptions,
  hotelOptions,
  marketOptions,
  uniqueContractNames,
  customerOptions,
  roomCategoryOptions,
  mealBasisOptionsState,
  availableSupplements,
  lineItems,
  dailyRooms,
  fields,
  append,
  remove,
  manualRates,
  setManualRates,
  previewMode,
  setPreviewMode,
  previewPos,
  windowSize,
  isDraggingPreview,
  startDragPreview
}: VoucherEntryScreenProps) {
  const voucherType = form.watch("voucherType") || "reservation";
  const [shakeTrigger, setShakeTrigger] = React.useState(0);

  const watchTourType = form.watch("tourType");
  const watchHotelName = form.watch("hotelName");
  const watchMarket = form.watch("market");
  const watchRatePeriod = form.watch("ratePeriod");
  const isPrimaryComplete = !!watchTourType && !!watchHotelName && !!watchMarket && !!watchRatePeriod &&
    !form.formState.errors.tourType &&
    !form.formState.errors.hotelName &&
    !form.formState.errors.market &&
    !form.formState.errors.ratePeriod;

  const watchDate = form.watch("date");
  const watchRequisitionNo = form.watch("requisitionNo");
  const watchTourNo = form.watch("tourNo");
  const watchTourName = form.watch("tourName");
  const watchCustomerName = form.watch("customerName");
  const isBookingComplete = !!watchDate && !!watchRequisitionNo && !!watchTourNo && !!watchTourName && !!watchCustomerName &&
    !form.formState.errors.date &&
    !form.formState.errors.requisitionNo &&
    !form.formState.errors.tourNo &&
    !form.formState.errors.tourName &&
    !form.formState.errors.customerName;

  const watchLineItems = form.watch("lineItems") || [];
  const isContentComplete = watchLineItems.length > 0 && watchLineItems.every((item: unknown) => {
    if (!item) return false;
    const i = item as Record<string, unknown>;
    const hasDate = !!i.requiredDate;
    const hasRoomCat = !!i.roomCategory;
    const hasBasis = !!i.basis;
    const total = (Number(i.singleRooms) || 0) + (Number(i.doubleRooms) || 0) + (Number(i.twinRooms) || 0) + (Number(i.tripleRooms) || 0) +
                  (Number(i.child2_5Sharing) || 0) + (Number(i.child2_5Bed) || 0) + (Number(i.child2_5OwnRoom) || 0) +
                  (Number(i.child6_11Sharing) || 0) + (Number(i.child6_11Bed) || 0) + (Number(i.child6_11OwnRoom) || 0);
    return hasDate && hasRoomCat && hasBasis && total > 0;
  }) && !form.formState.errors.lineItems;

  const watchRateApplicableText = form.watch("rateApplicableText");
  const isRateComplete = !!watchRateApplicableText && watchRateApplicableText.trim().length > 0 &&
    !form.formState.errors.confirmedBy && !form.formState.errors.rateApplicableText;

  const watchEmployeeName = form.watch("employeeName");
  const watchEmployeeEmail = form.watch("employeeEmail");
  const isEmployeeComplete = !!watchEmployeeName && !!watchEmployeeEmail &&
    !form.formState.errors.employeeName &&
    !form.formState.errors.employeeEmail;

  const handleTriggerShake = () => {
    if (!isPrimaryComplete || !isBookingComplete || !isContentComplete || !isRateComplete || !isEmployeeComplete) {
      setShakeTrigger((prev) => prev + 1);
    }
  };

  return (
    <form className="mx-auto max-w-[1400px] p-8" onSubmit={form.handleSubmit(handleSave)}>
      <div className="mb-8 flex items-end justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-steel">Operations / Finance</p>
          <h2 className="mt-1 font-display text-3xl font-bold text-navy">Voucher Entry</h2>
          <p className="mt-2 text-sm text-steel">Create reservation, amendment, and PPTP documents from one controlled template.</p>
        </div>
        <div className="flex max-w-full flex-wrap items-center justify-end gap-2">
          <Button
            type="button"
            disabled={actionState !== "idle"}
            onClick={handleClearForm}
            variant="secondary"
            className="h-10 shrink-0 whitespace-nowrap px-4 w-40"
          >
            <RotateCcw size={17} /> Clear Form
          </Button>
          <Button
            type="submit"
            disabled={actionState !== "idle" || !hasChanges}
            onClick={handleTriggerShake}
            variant="primary"
            className="h-10 shrink-0 whitespace-nowrap px-4 w-40"
          >
            <Save size={17} /> {actionState === "saving" ? "Saving..." : "Save Voucher"}
          </Button>
          {/* DOCX Generate Split Button */}
          <div className="relative inline-flex rounded-md shadow-sm shrink-0 group">
            <Button
              type="button"
              disabled={actionState !== "idle" || !form.watch("id") || hasChanges}
              onClick={() => {
                handleTriggerShake();
                form.handleSubmit((values) => handleGenerateDocx(values))();
              }}
              variant="secondary"
              className="h-10 shrink-0 whitespace-nowrap px-3 w-32 rounded-r-none group-hover:border-steel"
              title={!form.watch("id") ? "Save draft before generating documents" : hasChanges ? "Save changes before generating" : "Generate DOCX"}
            >
              <FileText size={17} /> {actionState === "generating-docx" ? "Generating..." : "Generate DOCX"}
            </Button>
            <button
              type="button"
              disabled={actionState !== "idle" || !form.watch("id") || hasChanges}
              onClick={() => setDocxDropdownOpen(prev => !prev)}
              className="h-10 bg-surface hover:bg-cloud border border-line border-l-0 text-steel hover:text-navy px-2 rounded-r-md rounded-l-none flex items-center justify-center transition shrink-0 group-hover:border-steel disabled:opacity-60 disabled:cursor-not-allowed"
              title={!form.watch("id") ? "Save draft before generating documents" : hasChanges ? "Save changes before generating" : "More DOCX Options"}
            >
              <ChevronDown size={14} />
            </button>
            {docxDropdownOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setDocxDropdownOpen(false)} />
                <div className="absolute right-0 top-full mt-1 w-full bg-surface border border-line rounded-lg shadow-md z-50 p-1 space-y-0.5 text-xs text-ink font-semibold">
                  <button
                    type="button"
                    onClick={async () => {
                      setDocxDropdownOpen(false);
                      if (!window.meridian?.selectFolder) return;
                      const customDir = await window.meridian.selectFolder({ title: "Select Folder to Save DOCX" });
                      if (customDir) {
                        handleTriggerShake();
                        void form.handleSubmit((values) => handleGenerateDocx(values, customDir))();
                      }
                    }}
                    className="w-full text-center px-3 py-2 hover:bg-cloud rounded text-navy transition"
                  >
                    Generate As
                  </button>
                </div>
              </>
            )}
          </div>

          {/* PDF Generate Split Button */}
          <div className="relative inline-flex rounded-md shadow-sm shrink-0 group">
            <Button
              type="button"
              disabled={actionState !== "idle" || !form.watch("id") || hasChanges}
              onClick={() => {
                handleTriggerShake();
                form.handleSubmit((values) => handleGeneratePdf(values))();
              }}
              variant="secondary"
              className="h-10 shrink-0 whitespace-nowrap px-3 w-32 rounded-r-none group-hover:border-steel"
              title={!form.watch("id") ? "Save draft before generating documents" : hasChanges ? "Save changes before generating" : "Generate PDF"}
            >
              <FileDown size={17} /> {actionState === "generating-pdf" ? "Generating..." : "Generate PDF"}
            </Button>
            <button
              type="button"
              disabled={actionState !== "idle" || !form.watch("id") || hasChanges}
              onClick={() => setPdfDropdownOpen(prev => !prev)}
              className="h-10 bg-surface hover:bg-cloud border border-line border-l-0 text-steel hover:text-navy px-2 rounded-r-md rounded-l-none flex items-center justify-center transition shrink-0 group-hover:border-steel disabled:opacity-60 disabled:cursor-not-allowed"
              title={!form.watch("id") ? "Save draft before generating documents" : hasChanges ? "Save changes before generating" : "More PDF Options"}
            >
              <ChevronDown size={14} />
            </button>
            {pdfDropdownOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setPdfDropdownOpen(false)} />
                <div className="absolute right-0 top-full mt-1 w-full bg-surface border border-line rounded-lg shadow-md z-50 p-1 space-y-0.5 text-xs text-ink font-semibold">
                  <button
                    type="button"
                    onClick={async () => {
                      setPdfDropdownOpen(false);
                      if (!window.meridian?.selectFolder) return;
                      const customDir = await window.meridian.selectFolder({ title: "Select Folder to Save PDF" });
                      if (customDir) {
                        handleTriggerShake();
                        void form.handleSubmit((values) => handleGeneratePdf(values, customDir))();
                      }
                    }}
                    className="w-full text-center px-3 py-2 hover:bg-cloud rounded text-navy transition"
                  >
                    Generate As
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-6">
        {/* Top Section: Side-by-Side Configuration and Booking Info */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {/* Primary Configuration */}
          <Panel className={`app-panel-body-lg flex flex-col h-full justify-between border transition-colors duration-300 ${isPrimaryComplete ? "border-emerald-500/20 bg-emerald-50/[0.02]" : "border-amber-500/20 bg-amber-50/[0.02]"}`}>
            <div>
              <div className="mb-4 flex items-center justify-between">
                <h3 className="app-section-title m-0">Primary Configuration</h3>
                <SectionIndicator isComplete={isPrimaryComplete} shakeTrigger={shakeTrigger} />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Tour Type">
                  <Select
                    className="w-full"
                    {...form.register("tourType")}
                    value={form.watch("tourType") || ""}
                    onChange={(event) => {
                      form.setValue("tourType", event.target.value as VoucherFormValues["tourType"], {
                        shouldValidate: true
                      });
                    }}
                  >
                    <option value="">Select Tour Type</option>
                    {tourTypeOptions.map((type) => (
                      <option value={type} key={type}>
                        {type}
                      </option>
                    ))}
                  </Select>
                  <FieldError message={form.formState.errors.tourType?.message} />
                </Field>
                <Field label="Hotel Name">
                  <Select
                    className="w-full"
                    {...form.register("hotelName")}
                    value={form.watch("hotelName") || ""}
                    onChange={(event) => {
                      form.setValue("hotelName", event.target.value, { shouldValidate: true });
                    }}
                  >
                    <option value="">Select Hotel Name</option>
                    {hotelOptions.map((hotel) => (
                      <option value={hotel} key={hotel}>
                        {hotel}
                      </option>
                    ))}
                  </Select>
                  <FieldError message={form.formState.errors.hotelName?.message} />
                </Field>
                <Field label="Market">
                  <Select
                    className="w-full"
                    {...form.register("market")}
                    value={form.watch("market") || ""}
                    onChange={(event) => {
                      form.setValue("market", event.target.value, { shouldValidate: true });
                    }}
                  >
                    <option value="">Select Market</option>
                    {marketOptions.map((m) => (
                      <option value={m} key={m}>
                        {m}
                      </option>
                    ))}
                  </Select>
                  <FieldError message={form.formState.errors.market?.message} />
                </Field>
                <Field label="Rate Period">
                  <Select
                    className="w-full"
                    {...form.register("ratePeriod")}
                    value={form.watch("ratePeriod") || ""}
                    onChange={(event) => {
                      form.setValue("ratePeriod", event.target.value, { shouldValidate: true });
                    }}
                  >
                    <option value="">Select Rate Period</option>
                    {uniqueContractNames.map((name) => (
                      <option value={name} key={name}>
                        {name}
                      </option>
                    ))}
                  </Select>
                  <FieldError message={form.formState.errors.ratePeriod?.message} />
                </Field>
              </div>
            </div>
            <Controller
              control={form.control}
              name="voucherType"
              render={({ field }) => (
                <div className="mt-5 grid grid-cols-3 gap-3">
                  {voucherTypes.map((type) => {
                    const Icon = type.icon;
                    const selected = field.value === type.value;
                    return (
                      <button
                        type="button"
                        key={type.value}
                        onClick={() => field.onChange(type.value)}
                        className={`rounded-app border p-3 text-left transition flex flex-col justify-between h-[100px] ${selected ? "border-navy bg-[var(--color-accent-bg)] text-navy" : "border-line bg-surface text-ink hover:border-steel"
                          }`}
                      >
                        <div className="flex items-center justify-between w-full">
                          <Icon size={18} />
                          <div className={`h-2 w-2 rounded-full ${selected ? "bg-navy" : "bg-transparent"}`} />
                        </div>
                        <div>
                          <div className="text-xs font-bold">{type.label}</div>
                          <div className="text-[10px] text-steel truncate max-w-full">{type.description}</div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            />
          </Panel>

          {/* Booking Information */}
          <section className={`app-panel app-panel-body-lg h-full flex flex-col justify-between border transition-colors duration-300 ${isBookingComplete ? "border-emerald-500/20 bg-emerald-50/[0.02]" : "border-amber-500/20 bg-amber-50/[0.02]"}`}>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="app-section-title m-0">Booking Information</h3>
              <SectionIndicator isComplete={isBookingComplete} shakeTrigger={shakeTrigger} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 flex-1">
              <label className="space-y-1">
                <span className="app-label">Date</span>
                <input type="date" className="app-input" {...form.register("date")} />
                <FieldError message={form.formState.errors.date?.message} />
              </label>
              <label className="space-y-1">
                <span className="app-label">Voucher Title</span>
                <input
                  className="app-input"
                  placeholder={voucherType.replace(/^\w/, (l) => l.toUpperCase()) + " Voucher"}
                  {...form.register("voucherTitle")}
                />
              </label>
              <label className="space-y-1">
                <span className="app-label">Requisition No</span>
                <input className="app-input" placeholder="REQ-00000" {...form.register("requisitionNo")} />
                <FieldError message={form.formState.errors.requisitionNo?.message} />
              </label>
              <label className="space-y-1">
                <span className="app-label">Tour No</span>
                <input className="app-input" placeholder="T/0000" {...form.register("tourNo")} />
                <FieldError message={form.formState.errors.tourNo?.message} />
              </label>
              <label className="space-y-1">
                <span className="app-label">Customer</span>
                <Select
                  className="w-full"
                  {...form.register("customerName")}
                  onChange={(event) => {
                    form.setValue("customerName", event.target.value, {
                      shouldValidate: true
                    });
                  }}
                >
                  <option value="">Select Customer</option>
                  {customerOptions.map((customer) => (
                    <option value={customer} key={customer}>
                      {customer}
                    </option>
                  ))}
                </Select>
                <FieldError message={form.formState.errors.customerName?.message} />
              </label>
              <label className="space-y-1">
                <span className="app-label">Tour Name</span>
                <input className="app-input" placeholder="Auto-filled if empty" {...form.register("tourName")} />
                <FieldError message={form.formState.errors.tourName?.message} />
              </label>
            </div>
          </section>
        </div>

        {/* Voucher Table takes full horizontal width */}
        <VoucherTable
          fields={fields}
          append={append}
          remove={remove}
          register={form.register}
          control={form.control}
          roomCategoryOptions={roomCategoryOptions}
          mealBasisOptionsState={mealBasisOptionsState}
          availableSupplements={availableSupplements}
          lineItems={lineItems}
          dailyRooms={dailyRooms}
          isContentComplete={isContentComplete}
          shakeTrigger={shakeTrigger}
        />

        {/* Bottom Section: Side-by-Side Confirmation / Rates & Side Panels */}
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
          {/* Confirmation & Rates (Left Column - Spans 8 cols) */}
          <section className={`app-panel app-panel-body-lg xl:col-span-8 border transition-colors duration-300 ${isRateComplete ? "border-emerald-500/20 bg-emerald-50/[0.02]" : "border-amber-500/20 bg-amber-50/[0.02]"}`}>
            <div className="mb-5 flex items-center justify-between">
              <h3 className="app-section-title m-0">Confirmation & Rates</h3>
              <SectionIndicator isComplete={isRateComplete} shakeTrigger={shakeTrigger} />
            </div>
            <div className="space-y-4">
              <label className="block space-y-1.5">
                <span className="app-label">Confirmed By</span>
                <input className="app-input" placeholder="Reservation contact" {...form.register("confirmedBy")} />
                <FieldError message={form.formState.errors.confirmedBy?.message} />
              </label>

              <label className="block space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="app-label">Rate Applicable</span>
                  <label className="flex items-center gap-2 text-xs font-semibold text-steel hover:text-navy cursor-pointer">
                    <input
                      type="checkbox"
                      checked={manualRates}
                      onChange={(e) => setManualRates(e.target.checked)}
                      className="rounded border-line text-navy focus:ring-navy"
                    />
                    Manual Override
                  </label>
                </div>
                <textarea
                  className={`app-textarea min-h-32 font-mono ${manualRates ? "border-line bg-surface text-ink" : "border-navy/20 bg-blue-100/20 text-navy"}`}
                  readOnly={!manualRates}
                  {...form.register("rateApplicableText")}
                  placeholder="Select a hotel and fill room details to see rates"
                />
                <p className="text-[11px] text-steel">
                  {manualRates ? "Rates are manually overridden. Auto-fill is disabled." : "Computed live from Rate Master. Changes when you edit dates, rooms, or basis."}
                </p>
              </label>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <label className="block space-y-1.5">
                  <span className="app-label">Remarks</span>
                  <textarea className="app-textarea min-h-24" {...form.register("remarks")} />
                </label>

                <label className="block space-y-1.5">
                  <span className="app-label">Billing Instructions</span>
                  <textarea className="app-textarea min-h-24" {...form.register("billingInstructions")} />
                </label>
              </div>
            </div>
          </section>

          {/* Right Column: Employee Info & Generated Files (Spans 4 cols) */}
          <div className="xl:col-span-4 space-y-6">
            <section className={`app-panel app-panel-body-lg border transition-colors duration-300 ${isEmployeeComplete ? "border-emerald-500/20 bg-emerald-50/[0.02]" : "border-amber-500/20 bg-amber-50/[0.02]"}`}>
              <div className="mb-4 flex items-center justify-between">
                <h3 className="app-section-title m-0">Employee Details</h3>
                <SectionIndicator isComplete={isEmployeeComplete} shakeTrigger={shakeTrigger} />
              </div>
              <div className="space-y-4">
                <label className="block space-y-1.5">
                  <span className="app-label">Employee Name</span>
                  <input className="app-input" placeholder="Employee name" {...form.register("employeeName")} />
                  <FieldError message={form.formState.errors.employeeName?.message} />
                </label>
                <label className="block space-y-1.5">
                  <span className="app-label">Employee Email</span>
                  <input type="email" className="app-input" placeholder="employee@company.com" {...form.register("employeeEmail")} />
                  <FieldError message={form.formState.errors.employeeEmail?.message} />
                </label>
              </div>
            </section>

          </div>
        </div>

        <LivePreviewWidget
          previewMode={previewMode}
          setPreviewMode={setPreviewMode}
          previewPos={previewPos}
          windowSize={windowSize}
          isDraggingPreview={isDraggingPreview}
          startDragPreview={startDragPreview}
          date={form.watch("date") || ""}
          voucherType={form.watch("voucherType") || ""}
          hotelName={form.watch("hotelName") || ""}
          requisitionNo={form.watch("requisitionNo") || ""}
          tourNo={form.watch("tourNo") || ""}
          tourName={form.watch("tourName") || ""}
          customerName={form.watch("customerName") || ""}
          lineItems={lineItems}
          confirmedBy={form.watch("confirmedBy") || ""}
          rateApplicableText={form.watch("rateApplicableText") || ""}
          remarks={form.watch("remarks") || ""}
          billingInstructions={form.watch("billingInstructions") || ""}
          employeeName={form.watch("employeeName") || ""}
          employeeEmail={form.watch("employeeEmail") || ""}
        />
      </div>
    </form>
  );
}
