import { useState, useEffect } from "react";
import { Edit2, Trash2, ChevronLeft, AlertTriangle } from "lucide-react";
import type { HotelRateRecord } from "../../electron/shared/types";
import { friendlyErrorMessage } from "./errors";

type Props = {
  onBack: () => void;
  onEdit: (hotelRateId: string) => void;
};

export function ManageRatesScreen({ onBack, onEdit }: Props) {
  const [rates, setRates] = useState<HotelRateRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  const loadRates = async () => {
    try {
      setLoading(true);
      if (!window.meridian?.getAllHotelRates) throw new Error("API not available");
      const data = await window.meridian.getAllHotelRates();
      setRates(data);
    } catch (err) {
      setError(friendlyErrorMessage(err, "Failed to load rates"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRates();
  }, []);

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await window.meridian?.deleteHotelRate(deleteId);
      setDeleteId(null);
      loadRates();
    } catch (err) {
      window.alert(friendlyErrorMessage(err, "Failed to delete rate"));
    }
  };

  const filteredRates = rates.filter((r) => 
    r.hotel_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.market?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.contract_name?.toLowerCase().includes(searchTerm.toLowerCase())
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
          <h1 className="text-lg font-black tracking-tight text-navy">Manage Existing Rates</h1>
          <p className="text-xs font-semibold text-steel">View, update, or delete hotel rate master entries</p>
        </div>
        <div className="ml-auto">
          <input 
            type="text" 
            placeholder="Search hotel or market..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="app-table-control w-64 rounded bg-cloud px-3 py-1.5 text-sm"
          />
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-6">
        {error && (
          <div className="mb-4 rounded border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-500">
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex h-32 items-center justify-center text-steel">Loading rates...</div>
        ) : (
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
                {filteredRates.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-steel">No rates found.</td>
                  </tr>
                ) : (
                  filteredRates.map((r) => (
                    <tr key={r.id} className="hover:bg-sand/30">
                      <td className="px-4 py-3 font-semibold text-navy">{r.hotel_name}</td>
                      <td className="px-4 py-3">{r.market || "-"}</td>
                      <td className="px-4 py-3">{r.contract_name || "-"}</td>
                      <td className="px-4 py-3">{r.valid_from} to {r.valid_to}</td>
                      <td className="px-4 py-3">{r.currency || "USD"}</td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end gap-2">
                          <button onClick={() => onEdit(r.id!)} className="rounded p-1.5 text-steel hover:bg-cloud hover:text-navy transition-colors" aria-label={`Edit rate for ${r.hotel_name}`} title={`Edit rate for ${r.hotel_name}`}>
                            <Edit2 size={16} />
                          </button>
                          <button onClick={() => setDeleteId(r.id!)} className="rounded p-1.5 text-steel hover:bg-red-500/10 hover:text-red-500 transition-colors" aria-label={`Delete rate for ${r.hotel_name}`} title={`Delete rate for ${r.hotel_name}`}>
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy/50 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-xl bg-surface p-6 shadow-xl">
            <div className="mb-4 flex items-center gap-3 text-red-600">
              <AlertTriangle size={24} />
              <h2 className="text-lg font-bold">Delete Rate Master Entry</h2>
            </div>
            <p className="mb-6 text-sm text-steel">
              Are you sure you want to delete this hotel rate? This action cannot be undone and may affect vouchers currently using this rate.
            </p>
            <div className="flex justify-end gap-3">
              <button 
                onClick={() => setDeleteId(null)}
                className="rounded-app border border-line bg-surface px-4 py-2 text-sm font-bold text-navy hover:bg-cloud transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={handleDelete}
                className="rounded-app bg-red-600 px-4 py-2 text-sm font-bold text-white hover:bg-red-700 transition-colors"
              >
                Delete Rate
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
