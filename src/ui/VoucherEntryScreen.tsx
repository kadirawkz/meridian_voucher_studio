import React from "react";
import { UseFormReturn, Controller } from "react-hook-form";
import { VoucherFormValues } from "../domain/voucherSchema";
import { Button } from "./ui-kit/Button";
import { Field } from "./ui-kit/Field";
import { Select } from "./ui-kit/Inputs";
import { Panel } from "./ui-kit/Panel";
import { RotateCcw, Save, FileText, ChevronDown, FileDown, Hotel, ReceiptText } from "lucide-react";
import { VoucherTable } from "./VoucherTable";
import { GeneratedFilesPanel } from "./AppPanels";
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
  lineItems: any[];
  dailyRooms: { date: string; rooms: number; children: number; }[];
  fields: any[];
  append: (val: any) => void;
  remove: (index: number) => void;
  manualRates: boolean;
  setManualRates: React.Dispatch<React.SetStateAction<boolean>>;
  generated: any;
  previewMode: "collapsed" | "thumbnail" | "expanded";
  setPreviewMode: React.Dispatch<React.SetStateAction<"collapsed" | "thumbnail" | "expanded">>;
  previewPos: { x: number; y: number };
  windowSize: { width: number; height: number };
  isDraggingPreview: boolean;
  startDragPreview: (e: React.MouseEvent) => void;
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="text-xs font-medium text-red-700">{message}</p>;
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
  generated,
  previewMode,
  setPreviewMode,
  previewPos,
  windowSize,
  isDraggingPreview,
  startDragPreview
}: VoucherEntryScreenProps) {
  const voucherType = form.watch("voucherType") || "reservation";

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
            variant="primary"
            className="h-10 shrink-0 whitespace-nowrap px-4 w-40"
          >
            <Save size={17} /> {actionState === "saving" ? "Saving..." : "Save Voucher"}
          </Button>
          {/* DOCX Generate Split Button */}
          <div className="relative inline-flex rounded-md shadow-sm shrink-0">
            <Button
              type="button"
              disabled={actionState !== "idle"}
              onClick={form.handleSubmit((values) => handleGenerateDocx(values))}
              variant="secondary"
              className="h-10 shrink-0 whitespace-nowrap px-3 w-32 rounded-r-none border-r-0"
            >
              <FileText size={17} /> {actionState === "generating-docx" ? "Generating..." : "Generate DOCX"}
            </Button>
            <button
              type="button"
              disabled={actionState !== "idle"}
              onClick={() => setDocxDropdownOpen(prev => !prev)}
              className="h-10 bg-cloud hover:bg-cloud/80 border border-line text-steel hover:text-navy px-2 rounded-r-md flex items-center justify-center transition border-l-0 shrink-0"
              title="More DOCX Options"
            >
              <ChevronDown size={14} />
            </button>
            {docxDropdownOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setDocxDropdownOpen(false)} />
                <div className="absolute right-0 top-full mt-1 w-48 bg-surface border border-line rounded-lg shadow-md z-50 p-1 space-y-0.5 text-xs text-ink font-semibold">
                  <button
                    type="button"
                    onClick={() => {
                      setDocxDropdownOpen(false);
                      void form.handleSubmit((values) => handleGenerateDocx(values))();
                    }}
                    className="w-full text-left px-3 py-2 hover:bg-cloud rounded transition text-steel hover:text-navy"
                  >
                    Generate (Default Folder)
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      setDocxDropdownOpen(false);
                      if (!window.meridian?.selectFolder) return;
                      const customDir = await window.meridian.selectFolder({ title: "Select Folder to Save DOCX" });
                      if (customDir) {
                        void form.handleSubmit((values) => handleGenerateDocx(values, customDir))();
                      }
                    }}
                    className="w-full text-left px-3 py-2 hover:bg-cloud rounded text-navy transition"
                  >
                    Generate As... (Select Folder)
                  </button>
                </div>
              </>
            )}
          </div>

          {/* PDF Generate Split Button */}
          <div className="relative inline-flex rounded-md shadow-sm shrink-0">
            <Button
              type="button"
              disabled={actionState !== "idle"}
              onClick={form.handleSubmit((values) => handleGeneratePdf(values))}
              variant="secondary"
              className="h-10 shrink-0 whitespace-nowrap px-3 w-32 rounded-r-none border-r-0"
            >
              <FileDown size={17} /> {actionState === "generating-pdf" ? "Generating..." : "Generate PDF"}
            </Button>
            <button
              type="button"
              disabled={actionState !== "idle"}
              onClick={() => setPdfDropdownOpen(prev => !prev)}
              className="h-10 bg-cloud hover:bg-cloud/80 border border-line text-steel hover:text-navy px-2 rounded-r-md flex items-center justify-center transition border-l-0 shrink-0"
              title="More PDF Options"
            >
              <ChevronDown size={14} />
            </button>
            {pdfDropdownOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setPdfDropdownOpen(false)} />
                <div className="absolute right-0 top-full mt-1 w-48 bg-surface border border-line rounded-lg shadow-md z-50 p-1 space-y-0.5 text-xs text-ink font-semibold">
                  <button
                    type="button"
                    onClick={() => {
                      setPdfDropdownOpen(false);
                      void form.handleSubmit((values) => handleGeneratePdf(values))();
                    }}
                    className="w-full text-left px-3 py-2 hover:bg-cloud rounded transition text-steel hover:text-navy"
                  >
                    Generate (Default Folder)
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      setPdfDropdownOpen(false);
                      if (!window.meridian?.selectFolder) return;
                      const customDir = await window.meridian.selectFolder({ title: "Select Folder to Save PDF" });
                      if (customDir) {
                        void form.handleSubmit((values) => handleGeneratePdf(values, customDir))();
                      }
                    }}
                    className="w-full text-left px-3 py-2 hover:bg-cloud rounded text-navy transition"
                  >
                    Generate As... (Select Folder)
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-8">
        <div className="space-y-6">
          <Panel className="app-panel-body-lg">
            <h3 className="mb-5 app-section-title">Primary Configuration</h3>
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-4 gap-5">
              <Field label="Tour Type">
                <Select
                  className={`w-full ${form.formState.errors.tourType ? "border-red-500" : ""}`}
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
                  className={`w-full ${form.formState.errors.hotelName ? "border-red-500" : ""}`}
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
                  className={`w-full ${form.formState.errors.market ? "border-red-500" : ""}`}
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
                  className={`w-full ${form.formState.errors.ratePeriod ? "border-red-500" : ""}`}
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
            <Controller
              control={form.control}
              name="voucherType"
              render={({ field }) => (
                <div className="mt-5 grid grid-cols-1 lg:grid-cols-3 gap-4">
                  {voucherTypes.map((type) => {
                    const Icon = type.icon;
                    const selected = field.value === type.value;
                    return (
                      <button
                        type="button"
                        key={type.value}
                        onClick={() => field.onChange(type.value)}
                        className={`rounded-app border p-4 text-left transition ${selected ? "border-navy bg-[var(--color-accent-bg)] text-navy" : "border-line bg-surface text-ink hover:border-steel"
                          }`}
                      >
                        <Icon size={22} />
                        <div className="mt-3 text-sm font-bold">{type.label}</div>
                        <div className="mt-1 text-xs text-steel">{type.description}</div>
                      </button>
                    );
                  })}
                </div>
              )}
            />
          </Panel>

          <section className="app-panel app-panel-body-lg">
            <h3 className="mb-5 app-section-title">Booking Information</h3>
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-4 gap-5">
              <label className="space-y-2">
                <span className="app-label">Date</span>
                <input type="date" className="app-input" {...form.register("date")} />
                <FieldError message={form.formState.errors.date?.message} />
              </label>
              <label className="space-y-2">
                <span className="app-label">Voucher Title</span>
                <input
                  className="app-input"
                  placeholder={voucherType.replace(/^\w/, (l) => l.toUpperCase()) + " Voucher"}
                  {...form.register("voucherTitle")}
                />
              </label>
              <label className="space-y-2">
                <span className="app-label">Requisition No</span>
                <input className="app-input" placeholder="REQ-00000" {...form.register("requisitionNo")} />
                <FieldError message={form.formState.errors.requisitionNo?.message} />
              </label>
              <label className="space-y-2">
                <span className="app-label">Tour No</span>
                <input className="app-input" placeholder="T/0000" {...form.register("tourNo")} />
                <FieldError message={form.formState.errors.tourNo?.message} />
              </label>
              <label className="space-y-2">
                <span className="app-label">Customer</span>
                <Select
                  className={`w-full ${form.formState.errors.customerName ? "border-red-500" : ""}`}
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
              <label className="space-y-2">
                <span className="app-label">Tour Name</span>
                <input className="app-input" placeholder="Auto-filled if empty" {...form.register("tourName")} />
                <FieldError message={form.formState.errors.tourName?.message} />
              </label>
            </div>
          </section>

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
          />

          {/* Post-Content Fields */}
          <section className="app-panel app-panel-body-lg">
            <h3 className="mb-5 app-section-title">Confirmation & Rates</h3>
            <div className="space-y-5">
              <label className="block space-y-2">
                <span className="app-label">Confirmed By</span>
                <input className="app-input" placeholder="Reservation contact" {...form.register("confirmedBy")} />
                <FieldError message={form.formState.errors.confirmedBy?.message} />
              </label>

              <label className="block space-y-2">
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
                  className={`app-textarea min-h-48 font-mono ${manualRates ? "border-line bg-surface text-ink" : "border-navy/20 bg-blue-100/20 text-navy"}`}
                  readOnly={!manualRates}
                  {...form.register("rateApplicableText")}
                  placeholder="Select a hotel and fill room details to see rates"
                />
                <p className="text-xs text-steel">
                  {manualRates ? "Rates are manually overridden. Auto-fill is disabled." : "Computed live from Rate Master. Changes when you edit dates, rooms, or basis."}
                </p>
              </label>

              <label className="block space-y-2">
                <span className="app-label">Remarks</span>
                <textarea className="app-textarea" {...form.register("remarks")} />
              </label>

              <label className="block space-y-2">
                <span className="app-label">Billing Instructions</span>
                <textarea className="app-textarea min-h-32" {...form.register("billingInstructions")} />
              </label>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <label className="space-y-2">
                  <span className="app-label">Employee Name</span>
                  <input className="app-input" placeholder="Employee name" {...form.register("employeeName")} />
                  <FieldError message={form.formState.errors.employeeName?.message} />
                </label>
                <label className="space-y-2">
                  <span className="app-label">Employee Email</span>
                  <input type="email" className="app-input" placeholder="employee@company.com" {...form.register("employeeEmail")} />
                  <FieldError message={form.formState.errors.employeeEmail?.message} />
                </label>
              </div>
            </div>
          </section>
        </div>

        <aside className="pt-6 border-t border-line max-w-[400px]">
          <GeneratedFilesPanel generated={generated} onOpenDocument={(filePath) => window.meridian.openDocument(filePath)} />
        </aside>

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
