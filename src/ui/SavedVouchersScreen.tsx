import React, { useState } from "react";
import {
  Search,
  Filter,
  FileText,
  Send,
  Layers,
  RefreshCw,
  Eye,
  Clock,
} from "lucide-react";
import { Select } from "./ui-kit/Inputs";
import type {
  VoucherRecord,
  VoucherListFilters,
  VoucherStatus,
} from "../../electron/shared/types";

interface SavedVouchersScreenProps {
  voucherFilters: VoucherListFilters;
  setVoucherFilters: React.Dispatch<React.SetStateAction<VoucherListFilters>>;
  refreshVoucherRegister: (filters: VoucherListFilters) => Promise<void>;
  isLoadingRegister: boolean;
  voucherRegister: VoucherRecord[];
  statusUpdatingId: string | null;
  handleVoucherStatusUpdate: (
    id: string,
    nextStatus: VoucherStatus,
  ) => Promise<void>;
  openingVoucherId: string | null;
  openVoucherFromSearch: (voucher: VoucherRecord) => Promise<void>;
}

const voucherStatusOptions = [
  { value: "draft", label: "Draft" },
  { value: "generated", label: "Generated" },
  { value: "sent", label: "Sent" },
] as const;

export function SavedVouchersScreen({
  voucherFilters,
  setVoucherFilters,
  refreshVoucherRegister,
  isLoadingRegister,
  voucherRegister,
  statusUpdatingId,
  handleVoucherStatusUpdate,
  openingVoucherId,
  openVoucherFromSearch,
}: SavedVouchersScreenProps) {
  const [localSearch, setLocalSearch] = useState(voucherFilters.query || "");

  // Calculate high-productivity metrics in real-time
  const totalCount = voucherRegister.length;
  const draftCount = voucherRegister.filter((v) => v.status === "draft").length;
  const generatedCount = voucherRegister.filter(
    (v) => v.status === "generated",
  ).length;
  const sentCount = voucherRegister.filter((v) => v.status === "sent").length;

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const nextFilters = { ...voucherFilters, query: localSearch };
    setVoucherFilters(nextFilters);
    void refreshVoucherRegister(nextFilters);
  };

  const handleClearFilters = () => {
    setLocalSearch("");
    const nextFilters = {
      status: "all" as const,
      dateFrom: "",
      dateTo: "",
      query: "",
    };
    setVoucherFilters(nextFilters);
    void refreshVoucherRegister(nextFilters);
  };

  const setDateRange = (days: number | null) => {
    if (days === null) {
      const nextFilters = { ...voucherFilters, dateFrom: "", dateTo: "" };
      setVoucherFilters(nextFilters);
      void refreshVoucherRegister(nextFilters);
      return;
    }
    const today = new Date();
    const pastDate = new Date();
    pastDate.setDate(today.getDate() - days);

    const formattedToday = today.toISOString().slice(0, 10);
    const formattedPast = pastDate.toISOString().slice(0, 10);

    const nextFilters = {
      ...voucherFilters,
      dateFrom: formattedPast,
      dateTo: formattedToday,
    };
    setVoucherFilters(nextFilters);
    void refreshVoucherRegister(nextFilters);
  };

  return (
    <div className="mx-auto max-w-[1500px] p-4 md:p-8 space-y-8">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-steel">
              Operations & Data Studio
            </p>
            <h2 className="mt-1 font-display text-3xl font-bold text-navy tracking-tight">
              Saved Vouchers
            </h2>
            <p className="mt-1 text-sm text-steel">
              Manage, track, and supervise all active bookings and historic
              revisions.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => void refreshVoucherRegister(voucherFilters)}
            className="flex items-center gap-2 px-4 py-2 text-sm font-semibold border border-line rounded-app bg-surface text-navy hover:bg-cloud transition-all active:scale-95 shadow-sm"
          >
            <RefreshCw
              size={14}
              className={isLoadingRegister ? "animate-spin" : ""}
            />
            Reload List
          </button>
        </div>
      </div>

      {/* Metric Banners (KPI cards) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Bookings */}
        <div className="relative overflow-hidden rounded-app border border-line bg-surface p-5 shadow-sm hover:shadow-md transition-all group">
          <div className="absolute top-0 right-0 h-16 w-16 bg-blue-500/5 rounded-bl-full transition-all group-hover:scale-110" />
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-50 text-blue-600">
              <Layers size={20} />
            </div>
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-steel">
                Total Records
              </span>
              <p className="text-2xl font-bold text-navy mt-0.5">
                {totalCount}
              </p>
            </div>
          </div>
        </div>

        {/* Drafts */}
        <div className="relative overflow-hidden rounded-app border border-line bg-surface p-5 shadow-sm hover:shadow-md transition-all group">
          <div className="absolute top-0 right-0 h-16 w-16 bg-amber-500/5 rounded-bl-full transition-all group-hover:scale-110" />
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-50 text-amber-600">
              <Clock size={20} />
            </div>
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-steel">
                Draft State
              </span>
              <p className="text-2xl font-bold text-navy mt-0.5">
                {draftCount}
                <span className="text-xs font-normal text-steel ml-2">
                  (
                  {totalCount ? Math.round((draftCount / totalCount) * 100) : 0}
                  %)
                </span>
              </p>
            </div>
          </div>
        </div>

        {/* Generated */}
        <div className="relative overflow-hidden rounded-app border border-line bg-surface p-5 shadow-sm hover:shadow-md transition-all group">
          <div className="absolute top-0 right-0 h-16 w-16 bg-indigo-500/5 rounded-bl-full transition-all group-hover:scale-110" />
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-50 text-indigo-600">
              <FileText size={20} />
            </div>
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-steel">
                Generated
              </span>
              <p className="text-2xl font-bold text-navy mt-0.5">
                {generatedCount}
                <span className="text-xs font-normal text-steel ml-2">
                  (
                  {totalCount
                    ? Math.round((generatedCount / totalCount) * 100)
                    : 0}
                  %)
                </span>
              </p>
            </div>
          </div>
        </div>

        {/* Sent */}
        <div className="relative overflow-hidden rounded-app border border-line bg-surface p-5 shadow-sm hover:shadow-md transition-all group">
          <div className="absolute top-0 right-0 h-16 w-16 bg-emerald-500/5 rounded-bl-full transition-all group-hover:scale-110" />
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
              <Send size={20} />
            </div>
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-steel">
                Dispatched / Sent
              </span>
              <p className="text-2xl font-bold text-navy mt-0.5">
                {sentCount}
                <span className="text-xs font-normal text-steel ml-2">
                  ({totalCount ? Math.round((sentCount / totalCount) * 100) : 0}
                  %)
                </span>
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Workspace Panel */}
      <div className="app-panel app-panel-body-lg border border-line shadow-sm rounded-app bg-surface">
        {/* Filters Header Section */}
        <div className="border-b border-line pb-6 mb-6">
          <div className="flex flex-col xl:flex-row gap-4 items-stretch xl:items-end justify-between">
            {/* Search Input Form */}
            <form
              onSubmit={handleSearchSubmit}
              className="flex-1 min-w-[280px]"
            >
              <div className="space-y-2">
                <span className="text-xs font-bold uppercase tracking-wider text-steel block">
                  Search Vouchers
                </span>
                <div className="relative">
                  <span className="absolute inset-y-0 left-3 flex items-center text-steel">
                    <Search size={16} />
                  </span>
                  <input
                    type="text"
                    placeholder="Enter Requisition #, Tour #, Customer name or Hotel..."
                    className="w-full rounded-app border border-line pl-10 pr-24 py-2.5 text-sm focus:border-navy focus:outline-none transition-all placeholder:text-slate-400 bg-cloud/30 focus:bg-surface"
                    value={localSearch}
                    onChange={(e) => setLocalSearch(e.target.value)}
                  />
                  <button
                    type="submit"
                    className="absolute right-1.5 top-1.5 bottom-1.5 rounded-app bg-navy hover:bg-navy-light text-white text-xs font-bold px-3.5 flex items-center gap-1.5 transition-all"
                  >
                    Search
                  </button>
                </div>
              </div>
            </form>

            {/* Quick date presets */}
            <div className="space-y-2">
              <span className="text-xs font-bold uppercase tracking-wider text-steel block">
                Quick Presets
              </span>
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => handleClearFilters()}
                  className="rounded-app border border-line bg-surface hover:bg-cloud px-3 py-2 text-xs font-bold text-navy shadow-sm transition-all"
                >
                  All Time
                </button>
                <button
                  type="button"
                  onClick={() => setDateRange(0)}
                  className="rounded-app border border-line bg-surface hover:bg-cloud px-3 py-2 text-xs font-bold text-navy shadow-sm transition-all"
                >
                  Today
                </button>
                <button
                  type="button"
                  onClick={() => setDateRange(7)}
                  className="rounded-app border border-line bg-surface hover:bg-cloud px-3 py-2 text-xs font-bold text-navy shadow-sm transition-all"
                >
                  Last 7 Days
                </button>
                <button
                  type="button"
                  onClick={() => setDateRange(30)}
                  className="rounded-app border border-line bg-surface hover:bg-cloud px-3 py-2 text-xs font-bold text-navy shadow-sm transition-all"
                >
                  Last 30 Days
                </button>
              </div>
            </div>
          </div>

          {/* Advanced filter parameters */}
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t border-line/40">
            <div className="space-y-2">
              <span className="text-xs font-bold uppercase tracking-wider text-steel block">
                Status Classification
              </span>
              <Select
                className="w-full bg-cloud/20"
                value={voucherFilters.status || "all"}
                onChange={(event) => {
                  const nextFilters = {
                    ...voucherFilters,
                    status: event.target.value as VoucherStatus | "all",
                  };
                  setVoucherFilters(nextFilters);
                  void refreshVoucherRegister(nextFilters);
                }}
              >
                <option value="all">All States</option>
                {voucherStatusOptions.map((option) => (
                  <option value={option.value} key={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </div>

            <div className="space-y-2">
              <span className="text-xs font-bold uppercase tracking-wider text-steel block">
                Date Start
              </span>
              <div className="relative">
                <input
                  type="date"
                  className="w-full rounded-app border border-line px-3 py-2 text-sm bg-cloud/20"
                  value={voucherFilters.dateFrom || ""}
                  onChange={(event) => {
                    const nextFilters = {
                      ...voucherFilters,
                      dateFrom: event.target.value,
                    };
                    setVoucherFilters(nextFilters);
                    void refreshVoucherRegister(nextFilters);
                  }}
                />
              </div>
            </div>

            <div className="space-y-2">
              <span className="text-xs font-bold uppercase tracking-wider text-steel block">
                Date End
              </span>
              <div className="relative">
                <input
                  type="date"
                  className="w-full rounded-app border border-line px-3 py-2 text-sm bg-cloud/20"
                  value={voucherFilters.dateTo || ""}
                  onChange={(event) => {
                    const nextFilters = {
                      ...voucherFilters,
                      dateTo: event.target.value,
                    };
                    setVoucherFilters(nextFilters);
                    void refreshVoucherRegister(nextFilters);
                  }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* List Content */}
        {isLoadingRegister ? (
          <div className="py-20 text-center space-y-3">
            <RefreshCw className="animate-spin text-navy mx-auto" size={32} />
            <p className="text-sm font-semibold text-steel">
              Retrieving data record matrix...
            </p>
          </div>
        ) : voucherRegister.length === 0 ? (
          <div className="py-16 text-center max-w-md mx-auto space-y-4">
            <div className="h-12 w-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto text-slate-400">
              <Filter size={20} />
            </div>
            <div>
              <p className="text-base font-bold text-navy">
                No records matching parameters
              </p>
              <p className="text-sm text-steel mt-1">
                Try resetting the filters or typing a different search query in
                the search bar above.
              </p>
            </div>
            <button
              onClick={handleClearFilters}
              className="px-4 py-2 bg-navy text-white text-xs font-bold rounded-app hover:bg-navy-light transition-all active:scale-95"
            >
              Reset Filters
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Action Bar */}
            <div className="flex justify-between items-center text-xs text-steel font-bold bg-cloud/40 px-4 py-2.5 rounded-app">
              <span>SHOWING {totalCount} RECORDS FOUND</span>
              <span>DOUBLE CLICK OR PRESS OPEN TO PREVIEW</span>
            </div>

            {/* List Table */}
            <div className="overflow-x-auto border border-line/65 rounded-app">
              <table className="w-full min-w-[900px] border-collapse text-sm text-left">
                <thead>
                  <tr className="bg-cloud/70 border-b border-line text-xs font-bold uppercase tracking-wider text-navy">
                    <th className="px-5 py-4 w-[200px]">
                      Requisition / Tour #
                    </th>
                    <th className="px-5 py-4">Hotel Placement</th>
                    <th className="px-5 py-4">Customer Account</th>
                    <th className="px-5 py-4 w-[160px]">Created Date</th>
                    <th className="px-5 py-4 w-[180px]">Status Pipeline</th>
                    <th className="px-5 py-4 w-[120px] text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line/60 bg-surface">
                  {voucherRegister.map((voucher) => {
                    // Type styling colors
                    let typeClass = "bg-cloud text-steel border border-line";
                    if (voucher.voucherType === "reservation") {
                      typeClass =
                        "bg-blue-50 text-blue-700 border border-blue-100";
                    } else if (voucher.voucherType === "amendment") {
                      typeClass =
                        "bg-cyan-50 text-cyan-700 border border-cyan-100";
                    } else if (voucher.voucherType === "pptp") {
                      typeClass =
                        "bg-emerald-50 text-emerald-700 border border-emerald-100";
                    }

                    // Status style badges
                    let statusDot = "bg-slate-400";
                    let statusBg = "bg-cloud text-steel border border-line";
                    if (voucher.status === "draft") {
                      statusDot = "bg-amber-400";
                      statusBg =
                        "bg-amber-50 text-amber-800 border border-amber-200";
                    } else if (voucher.status === "generated") {
                      statusDot = "bg-indigo-500";
                      statusBg =
                        "bg-indigo-50 text-indigo-800 border border-indigo-200";
                    } else if (voucher.status === "sent") {
                      statusDot = "bg-emerald-500";
                      statusBg =
                        "bg-emerald-50 text-emerald-800 border border-emerald-200";
                    }

                    return (
                      <tr
                        key={voucher.id}
                        className="hover:bg-cloud/30 transition-all group cursor-pointer"
                        onDoubleClick={() =>
                          void openVoucherFromSearch(voucher)
                        }
                      >
                        <td className="px-5 py-3.5">
                          <div className="flex flex-col gap-1">
                            <span className="font-bold text-navy hover:text-navy/80 transition-all text-sm">
                              {voucher.requisitionNo ||
                                voucher.tourNo ||
                                "No Ref"}
                            </span>
                            {voucher.tourName ? (
                              <span
                                className="text-[11px] text-steel font-medium truncate max-w-[180px]"
                                title={voucher.tourName}
                              >
                                {voucher.tourName}
                              </span>
                            ) : (
                              <span className="text-[11px] text-slate-400 italic">
                                No Tour Name
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-5 py-3.5">
                          <div className="space-y-1">
                            <p className="font-semibold text-navy-light">
                              {voucher.hotelName}
                            </p>
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${typeClass}`}
                            >
                              {voucher.voucherType}
                            </span>
                          </div>
                        </td>
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-1.5">
                            <span className="font-medium text-steel">
                              {voucher.customerName || "Walk-In Customer"}
                            </span>
                          </div>
                        </td>
                        <td className="px-5 py-3.5">
                          <div className="text-xs">
                            <p className="font-semibold text-navy-light">
                              {new Date(voucher.createdAt).toLocaleDateString(
                                "en-GB",
                                {
                                  day: "2-digit",
                                  month: "short",
                                  year: "numeric",
                                },
                              )}
                            </p>
                            <p className="text-[11px] text-steel">
                              {new Date(voucher.createdAt).toLocaleTimeString(
                                [],
                                { hour: "2-digit", minute: "2-digit" },
                              )}
                            </p>
                          </div>
                        </td>
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-2">
                            <div
                              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${statusBg}`}
                            >
                              <span
                                className={`h-1.5 w-1.5 rounded-full ${statusDot} animate-pulse`}
                              />
                              <span className="capitalize">
                                {voucher.status}
                              </span>
                            </div>

                            <label
                              className="sr-only"
                              htmlFor={`status-changer-${voucher.id}`}
                            >
                              Update status pipeline
                            </label>
                            <Select
                              id={`status-changer-${voucher.id}`}
                              disabled={statusUpdatingId === voucher.id}
                              value={voucher.status}
                              onChange={(event) => {
                                void handleVoucherStatusUpdate(
                                  voucher.id,
                                  event.target.value as VoucherStatus,
                                );
                              }}
                              className="app-table-control text-xs bg-surface border border-line rounded-app focus:ring-1 focus:ring-navy max-w-[110px] py-0.5 px-2.5 font-semibold text-navy"
                            >
                              <option value="draft">Draft</option>
                              <option value="generated">Generated</option>
                              <option value="sent">Sent</option>
                            </Select>
                          </div>
                        </td>
                        <td className="px-5 py-3.5 text-right">
                          <button
                            type="button"
                            disabled={openingVoucherId === voucher.id}
                            onClick={() => void openVoucherFromSearch(voucher)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-navy hover:bg-navy-light text-white text-xs font-bold rounded-app transition-all active:scale-95 shadow-sm disabled:opacity-50"
                          >
                            <Eye size={12} />
                            <span>
                              {openingVoucherId === voucher.id
                                ? "Loading..."
                                : "Open"}
                            </span>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
