import React from "react";
import { Plus, Trash2 } from "lucide-react";
import { Select } from "./ui-kit/Inputs";
import { Controller, Control, UseFormRegister, FieldArrayWithId } from "react-hook-form";
import { SupplementaryDropdown } from "./SupplementaryDropdown";
import { VoucherFormValues } from "../domain/voucherSchema";

interface VoucherTableProps {
  fields: FieldArrayWithId<VoucherFormValues, "lineItems", "id">[];
  append: any;
  remove: (index: number) => void;
  register: UseFormRegister<VoucherFormValues>;
  control: Control<VoucherFormValues>;
  roomCategoryOptions: readonly string[];
  mealBasisOptionsState: readonly string[];
  availableSupplements: { supplement_name: string; room_category: string; supplement_amount: number; per: string; }[];
  lineItems: VoucherFormValues["lineItems"];
  dailyRooms: { date: string; rooms: number; children: number; }[];
  isContentComplete?: boolean;
  shakeTrigger?: number;
}

const tableControlClass = "app-table-control";

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

const lineItemColumns = [
  { name: "requiredDate", type: "date", className: "min-w-[150px]" },
  { name: "roomCategory", type: "select-room-category", className: "min-w-[170px]" },
  { name: "basis", type: "select-basis", className: "min-w-[96px]" },
  { name: "singleRooms", type: "number", className: "min-w-[76px]" },
  { name: "doubleRooms", type: "number", className: "min-w-[76px]" },
  { name: "twinRooms", type: "number", className: "min-w-[76px]" },
  { name: "tripleRooms", type: "number", className: "min-w-[76px]" },
  { name: "child2_5Sharing", type: "number", className: "min-w-[66px]" },
  { name: "child2_5Bed", type: "number", className: "min-w-[66px]" },
  { name: "child2_5OwnRoom", type: "number", className: "min-w-[66px]" },
  { name: "child6_11Sharing", type: "number", className: "min-w-[66px]" },
  { name: "child6_11Bed", type: "number", className: "min-w-[66px]" },
  { name: "child6_11OwnRoom", type: "number", className: "min-w-[66px]" },
  { name: "guide", type: "number", className: "min-w-[76px]" },
  { name: "guideBasis", type: "select-basis", className: "min-w-[96px]" },
  { name: "supplementary", type: "select-supplementary", className: "min-w-[130px]" },
  { name: "arrivingFor", type: "text", className: "min-w-[150px]" }
] as const;

const roomCountFields = new Set([
  "singleRooms",
  "doubleRooms",
  "twinRooms",
  "tripleRooms",
  "child2_5Sharing",
  "child2_5Bed",
  "child2_5OwnRoom",
  "child6_11Sharing",
  "child6_11Bed",
  "child6_11OwnRoom",
  "guide"
]);

