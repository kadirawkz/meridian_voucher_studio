import React, { useState, useEffect } from "react";
import { 
  FileText, 
  ChevronDown, 
  ChevronRight, 
  Folder, 
  Search, 
  X, 
  ExternalLink,
  Layers,
  Terminal,
  RefreshCw
} from "lucide-react";
import type { WorkspaceSearchResult, VoucherRecord } from "../../electron/shared/types";

interface SearchOverlayProps {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  isSearching: boolean;
  searchResults: WorkspaceSearchResult;
  openVoucherFromSearch: (voucher: VoucherRecord) => void;
}

// Subcomponent to highlight matching query text in the results
function HighlightText({ text, query }: { text: string; query: string }) {
  if (!query || !text) return <span>{text}</span>;
  const escapedQuery = query.replace(/[|\\{}()[\]^$+*?.-]/g, "\\$&");
  const parts = text.split(new RegExp(`(${escapedQuery})`, "gi"));
  return (
    <span>
      {parts.map((part, i) => 
        part.toLowerCase() === query.toLowerCase() ? (
          <mark key={i} className="bg-amber-100 text-amber-950 rounded-[2px] px-0.5 font-bold">
            {part}
          </mark>
        ) : (
          part
        )
      )}
    </span>
  );
}

export function SearchOverlay({
  searchQuery,
  setSearchQuery,
  isSearching,
  searchResults,
  openVoucherFromSearch,
}: SearchOverlayProps) {
  const [vouchersExpanded, setVouchersExpanded] = useState(true);
  const [documentsExpanded, setDocumentsExpanded] = useState(true);

  // Listen for Escape key to close the search overlay
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setSearchQuery("");
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [setSearchQuery]);

  if (!searchQuery) return null;

  const totalResults = searchResults.vouchers.length + searchResults.documents.length;

  return (
    <div 
      className="fixed inset-0 z-50 bg-navy/20 backdrop-blur-[2px] flex items-center justify-center p-4" 
      onClick={() => setSearchQuery("")}
    >
      <div
        className="w-full max-w-3xl bg-surface border border-line text-ink shadow-2xl rounded-xl overflow-hidden flex flex-col max-h-[85vh] text-xs select-none"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Bar aligned with App Theme */}
        <div className="bg-cloud/55 px-4 py-3 flex items-center justify-between border-b border-line">
          <div className="flex items-center gap-2">
            <Terminal size={14} className="text-navy" />
            <span className="font-bold text-navy tracking-tight uppercase">Workspace Search Index</span>
          </div>
          <button 
            onClick={() => setSearchQuery("")}
            className="text-steel hover:text-navy hover:bg-cloud transition-colors p-1 rounded-full"
            title="Close Search Overlay"
          >
            <X size={15} />
          </button>
        </div>

        {/* Input Bar Summary */}
        <div className="bg-surface px-4 py-2.5 border-b border-line/70 flex items-center justify-between text-[11px] text-steel font-medium">
          <div className="flex items-center gap-2">
            <Search size={12} className="text-steel" />
            <span>Search Term: &quot;<span className="text-navy font-bold">{searchQuery}</span>&quot;</span>
          </div>
          <div className="font-semibold text-navy">
            {totalResults} {totalResults === 1 ? "match" : "matches"} found
          </div>
        </div>

        {/* Search Results Tree Container - Light High Density style */}
        <div className="flex-1 overflow-y-auto p-4 bg-surface space-y-4 min-h-[250px]">
          {isSearching ? (
            <div className="flex flex-col items-center justify-center gap-3 py-16 text-steel">
              <RefreshCw className="animate-spin text-navy" size={24} />
              <span className="font-medium text-xs">Scanning database index records...</span>
            </div>
          ) : totalResults === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-steel gap-2.5">
              <Search size={26} className="text-slate-300" />
              <span className="font-medium">No results found in workspace matching your criteria.</span>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Vouchers Folder Category */}
              {searchResults.vouchers.length > 0 && (
                <div className="space-y-1">
                  <div 
                    onClick={() => setVouchersExpanded(!vouchersExpanded)}
                    className="flex items-center gap-1.5 py-1.5 px-2 hover:bg-cloud/60 rounded-app cursor-pointer text-navy font-bold group transition-all"
                  >
                    <span className="text-steel">
                      {vouchersExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    </span>
                    <Folder size={14} className="text-navy fill-cloud" />
                    <span>vouchers</span>
                    <span className="ml-auto text-[10px] bg-cloud border border-line text-navy px-2 py-0.5 rounded-full font-bold">
                      {searchResults.vouchers.length}
                    </span>
                  </div>

                  {vouchersExpanded && (
                    <div className="pl-4 border-l border-line ml-3.5 space-y-1 mt-1">
                      {searchResults.vouchers.map((voucher) => (
                        <div
                          key={voucher.id}
                          onClick={() => {
                            openVoucherFromSearch(voucher);
                            setSearchQuery("");
                          }}
                          className="flex items-center justify-between py-2 px-2.5 hover:bg-blue-50/50 rounded-app cursor-pointer group text-slate-700 border border-transparent hover:border-blue-100/50 transition-all"
                        >
                          <div className="flex items-center gap-2 overflow-hidden mr-4">
                            <Layers size={13} className="text-indigo-500 shrink-0" />
                            <div className="truncate">
                              <span className="font-bold text-navy mr-2 text-xs">
                                <HighlightText text={voucher.requisitionNo || voucher.tourNo || "No Ref"} query={searchQuery} />
                              </span>
                              <span className="text-[11px] text-steel font-medium">
                                <HighlightText text={voucher.hotelName} query={searchQuery} />
                                {" · "}
                                <HighlightText text={voucher.customerName} query={searchQuery} />
                              </span>
                            </div>
                          </div>
                          <span className="text-[9px] uppercase px-2 py-0.5 rounded-full border border-line bg-cloud text-navy font-bold group-hover:bg-cloud/70 transition-all">
                            {voucher.status}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Documents Folder Category */}
              {searchResults.documents.length > 0 && (
                <div className="space-y-1">
                  <div 
                    onClick={() => setDocumentsExpanded(!documentsExpanded)}
                    className="flex items-center gap-1.5 py-1.5 px-2 hover:bg-cloud/60 rounded-app cursor-pointer text-navy font-bold group transition-all"
                  >
                    <span className="text-steel">
                      {documentsExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    </span>
                    <Folder size={14} className="text-blue-600 fill-blue-50" />
                    <span>documents</span>
                    <span className="ml-auto text-[10px] bg-blue-50 border border-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-bold">
                      {searchResults.documents.length}
                    </span>
                  </div>

                  {documentsExpanded && (
                    <div className="pl-4 border-l border-line ml-3.5 space-y-1 mt-1">
                      {searchResults.documents.map((doc) => (
                        <div
                          key={doc.id}
                          onClick={() => {
                            void window.meridian.openDocument(doc.docxPath);
                            setSearchQuery("");
                          }}
                          className="flex items-center justify-between py-2 px-2.5 hover:bg-blue-50/50 rounded-app cursor-pointer group text-slate-700 border border-transparent hover:border-blue-100/50 transition-all"
                        >
                          <div className="flex items-center gap-2 overflow-hidden mr-4">
                            <FileText size={13} className="text-blue-500 shrink-0" />
                            <div className="truncate">
                              <span className="font-bold text-navy mr-2 text-xs">
                                <HighlightText text={doc.requisitionNo || doc.tourNo || "No Ref"} query={searchQuery} />
                              </span>
                              <span className="text-[11px] text-steel font-medium">
                                <HighlightText text={doc.hotelName} query={searchQuery} />
                                {" · "}
                                <span className="uppercase text-amber-600 font-bold bg-amber-50 px-1.5 py-0.2 border border-amber-100 rounded text-[9px]">{doc.format}</span>
                              </span>
                            </div>
                          </div>
                          <ExternalLink size={12} className="text-steel opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* App Themed Status Bar */}
        <div className="bg-gradient-to-r from-navy to-slate-800 text-white px-4 py-2.5 flex items-center justify-between text-[10px] font-bold tracking-wide">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-300 animate-ping" />
              <span>Live Index Active</span>
            </span>
          </div>
          <div className="flex items-center gap-3 opacity-95">
            <span>ESC to Close</span>
            <span>·</span>
            <span>Click Items to Preview</span>
          </div>
        </div>
      </div>
    </div>
  );
}
