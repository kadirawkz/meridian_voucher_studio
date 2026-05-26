import React from "react";
import { FileText } from "lucide-react";
import type { WorkspaceSearchResult, VoucherRecord } from "../../electron/shared/types";

interface SearchOverlayProps {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  isSearching: boolean;
  searchResults: WorkspaceSearchResult;
  openVoucherFromSearch: (voucher: VoucherRecord) => void;
}

export function SearchOverlay({
  searchQuery,
  setSearchQuery,
  isSearching,
  searchResults,
  openVoucherFromSearch,
}: SearchOverlayProps) {
  if (!searchQuery) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/50" onClick={() => setSearchQuery("")}>
      <div
        className="app-panel absolute left-1/2 top-1/2 w-full max-w-2xl -translate-x-1/2 -translate-y-1/2 p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="mb-4 text-lg font-bold text-navy">Search Results</h3>
        {isSearching ? (
          <p className="text-center text-steel">Searching...</p>
        ) : searchResults.vouchers.length === 0 && searchResults.documents.length === 0 ? (
          <p className="text-center text-steel">No results found.</p>
        ) : (
          <div className="space-y-6">
            {searchResults.vouchers.length > 0 && (
              <div>
                <h4 className="mb-3 text-sm font-bold uppercase text-steel">Vouchers</h4>
                <div className="space-y-2">
                  {searchResults.vouchers.map((voucher) => (
                    <button
                      key={voucher.id}
                      type="button"
                      onClick={() => {
                        openVoucherFromSearch(voucher);
                        setSearchQuery("");
                      }}
                      className="app-history-card flex w-full items-center justify-between px-4 py-3 text-left hover:bg-blue-50"
                    >
                      <div>
                        <p className="font-bold text-navy">{voucher.requisitionNo || voucher.tourNo}</p>
                        <p className="text-xs text-steel">
                          {voucher.hotelName} · {voucher.customerName}
                        </p>
                      </div>
                      <p className="text-xs font-bold uppercase text-steel">{voucher.status}</p>
                    </button>
                  ))}
                </div>
              </div>
            )}
            {searchResults.documents.length > 0 && (
              <div>
                <h4 className="mb-3 text-sm font-bold uppercase text-steel">Documents</h4>
                <div className="space-y-2">
                  {searchResults.documents.map((doc) => (
                    <button
                      key={doc.id}
                      type="button"
                      onClick={() => window.meridian.openDocument(doc.docxPath)}
                      className="app-history-card flex w-full items-center justify-between px-4 py-3 text-left hover:bg-blue-50"
                    >
                      <div>
                        <p className="font-bold text-navy">{doc.requisitionNo || doc.tourNo}</p>
                        <p className="text-xs text-steel">
                          {doc.hotelName} · {doc.format.toUpperCase()}
                        </p>
                      </div>
                      <FileText size={16} className="text-steel" />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
