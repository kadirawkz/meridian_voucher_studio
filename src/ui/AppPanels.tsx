import React from "react";
import { 
  CheckCircle2, 
  Mail, 
  Save, 
  Building2, 
  Calendar, 
  Clock, 
  User, 
  FileText, 
  FileDown, 
  ExternalLink 
} from "lucide-react";
import type { GeneratedDocument, VoucherDocumentRecord, VoucherRevisionRecord } from "../../electron/shared/types";

interface GeneratedFilesPanelProps {
  generated: GeneratedDocument | null;
  onOpenDocument: (filePath: string) => void;
}

interface RevisionHistoryPanelProps {
  voucherRevisions: VoucherRevisionRecord[];
}

interface DocumentHistoryPanelProps {
  documentHistory: VoucherDocumentRecord[];
  onOpenDocument: (filePath: string) => void;
}

export function LifecyclePanel() {
  return (
    <section className="app-panel app-panel-body bg-gradient-to-br from-surface to-cloud border border-line rounded-xl p-4 shadow-sm">
      <h3 className="mb-4 app-eyebrow flex items-center gap-2 text-navy text-[11px] font-bold uppercase tracking-wider">
        <Clock size={13} className="text-navy" /> Lifecycle Status
      </h3>
      <div className="space-y-4 text-xs font-medium">
        <div className="flex items-center gap-3 text-emerald-700 bg-emerald-50/50 p-2 rounded-lg border border-emerald-100">
          <CheckCircle2 size={16} className="shrink-0" />
          <div>
            <p className="font-bold">Draft Creation</p>
            <p className="text-[10px] text-emerald-600/80 font-normal">Initial voucher metadata initialized</p>
          </div>
        </div>
        <div className="flex items-center gap-3 text-blue-700 bg-blue-50/50 p-2 rounded-lg border border-blue-100">
          <Save size={16} className="shrink-0" />
          <div>
            <p className="font-bold">Save Draft & Revisions</p>
            <p className="text-[10px] text-blue-600/80 font-normal">Audited checkpoints & revision tracking active</p>
          </div>
        </div>
        <div className="flex items-center gap-3 text-purple-700 bg-purple-50/50 p-2 rounded-lg border border-purple-100">
          <Mail size={16} className="shrink-0" />
          <div>
            <p className="font-bold">Email & Document Dispatch</p>
            <p className="text-[10px] text-purple-600/80 font-normal">Final voucher DOCX/PDF generation ready</p>
          </div>
        </div>
      </div>
    </section>
  );
}

