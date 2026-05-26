import React from "react";
import { ChevronLeft } from "lucide-react";
import { Select } from "./ui-kit/Inputs";
import type { VoucherRecord, VoucherListFilters, VoucherStatus } from "../../electron/shared/types";

interface SavedVouchersScreenProps {
  setActiveView: (view: any) => void;
  voucherFilters: VoucherListFilters;
  setVoucherFilters: React.Dispatch<React.SetStateAction<VoucherListFilters>>;
  refreshVoucherRegister: (filters: VoucherListFilters) => Promise<void>;
  isLoadingRegister: boolean;
  voucherRegister: VoucherRecord[];
  statusUpdatingId: string | null;
  handleVoucherStatusUpdate: (id: string, nextStatus: VoucherStatus) => Promise<void>;
  openingVoucherId: string | null;
  openVoucherFromSearch: (voucher: VoucherRecord) => Promise<void>;
}

const voucherStatusOptions = [
  { value: "draft", label: "Draft" },
  { value: "generated", label: "Generated" },
  { value: "sent", label: "Sent" }
] as const;

export function SavedVouchersScreen({
  setActiveView,
  voucherFilters,
  setVoucherFilters,
  refreshVoucherRegister,
  isLoadingRegister,
  voucherRegister,
  statusUpdatingId,
  handleVoucherStatusUpdate,
  openingVoucherId,
  openVoucherFromSearch
}: SavedVouchersScreenProps) {
  return (
    <div className="mx-auto max-w-[1400px] p-4 md:p-8">
      <div className="mb-8 flex items-start gap-4">
        <button
          onClick={() => setActiveView("dashboard")}
          className="mt-1 flex h-10 w-10 items-center justify-center rounded-full border border-line bg-surface text-steel hover:bg-cloud hover:text-navy transition-all shadow-sm"
          title="Go to Dashboard"
        >
          <ChevronLeft size={22} />
        </button>
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-steel">Operations / Data Management</p>
          <h2 className="mt-1 font-display text-3xl font-bold text-navy">Saved Vouchers</h2>
          <p className="mt-2 text-sm text-steel">Browse and manage all saved vouchers and their revisions.</p>
        </div>
      </div>

      <div className="app-panel app-panel-body-lg">
        <div className="mb-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <label className="space-y-2">
            <span className="app-label">Status</span>
            <Select
              className="w-full"
              value={voucherFilters.status || "all"}
              onChange={(event) => {
                const nextFilters = { ...voucherFilters, status: event.target.value as VoucherStatus | "all" };
                setVoucherFilters(nextFilters);
                void refreshVoucherRegister(nextFilters);
              }}
            >
              <option value="all">All</option>
              {voucherStatusOptions.map((option) => (
                <option value={option.value} key={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </label>
          <label className="space-y-2">
            <span className="text-xs font-bold uppercase tracking-wide text-steel">From</span>
            <input
              type="date"
              className="w-full rounded-app border border-line px-3 py-2"
              value={voucherFilters.dateFrom || ""}
              onChange={(event) => {
                const nextFilters = { ...voucherFilters, dateFrom: event.target.value };
                setVoucherFilters(nextFilters);
                void refreshVoucherRegister(nextFilters);
              }}
            />
          </label>
          <label className="space-y-2">
            <span className="text-xs font-bold uppercase tracking-wide text-steel">To</span>
            <input
              type="date"
              className="w-full rounded-app border border-line px-3 py-2"
              value={voucherFilters.dateTo || ""}
              onChange={(event) => {
                const nextFilters = { ...voucherFilters, dateTo: event.target.value };
                setVoucherFilters(nextFilters);
                void refreshVoucherRegister(nextFilters);
              }}
            />
          </label>
          <label className="space-y-2">
            <span className="text-xs font-bold uppercase tracking-wide text-steel">Quick Filters</span>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="rounded-app border border-line px-3 py-2 text-sm font-bold text-navy hover:bg-blue-50"
                onClick={() => {
                  const today = new Date().toISOString().slice(0, 10);
                  const nextFilters = { ...voucherFilters, dateFrom: today, dateTo: today };
                  setVoucherFilters(nextFilters);
                  void refreshVoucherRegister(nextFilters);
                }}
              >
                Today
              </button>
            </div>
          </label>
        </div>

        {isLoadingRegister ? (
          <p className="text-center text-steel">Loading vouchers...</p>
        ) : voucherRegister.length === 0 ? (
          <p className="text-center text-steel">No vouchers found.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[800px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs font-bold uppercase tracking-wide text-steel">
                  <th className="px-4 py-3">Requisition / Tour</th>
                  <th className="px-4 py-3">Hotel</th>
                  <th className="px-4 py-3">Customer</th>
                  <th className="px-4 py-3">Created On</th>
                  <th className="px-4 py-3 w-[160px]">Status</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {voucherRegister.map((voucher) => (
                  <tr key={voucher.id} className="hover:bg-cloud">
                    <td className="px-4 py-3">
                      <p className="font-bold text-navy">{voucher.requisitionNo || voucher.tourNo}</p>
                      {voucher.tourName && <p className="text-[11px] text-steel truncate max-w-[150px]">{voucher.tourName}</p>}
                    </td>
                    <td className="px-4 py-3">
                      <p>{voucher.hotelName}</p>
                      <p className="text-[11px] text-steel capitalize">{voucher.voucherType}</p>
                    </td>
                    <td className="px-4 py-3">{voucher.customerName}</td>
                    <td className="px-4 py-3">
                      <p>{new Date(voucher.createdAt).toLocaleDateString()}</p>
                      <p className="text-[11px] text-steel">{new Date(voucher.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                    </td>
                    <td className="px-4 py-3">
                      <label className="sr-only" htmlFor={`voucher-status-${voucher.id}`}>
                        Update voucher status for {voucher.requisitionNo || voucher.tourNo || voucher.id}
                      </label>
                      <Select
                        id={`voucher-status-${voucher.id}`}
                        disabled={statusUpdatingId === voucher.id}
                        value={voucher.status}
                        onChange={(event) => {
                          void handleVoucherStatusUpdate(voucher.id, event.target.value as VoucherStatus);
                        }}
                        className="app-table-control"
                      >
                        <option value="draft">Draft</option>
                        <option value="generated">Generated</option>
                        <option value="sent">Sent</option>
                      </Select>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        disabled={openingVoucherId === voucher.id}
                        onClick={() => void openVoucherFromSearch(voucher)}
                        className="app-button-ghost px-0 py-0"
                      >
                        Open
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