export function VoucherTable({
  fields,
  append,
  remove,
  register,
  control,
  roomCategoryOptions,
  mealBasisOptionsState,
  availableSupplements,
  lineItems,
  dailyRooms,
  isContentComplete,
  shakeTrigger
}: VoucherTableProps) {
  return (
    <section className={`app-panel app-panel-body-lg border transition-colors duration-300 ${isContentComplete ? "border-emerald-500/20 bg-emerald-50/[0.02]" : "border-amber-500/20 bg-amber-50/[0.02]"}`}>
      <div className="mb-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h3 className="app-section-title m-0">Voucher Content</h3>
          {isContentComplete !== undefined && <SectionIndicator isComplete={isContentComplete} shakeTrigger={shakeTrigger} />}
        </div>
        <button
          type="button"
          className="app-button-ghost"
          onClick={() =>
            append({
              requiredDate: "",
              roomCategory: "",
              basis: "",
              singleRooms: 0,
              doubleRooms: 0,
              twinRooms: 0,
              tripleRooms: 0,
              child2_5: 0,
              child6_11: 0,
              child2_5Sharing: 0,
              child2_5Bed: 0,
              child2_5OwnRoom: 0,
              child6_11Sharing: 0,
              child6_11Bed: 0,
              child6_11OwnRoom: 0,
              guide: 0,
              guideBasis: "",
              arrivingFor: "",
              supplementary: []
            })
          }
        >
          <Plus size={16} /> Row
        </button>
      </div>
      <div className="thin-scrollbar overflow-x-auto pb-48">
        <table className="w-full min-w-[1750px] table-fixed border-collapse text-sm">
          <colgroup>
            <col className="w-[150px]" />
            <col className="w-[180px]" />
            <col className="w-[110px]" />
            <col className="w-[76px]" />
            <col className="w-[76px]" />
            <col className="w-[76px]" />
            <col className="w-[76px]" />
            <col className="w-[72px]" />
            <col className="w-[72px]" />
            <col className="w-[72px]" />
            <col className="w-[72px]" />
            <col className="w-[72px]" />
            <col className="w-[72px]" />
            <col className="w-[72px]" />
            <col className="w-[110px]" />
            <col className="w-[140px]" />
            <col className="w-[180px]" />
            <col className="w-[56px]" />
          </colgroup>
          <thead>
            <tr className="border-y border-line bg-cloud text-left text-xs font-bold uppercase tracking-wide text-steel">
              <th className="px-2 py-3 border-r border-line">Required Date</th>
              <th className="px-2 py-3 border-r border-line">Room Category</th>
              <th className="px-2 py-3 border-r border-line">Basis (Room)</th>
              <th className="px-2 py-3 text-center border-r border-line" colSpan={4}>Rooms</th>
              <th className="px-2 py-3 text-center border-r border-line" colSpan={3}>Child (2-5.99)</th>
              <th className="px-2 py-3 text-center border-r border-line" colSpan={3}>Child (6-11.99)</th>
              <th className="px-2 py-3 text-center border-r border-line" colSpan={2}>Guide</th>
              <th className="px-2 py-3 border-r border-line">Supplementary</th>
              <th className="px-2 py-3 border-r border-line">Arriving For</th>
              <th className="px-2 py-3"></th>
            </tr>
            <tr className="border-b border-line bg-cloud/50 text-[10px] font-bold uppercase tracking-wider text-steel text-center">
              <th className="px-2 py-1 border-r border-line"></th>
              <th className="px-2 py-1 border-r border-line"></th>
              <th className="px-2 py-1 border-r border-line"></th>
              <th className="px-2 py-1 border-r border-line">SGL</th>
              <th className="px-2 py-1 border-r border-line">DBL</th>
              <th className="px-2 py-1 border-r border-line">TWN</th>
              <th className="px-2 py-1 border-r border-line">TPL</th>
              <th className="px-2 py-1 border-r border-line">Sharing</th>
              <th className="px-2 py-1 border-r border-line">Bed</th>
              <th className="px-2 py-1 border-r border-line">ICON</th>
              <th className="px-2 py-1 border-r border-line">Sharing</th>
              <th className="px-2 py-1 border-r border-line">Bed</th>
              <th className="px-2 py-1 border-r border-line">ICON</th>
              <th className="px-2 py-1 border-r border-line">QTY</th>
              <th className="px-2 py-1 border-r border-line">BASIS</th>
              <th className="px-2 py-1 border-r border-line"></th>
              <th className="px-2 py-1 border-r border-line"></th>
              <th className="px-2 py-1"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {fields.map((field, index) => (
              <tr key={field.id}>
                {lineItemColumns.map((column) => (
                  <td className={`px-2 py-2 border-r border-line ${column.className}`} key={column.name}>
                    {column.type === "select-room-category" && (
                      <Select
                        className={tableControlClass}
                        {...register(`lineItems.${index}.${column.name}`)}
                      >
                        <option value="">Select</option>
                        {roomCategoryOptions.map((category) => (
                          <option value={category} key={category}>
                            {category}
                          </option>
                        ))}
                      </Select>
                    )}
                    {column.type === "select-basis" && (
                      <Select
                        className={tableControlClass}
                        {...register(`lineItems.${index}.${column.name}`)}
                      >
                        <option value="">Select</option>
                        {mealBasisOptionsState.map((basis) => (
                          <option value={basis} key={basis}>
                            {basis}
                          </option>
                        ))}
                      </Select>
                    )}
                    {column.type === "select-supplementary" && (
                      <Controller
                        control={control}
                        name={`lineItems.${index}.supplementary` as never}
                        render={({ field: controllerField }) => {
                          const cat = lineItems[index]?.roomCategory || "";
                          const rowOpts = availableSupplements
                            .filter((s) => s.room_category.toLowerCase() === cat.toLowerCase())
                            .map((s) => ({ name: s.supplement_name, label: `${s.supplement_name} (${s.supplement_amount})` }));
                          return (
                            <SupplementaryDropdown
                              value={controllerField.value || []}
                              onChange={controllerField.onChange}
                              options={rowOpts}
                            />
                          );
                        }}
                      />
                    )}
                    {column.type !== "select-room-category" && column.type !== "select-basis" && column.type !== "select-supplementary" && (
                      <Controller
                        control={control}
                        name={`lineItems.${index}.${column.name}` as never}
                        render={({ field: controllerField }) => (
                          <input
                            {...controllerField}
                            ref={(el) => {
                              controllerField.ref(el);
                              if (el && roomCountFields.has(column.name)) {
                                const handleWheel = (e: WheelEvent) => {
                                  if (document.activeElement !== el) return;
                                  e.preventDefault();
                                  const step = 1;
                                  const currentVal = Number(el.value) || 0;
                                  if (e.deltaY < 0) {
                                    const newVal = currentVal + step;
                                    controllerField.onChange(newVal);
                                  } else if (e.deltaY > 0) {
                                    const newVal = Math.max(0, currentVal - step);
                                    controllerField.onChange(newVal);
                                  }
                                };
                                const elWithWheel = el as HTMLInputElement & { _wheelHandler?: (e: WheelEvent) => void };
                                const existing = elWithWheel._wheelHandler;
                                if (existing) {
                                  el.removeEventListener("wheel", existing);
                                }
                                el.addEventListener("wheel", handleWheel, { passive: false });
                                elWithWheel._wheelHandler = handleWheel;
                              }
                            }}
                            type={column.type}
                            min={roomCountFields.has(column.name) ? 0 : undefined}
                            step={roomCountFields.has(column.name) ? 1 : undefined}
                            className={tableControlClass}
                            value={roomCountFields.has(column.name) && controllerField.value === 0 ? "" : controllerField.value}
                            onChange={(e) => {
                              if (roomCountFields.has(column.name)) {
                                const val = e.target.value;
                                controllerField.onChange(val === "" ? 0 : Number(val));
                              } else {
                                controllerField.onChange(e.target.value);
                              }
                            }}
                            onBlur={(e) => {
                              controllerField.onBlur();
                              if (roomCountFields.has(column.name) && Number(e.target.value) < 0) {
                                controllerField.onChange(0);
                              }
                            }}
                          />
                        )}
                      />
                    )}
                  </td>
                ))}
                <td className="px-2 py-2">
                  <button
                    type="button"
                    aria-label={`Remove voucher content row ${index + 1}`}
                    title={`Remove voucher content row ${index + 1}`}
                    className="rounded-app p-2 text-steel hover:bg-red-500/10 hover:text-red-500"
                    onClick={() => remove(index)}
                  >
                    <Trash2 size={16} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Rooms summary bar (Per day calculation) */}
      <div className="mt-4 flex flex-wrap items-center gap-4 rounded-app bg-cloud px-4 py-3 text-sm font-bold">
        <span className="text-steel mr-2">Pax Summary per day:</span>
        {dailyRooms.length > 0 ? (
          dailyRooms.map((dr, idx) => (
            <span key={idx} className="text-steel">
              {dr.date} rooms: <span className="text-navy">{dr.rooms}</span> / child: <span className="text-navy">{dr.children}</span>
            </span>
          ))
        ) : (
          <span className="text-steel opacity-50">No data entered</span>
        )}
      </div>
    </section>
  );
}