export function RevisionHistoryPanel({ voucherRevisions }: RevisionHistoryPanelProps) {
  return (
    <section className="app-panel app-panel-body bg-surface border border-line rounded-xl p-4 shadow-sm flex flex-col h-full min-h-0">
      <div className="mb-3 flex items-center justify-between shrink-0">
        <h3 className="app-eyebrow flex items-center gap-2 text-navy text-[11px] font-bold uppercase tracking-wider">
          <Clock size={13} className="text-navy" /> Revision History
        </h3>
        <span className="text-[10px] font-bold px-2 py-0.5 bg-navy/10 text-navy rounded-full">
          {voucherRevisions.length > 0 ? `${voucherRevisions.length} versions` : "No history"}
        </span>
      </div>
      
      {voucherRevisions.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center border border-dashed border-line rounded-lg">
          <Clock size={24} className="text-steel mb-2 opacity-60" />
          <p className="text-xs text-steel font-medium">Save or open a voucher to see its automated audit trail.</p>
        </div>
      ) : (
        <div className="space-y-2.5 overflow-y-auto pr-1 flex-1 min-h-0 max-h-[350px]">
          {voucherRevisions.map((revision) => {
            // Split snapshot summary into clean tags
            const tags = revision.snapshotSummary
              ? revision.snapshotSummary
                  .split(/[•.,;|\n]+/)
                  .map((t) => t.trim())
                  .filter((t) => t.length > 0)
              : [];

            return (
              <div 
                key={revision.id} 
                className="group border border-line hover:border-steel bg-cloud/30 hover:bg-cloud/60 p-3 rounded-lg transition-all duration-150 shadow-xs"
              >
                <div className="flex items-center justify-between gap-3 mb-2">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-extrabold text-navy px-1.5 py-0.5 bg-navy/5 border border-navy/10 rounded">
                      v{revision.versionNumber}
                    </span>
                    <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                      revision.status?.toLowerCase() === "approved" 
                        ? "bg-emerald-50 text-emerald-700 border-emerald-200" 
                        : revision.status?.toLowerCase() === "amended"
                        ? "bg-amber-50 text-amber-700 border-amber-200"
                        : "bg-blue-50 text-blue-700 border-blue-200"
                    }`}>
                      {revision.status || "Draft"}
                    </span>
                  </div>
                  <span className="text-[9px] text-steel font-semibold whitespace-nowrap">
                    {new Date(revision.createdAt).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit"
                    })}
                  </span>
                </div>

                <div className="flex items-center gap-3 text-[10px] text-steel font-medium mb-2 border-b border-line/50 pb-1.5">
                  {revision.changedBy && (
                    <span className="flex items-center gap-1 text-navy font-semibold truncate max-w-[150px]" title={revision.changedBy}>
                      <User size={11} className="text-steel" />
                      {revision.changedBy}
                    </span>
                  )}
                  <span className="flex items-center gap-1 text-steel/80 ml-auto whitespace-nowrap">
                    <Clock size={11} />
                    {new Date(revision.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>

                {tags.length > 0 ? (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {tags.map((tag, idx) => (
                      <span 
                        key={idx} 
                        className="text-[9px] font-bold bg-white text-steel border border-line px-2 py-0.5 rounded shadow-2xs hover:border-steel/80 transition-colors"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-[10px] text-steel/60 italic font-medium">No descriptive modifications recorded.</p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

export function GeneratedFilesPanel({ generated, onOpenDocument }: GeneratedFilesPanelProps) {
  if (!generated) {
    return null;
  }

  return (
    <section className="app-panel app-panel-body bg-gradient-to-br from-surface to-cloud border border-line rounded-xl p-4 shadow-sm shrink-0">
      <h3 className="mb-3 app-eyebrow flex items-center gap-2 text-navy text-[11px] font-bold uppercase tracking-wider">
        <FileText size={13} className="text-navy" /> Active Generated Files
      </h3>
      <div className="grid grid-cols-2 gap-2">
        <button 
          type="button" 
          className="flex items-center justify-center gap-2 bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-700 font-bold py-2 px-3 rounded-lg text-xs transition-colors shadow-xs" 
          onClick={() => onOpenDocument(generated.docxPath)}
        >
          <FileText size={14} /> Open DOCX
        </button>
        {generated.pdfPath && (
          <button 
            type="button" 
            className="flex items-center justify-center gap-2 bg-red-50 hover:bg-red-100 border border-red-200 text-red-700 font-bold py-2 px-3 rounded-lg text-xs transition-colors shadow-xs" 
            onClick={() => onOpenDocument(generated.pdfPath!)}
          >
            <FileDown size={14} /> Open PDF
          </button>
        )}
      </div>
    </section>
  );
}

export function DocumentHistoryPanel({ documentHistory, onOpenDocument }: DocumentHistoryPanelProps) {
  return (
    <section className="app-panel app-panel-body bg-surface border border-line rounded-xl p-4 shadow-sm flex flex-col h-full min-h-0">
      <div className="mb-3 flex items-center justify-between shrink-0">
        <h3 className="app-eyebrow flex items-center gap-2 text-navy text-[11px] font-bold uppercase tracking-wider">
          <FileText size={13} className="text-navy" /> Document History
        </h3>
        <span className="text-[10px] font-bold px-2 py-0.5 bg-navy/10 text-navy rounded-full">
          {documentHistory.length > 0 ? `${documentHistory.length} files` : "No history"}
        </span>
      </div>

      {documentHistory.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center border border-dashed border-line rounded-lg">
          <FileText size={24} className="text-steel mb-2 opacity-60" />
          <p className="text-xs text-steel font-medium">Generate a voucher document to view historical DOCX/PDF records here.</p>
        </div>
      ) : (
        <div className="space-y-2.5 overflow-y-auto pr-1 flex-1 min-h-0 max-h-[350px]">
          {documentHistory.slice(0, 15).map((doc) => (
            <div 
              key={doc.id} 
              className="border border-line bg-cloud/20 p-3 rounded-lg shadow-2xs hover:border-steel transition-all duration-150"
            >
              <div className="flex items-center justify-between gap-3 mb-1.5">
                <p className="text-xs font-bold text-navy truncate flex-1" title={doc.requisitionNo || doc.tourNo || "Document"}>
                  {doc.requisitionNo || doc.tourNo || "No Req / Tour #"}
                </p>
                <span className="text-[9px] text-steel font-semibold shrink-0">
                  {new Date(doc.createdAt).toLocaleDateString()}
                </span>
              </div>

              <div className="space-y-1 text-[10px] text-steel font-medium mb-3 border-t border-line/40 pt-1.5">
                {doc.hotelName && (
                  <div className="flex items-center gap-1.5 text-steel">
                    <Building2 size={11} className="text-steel/70 shrink-0" />
                    <span className="truncate" title={doc.hotelName}>{doc.hotelName}</span>
                  </div>
                )}
                {doc.customerName && (
                  <div className="flex items-center gap-1.5 text-steel">
                    <User size={11} className="text-steel/70 shrink-0" />
                    <span className="truncate" title={doc.customerName}>{doc.customerName}</span>
                  </div>
                )}
              </div>

              {/* Direct launcher action buttons inside the card */}
              <div className="flex gap-1.5 mt-2 pt-2 border-t border-line/30">
                <button
                  type="button"
                  onClick={() => onOpenDocument(doc.docxPath)}
                  className="flex-1 flex items-center justify-center gap-1 bg-white hover:bg-blue-50/50 border border-line text-[10px] font-bold text-blue-700 py-1 px-2 rounded transition-colors"
                  title="Open Microsoft Word File"
                >
                  <FileText size={10} /> Word
                </button>
                {doc.pdfPath && (
                  <button
                    type="button"
                    onClick={() => onOpenDocument(doc.pdfPath!)}
                    className="flex-1 flex items-center justify-center gap-1 bg-white hover:bg-red-50/50 border border-line text-[10px] font-bold text-red-700 py-1 px-2 rounded transition-colors"
                    title="Open Adobe PDF File"
                  >
                    <FileDown size={10} /> PDF
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
