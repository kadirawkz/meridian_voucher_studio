import React from "react";
import { Plus, Trash2 } from "lucide-react";
import { Select } from "./ui-kit/Inputs";
import { Controller } from "react-hook-form";
import { SupplementaryDropdown } from "./SupplementaryDropdown";

interface VoucherTableProps {
  fields: any[];
  append: (val: any) => void;
  remove: (index: number) => void;
  register: any;
  control: any;
  roomCategoryOptions: readonly string[];
  mealBasisOptionsState: readonly string[];
  availableSupplements: { supplement_name: string; room_category: string; supplement_amount: number; per: string; }[];
  lineItems: any[];
  dailyRooms: { date: string; rooms: number; children: number; }[];
}

const tableControlClass = "app-table-control";

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
  dailyRooms
}: VoucherTableProps) {
  return (
    <section className="app-panel app-panel-body-lg">
      <div className="mb-5 flex items-center justify-between">
        <h3 className="app-section-title">Voucher Content</h3>
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
        <table className="w-full min-w-[1440px] table-fixed border-collapse text-sm">
          <colgroup>
            <col className="w-[140px]" />
            <col className="w-[150px]" />
            <col className="w-[100px]" />
            <col className="w-[60px]" />
            <col className="w-[60px]" />
            <col className="w-[60px]" />
            <col className="w-[60px]" />
            <col className="w-[60px]" />
            <col className="w-[60px]" />
            <col className="w-[60px]" />
            <col className="w-[60px]" />
            <col className="w-[60px]" />
            <col className="w-[60px]" />
            <col className="w-[60px]" />
            <col className="w-[90px]" />
            <col className="w-[130px]" />
            <col className="w-[160px]" />
            <col className="w-[56px]" />
          </colgroup>
          <thead>
            <tr className="border-y border-line bg-cloud text-left text-xs font-bold uppercase tracking-wide text-steel">
              <th className="px-2 py-3">Required Date</th>
              <th className="px-2 py-3">Room Category</th>
              <th className="px-2 py-3">Basis (Room)</th>
              <th className="px-2 py-3 text-center border-l border-line" colSpan={4}>Rooms</th>
              <th className="px-2 py-3 text-center border-x border-line" colSpan={3}>Child (2-5.99)</th>
              <th className="px-2 py-3 text-center border-r border-line" colSpan={3}>Child (6-11.99)</th>
              <th className="px-2 py-3 text-center" colSpan={2}>Guide</th>
              <th className="px-2 py-3 border-l border-line">Supplementary</th>
              <th className="px-2 py-3 border-l border-line">Arriving For</th>
              <th className="px-2 py-3"></th>
            </tr>
            <tr className="border-b border-line bg-cloud/50 text-[10px] font-bold uppercase tracking-wider text-steel text-center">
              <th className="px-2 py-1"></th>
              <th className="px-2 py-1"></th>
              <th className="px-2 py-1"></th>
              <th className="px-2 py-1 border-l border-line">SGL</th>
              <th className="px-2 py-1">DBL</th>
              <th className="px-2 py-1">TWN</th>
              <th className="px-2 py-1">TPL</th>
              <th className="px-2 py-1 border-l border-line">Sharing</th>
              <th className="px-2 py-1">Bed</th>
              <th className="px-2 py-1">ICON</th>
              <th className="px-2 py-1 border-l border-line">Sharing</th>
              <th className="px-2 py-1">Bed</th>
              <th className="px-2 py-1 border-r border-line">ICON</th>
              <th className="px-2 py-1">QTY</th>
              <th className="px-2 py-1">BASIS</th>
              <th className="px-2 py-1 border-l border-line"></th>
              <th className="px-2 py-1 border-l border-line"></th>
              <th className="px-2 py-1"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {fields.map((field, index) => (
              <tr key={field.id}>
                {lineItemColumns.map((column) => (
                  <td className={`px-2 py-2 ${column.className}`} key={column.name}>
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
