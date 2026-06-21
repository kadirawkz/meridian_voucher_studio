import React, { useState, useEffect, Fragment } from "react";
import {
  Edit2,
  Trash2,
  ChevronLeft,
  AlertTriangle,
  Archive,
  RotateCw,
} from "lucide-react";
import type { HotelRateRecord } from "../../electron/shared/types";
import { friendlyErrorMessage } from "../utils/errors";

type Props = {
  onBack: () => void;
  onEdit: (hotelRateId: string) => void;
  onRatesChanged?: () => void;
  addNotice?: (message: string, type?: "info" | "success" | "error") => void;
};

export function ManageRatesScreen({ onBack, onEdit, onRatesChanged, addNotice }: Props) {
  const [rates, setRates] = useState<HotelRateRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [expandedRateId, setExpandedRateId] = useState<string | null>(null);

  // Archived (inactive) items states
  const [showArchived, setShowArchived] = useState(false);
  const [archivedRates, setArchivedRates] = useState<HotelRateRecord[]>([]);
  const [loadingArchived, setLoadingArchived] = useState(false);
  const [deletingIds, setDeletingIds] = useState<string[]>([]);
  const [restoringIds, setRestoringIds] = useState<string[]>([]);
  const [isInitialLoad, setIsInitialLoad] = useState(true);

  const loadRates = async () => {
    try {
      if (rates.length === 0) {
        setLoading(true);
      }
      if (!window.meridian?.getAllHotelRates)
        throw new Error("API not available");
      const data = await window.meridian.getAllHotelRates();
      setRates(data || []);
    } catch (err) {
      setError(friendlyErrorMessage(err, "Failed to load rates"));
    } finally {
      setLoading(false);
      setIsInitialLoad(false);
    }
  };

  const loadArchivedRates = async () => {
    try {
      setLoadingArchived(true);
      if (!window.meridian?.listInactiveHotelRates)
        throw new Error("API not available");
      const data = await window.meridian.listInactiveHotelRates();
      setArchivedRates(data || []);
    } catch (err) {
      console.error("Failed to load archived rates:", err);
      setArchivedRates([]);
    } finally {
      setLoadingArchived(false);
    }
  };

  useEffect(() => {
    loadRates();
  }, []);

  const handleDelete = async () => {
    if (!deleteId) return;
    const targetId = deleteId;
    const rateRecord = rates.find((r) => r.id === targetId);
    const nameAndContract = rateRecord
      ? `${rateRecord.hotel_name} (${rateRecord.contract_name})`
      : "";
    try {
      setDeleteId(null);
      setDeletingIds((prev) => [...prev, targetId]);

      // Run deletion API call and transition delay concurrently
      await Promise.all([
        window.meridian?.deleteHotelRate(targetId),
        new Promise((resolve) => setTimeout(resolve, 350)),
      ]);

      await loadRates();
      if (showArchived) await loadArchivedRates();
      if (onRatesChanged) onRatesChanged();
      if (addNotice) {
        addNotice(
          `Rate contract ${nameAndContract || ""} successfully deactivated and archived.`,
          "success",
        );
      }
    } catch (err) {
      if (addNotice) {
        addNotice(
          friendlyErrorMessage(err, "Failed to deactivate rate contract"),
          "error",
        );
      }
    } finally {
      setDeletingIds((prev) => prev.filter((id) => id !== targetId));
    }
  };

  const handleRestore = async (id: string) => {
    const rateRecord = archivedRates.find((r) => r.id === id);
    const nameAndContract = rateRecord
      ? `${rateRecord.hotel_name} (${rateRecord.contract_name})`
      : "";
    try {
      setRestoringIds((prev) => [...prev, id]);

      // Run restore API call and transition delay concurrently
      await Promise.all([
        window.meridian?.restoreHotelRate(id),
        new Promise((resolve) => setTimeout(resolve, 350)),
      ]);

      await loadRates();
      await loadArchivedRates();
      if (onRatesChanged) onRatesChanged();
      if (addNotice) {
        addNotice(
          `Rate contract ${nameAndContract || ""} successfully restored and activated.`,
          "success",
        );
      }
    } catch (err) {
      if (addNotice) {
        addNotice(
          friendlyErrorMessage(err, "Failed to restore rate contract"),
          "error",
        );
      }
    } finally {
      setRestoringIds((prev) => prev.filter((item) => item !== id));
    }
  };

  const filteredRates = rates.filter(
    (r) =>
      r.hotel_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.market?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.contract_name?.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  const filteredArchived = archivedRates.filter(
    (r) =>
      r.hotel_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.market?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.contract_name?.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  return (
    <div className="flex h-screen flex-col bg-sand text-ink">
      <header className="flex shrink-0 items-center gap-4 border-b border-line bg-surface px-6 py-4">
        <button
          onClick={onBack}
          className="flex h-10 w-10 items-center justify-center rounded-full border border-line bg-surface text-steel hover:bg-cloud hover:text-navy transition-all shadow-sm"
          aria-label="Go back"
          title="Go back"
        >
          <ChevronLeft size={22} />
        </button>
        <div>
          <h1 className="text-lg font-black tracking-tight text-navy">
            Manage Existing Rates
          </h1>
          <p className="text-xs font-semibold text-steel">
            View, update, or deactivate hotel rate master entries
          </p>
        </div>
        <div className="ml-auto flex items-center gap-3">
          <input
            type="text"
            placeholder="Search hotel or market..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="app-table-control w-64 rounded bg-cloud px-3 py-1.5 text-sm"
          />
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {error && (
          <div className="rounded border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-500">
            {error}
          </div>
        )}

        <div className="space-y-6">
          <div className="rounded-app border border-line bg-surface shadow-sm overflow-hidden">
            <table className="w-full text-left text-sm">
              <thead className="bg-cloud text-xs font-bold uppercase tracking-wide text-steel">
                <tr>
                  <th className="px-4 py-3">Hotel Name</th>
                  <th className="px-4 py-3">Market</th>
                  <th className="px-4 py-3">Contract</th>
                  <th className="px-4 py-3">Valid Period</th>
                  <th className="px-4 py-3">Currency</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {loading && isInitialLoad ? (
                  Array.from({ length: 3 }).map((_, idx) => (
                    <tr key={`skeleton-${idx}`} className="animate-pulse">
                      <td className="px-4 py-4">
                        <div className="h-4 w-32 rounded bg-cloud"></div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="h-4 w-12 rounded bg-cloud"></div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="h-4 w-24 rounded bg-cloud"></div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="h-4 w-36 rounded bg-cloud"></div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="h-4 w-12 rounded bg-cloud"></div>
                      </td>
                      <td className="px-4 py-4 text-right">
                        <div className="ml-auto h-8 w-16 rounded bg-cloud"></div>
                      </td>
                    </tr>
                  ))
                ) : filteredRates.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-4 py-8 text-center text-steel"
                    >
                      No rates found.
                    </td>
                  </tr>
                ) : (
                  filteredRates.map((r) => (
                    <Fragment key={r.id}>
                      <tr
                        className={`reference-row-transition hover:bg-cloud/40 cursor-pointer ${
                          expandedRateId === r.id
                            ? "bg-cloud/30 border-b-transparent"
                            : ""
                        } ${
                          deletingIds.includes(r.id!)
                            ? "reference-row-exit"
                            : ""
                        }`}
                        onClick={() =>
                          setExpandedRateId((prev) =>
                            prev === r.id ? null : r.id || null,
                          )
                        }
                      >
                        <td className="px-4 py-3 font-semibold text-navy flex items-center gap-2 select-none">
                          <span
                            className={`inline-block text-[8px] transform transition-transform text-steel font-bold ${expandedRateId === r.id ? "rotate-90" : ""}`}
                            style={{ width: "8px" }}
                          >
                            ▶
                          </span>
                          <span>{r.hotel_name}</span>
                        </td>
                        <td className="px-4 py-3">{r.market || "-"}</td>
                        <td className="px-4 py-3 font-medium">
                          {r.contract_name || "-"}
                        </td>
                        <td className="px-4 py-3 text-steel">
                          {r.valid_from} to {r.valid_to}
                        </td>
                        <td className="px-4 py-3">
                          <span className="rounded bg-cloud text-navy px-1.5 py-0.5 text-xs font-bold">
                            {r.currency || "USD"}
                          </span>
                        </td>
                        <td
                          className="px-4 py-3 text-right"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="flex justify-end gap-2">
                            <button
                              onClick={() => onEdit(r.id!)}
                              className="rounded p-1.5 text-steel hover:bg-cloud hover:text-navy transition-colors"
                              aria-label={`Edit rate for ${r.hotel_name}`}
                              title={`Edit rate for ${r.hotel_name}`}
                            >
                              <Edit2 size={16} />
                            </button>
                            <button
                              onClick={() => setDeleteId(r.id!)}
                              className="rounded p-1.5 text-steel hover:bg-red-500/10 hover:text-red-500 transition-colors"
                              aria-label={`Delete rate for ${r.hotel_name}`}
                              title={`Delete rate for ${r.hotel_name}`}
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                      {expandedRateId === r.id && (
                        <tr
                          className="bg-cloud/10"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <td colSpan={6} className="px-8 py-4">
                            <div className="rounded-app border border-line bg-surface p-4 shadow-sm space-y-4">
                              <div className="flex justify-between items-center border-b border-line pb-2">
                                <span className="text-xs font-bold text-navy uppercase tracking-wider">
                                  Room Rates Details
                                </span>
                                {r.billing_instruction && (
                                  <span className="text-xs text-steel italic">
                                    Instruction: {r.billing_instruction}
                                  </span>
                                )}
                              </div>
                              {r.room_rates && r.room_rates.length > 0 ? (
                                <div className="overflow-hidden border border-line rounded-app bg-surface shadow-sm">
                                  <table className="w-full text-left text-xs border-collapse">
                                    <thead>
                                      <tr className="bg-cloud text-steel font-bold border-b border-line">
                                        <th className="py-2 px-3">
                                          Room Category
                                        </th>
                                        <th className="py-2 px-3">Basis</th>
                                        <th className="py-2 px-3 text-center">
                                          SGL
                                        </th>
                                        <th className="py-2 px-3 text-center">
                                          DBL
                                        </th>
                                        <th className="py-2 px-3 text-center">
                                          TWN
                                        </th>
                                        <th className="py-2 px-3 text-center">
                                          TPL
                                        </th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-line">
                                      {r.room_rates.map((rate, rateIdx) => (
                                        <tr
                                          key={rateIdx}
                                          className="hover:bg-cloud/20"
                                        >
                                          <td className="py-2 px-3 font-semibold text-navy">
                                            {rate.room_category}
                                          </td>
                                          <td className="py-2 px-3">
                                            <span className="rounded bg-cloud px-1.5 py-0.5 font-bold">
                                              {rate.basis}
                                            </span>
                                          </td>
                                          <td className="py-2 px-3 text-center font-mono">
                                            {rate.sgl != null ? rate.sgl : "—"}
                                          </td>
                                          <td className="py-2 px-3 text-center font-mono">
                                            {rate.dbl != null ? rate.dbl : "—"}
                                          </td>
                                          <td className="py-2 px-3 text-center font-mono">
                                            {rate.twn != null ? rate.twn : "—"}
                                          </td>
                                          <td className="py-2 px-3 text-center font-mono">
                                            {rate.tpl != null ? rate.tpl : "—"}
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              ) : (
                                <p className="text-xs text-steel italic">
                                  No individual room rates found for this
                                  contract.
                                </p>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Show Archived Toggle */}
          <div className="flex items-center">
            <button
              type="button"
              onClick={() => {
                const next = !showArchived;
                setShowArchived(next);
                if (next) loadArchivedRates();
              }}
              className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-app border transition-all ${
                showArchived
                  ? "border-amber-400/20 bg-amber-400/5 text-amber-500"
                  : "border-line bg-surface text-steel hover:text-navy hover:bg-cloud shadow-sm"
              }`}
            >
              <Archive size={14} />
              {showArchived ? "Hide Archived Rates" : "Show Archived Rates"}
            </button>
          </div>

          {/* Archived Rates */}
          {showArchived && (
            <div className="overflow-hidden border border-amber-400/15 rounded-app bg-amber-50/30 shadow-sm animate-fade-in">
              <div className="px-4 py-2.5 bg-amber-400/5 border-b border-amber-400/15">
                <h4 className="text-xs font-bold uppercase tracking-wider text-amber-600/80 flex items-center gap-1.5">
                  <Archive size={14} /> Archived Rates (Inactive)
                </h4>
              </div>
              <table className="w-full text-left text-sm">
                <thead className="bg-amber-400/5 text-xs font-bold uppercase tracking-wide text-amber-600/60 border-b border-amber-400/10">
                  <tr>
                    <th className="px-4 py-2">Hotel Name</th>
                    <th className="px-4 py-2">Market</th>
                    <th className="px-4 py-2">Contract</th>
                    <th className="px-4 py-2">Valid Period</th>
                    <th className="px-4 py-2">Currency</th>
                    <th className="px-4 py-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-amber-400/8">
                  {loadingArchived ? (
                    <tr>
                      <td
                        colSpan={6}
                        className="px-4 py-6 text-center text-steel italic"
                      >
                        Loading archived rates...
                      </td>
                    </tr>
                  ) : filteredArchived.length === 0 ? (
                    <tr>
                      <td
                        colSpan={6}
                        className="px-4 py-6 text-center text-steel italic"
                      >
                        No archived rates.
                      </td>
                    </tr>
                  ) : (
                    filteredArchived.map((r) => (
                      <tr
                        key={r.id}
                        className={`reference-row-transition hover:bg-amber-400/5 ${
                          restoringIds.includes(r.id!)
                            ? "reference-row-restore-exit"
                            : ""
                        }`}
                      >
                        <td className="px-4 py-3 font-semibold text-steel/60">
                          {r.hotel_name}
                        </td>
                        <td className="px-4 py-3 text-steel/60">
                          {r.market || "-"}
                        </td>
                        <td className="px-4 py-3 text-steel/60">
                          {r.contract_name || "-"}
                        </td>
                        <td className="px-4 py-3 text-steel/60">
                          {r.valid_from} to {r.valid_to}
                        </td>
                        <td className="px-4 py-3 text-steel/60">
                          {r.currency || "USD"}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            type="button"
                            onClick={() => handleRestore(r.id!)}
                            className="text-amber-500 hover:text-green-500 rounded p-1 hover:bg-green-500/8 transition-colors flex items-center gap-1 ml-auto text-xs font-semibold"
                          >
                            <RotateCw size={14} /> Restore
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy/40 backdrop-blur-sm p-4 animate-fade-in">
          <div className="w-full max-w-md bg-surface rounded-app border border-line p-6 shadow-xl">
            <div className="mb-4 flex items-center gap-3 text-red-500">
              <AlertTriangle size={24} />
              <h2 className="text-lg font-bold">Deactivate Rate Contract</h2>
            </div>
            <p className="mb-6 text-sm text-steel leading-relaxed">
              Are you sure you want to delete this hotel rate? This will
              deactivate it, removing it from active contract matching while
              preserving historical voucher references.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDeleteId(null)}
                className="app-button-secondary px-4 py-2 text-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                className="app-button-primary bg-red-500 hover:bg-red-600 border-transparent text-white px-4 py-2 text-sm"
              >
                Deactivate Rate
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
