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
} from "lucide-react";
import type {
  VoucherDocumentRecord,
  VoucherRevisionRecord,
} from "../../electron/shared/types";

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
            <p className="text-[10px] text-emerald-600/80 font-normal">
              Initial voucher metadata initialized
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 text-blue-700 bg-blue-50/50 p-2 rounded-lg border border-blue-100">
          <Save size={16} className="shrink-0" />
          <div>
            <p className="font-bold">Save Draft & Revisions</p>
            <p className="text-[10px] text-blue-600/80 font-normal">
              Audited checkpoints & revision tracking active
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 text-cyan-700 bg-cyan-50/50 p-2 rounded-lg border border-cyan-100">
          <Mail size={16} className="shrink-0" />
          <div>
            <p className="font-bold">Email & Document Dispatch</p>
            <p className="text-[10px] text-cyan-600/80 font-normal">
              Final voucher DOCX/PDF generation ready
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

export function RevisionHistoryPanel({
  voucherRevisions,
}: RevisionHistoryPanelProps) {
  return (
    <div className="space-y-2 w-full h-full flex flex-col min-h-0">
      {voucherRevisions.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center border border-dashed border-line rounded-lg">
          <Clock size={20} className="text-steel mb-1 opacity-60" />
          <p className="text-xs text-steel font-medium">
            Save or open a voucher to see version snapshots.
          </p>
        </div>
      ) : (
        <div className="space-y-2 overflow-y-auto pr-1 flex-1 min-h-0">
          {voucherRevisions.map((revision) => {
            const tags = revision.snapshotSummary
              ? revision.snapshotSummary
                  .split(/[•.,;|\n]+/)
                  .map((t) => t.trim())
                  .filter((t) => t.length > 0)
              : [];

            return (
              <div
                key={revision.id}
                className="border border-line hover:border-steel bg-cloud/10 hover:bg-cloud/30 p-2.5 rounded-lg transition-all duration-150"
              >
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-extrabold text-navy px-1.5 py-0.5 bg-navy/5 border border-navy/10 rounded">
                      v{revision.versionNumber}
                    </span>
                    <span
                      className={`text-[10px] font-extrabold uppercase tracking-wider px-1.5 py-0.5 rounded-full border ${
                        revision.status?.toLowerCase() === "approved"
                          ? "bg-emerald-50 text-emerald-700 border-emerald-100"
                          : revision.status?.toLowerCase() === "amended"
                            ? "bg-amber-50 text-amber-700 border-amber-100"
                            : "bg-blue-50 text-blue-700 border-blue-100"
                      }`}
                    >
                      {revision.status || "Draft"}
                    </span>
                  </div>
                  <span className="text-xs text-steel font-semibold whitespace-nowrap">
                    {new Date(revision.createdAt).toLocaleDateString(
                      undefined,
                      {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      },
                    )}
                  </span>
                </div>

                {revision.changedBy && (
                  <div className="flex items-center gap-1 text-xs text-steel font-bold mb-1.5 pb-1 border-b border-line/30">
                    <User size={11} className="text-steel/60" />
                    <span className="truncate" title={revision.changedBy}>
                      {revision.changedBy}
                    </span>
                  </div>
                )}

                {tags.length > 0 ? (
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {tags.map((tag, idx) => (
                      <span
                        key={idx}
                        className="text-[10px] font-bold bg-surface text-steel border border-line px-1.5 py-0.5 rounded shadow-2xs hover:border-steel/80 transition-colors"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-steel/60 italic font-medium">
                    No details recorded.
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function DocumentHistoryPanel({
  documentHistory,
  onOpenDocument,
}: DocumentHistoryPanelProps) {
  return (
    <div className="space-y-2 w-full h-full flex flex-col min-h-0">
      {documentHistory.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center border border-dashed border-line rounded-lg">
          <FileText size={20} className="text-steel mb-1 opacity-60" />
          <p className="text-xs text-steel font-medium">
            Generate a voucher document to view history records.
          </p>
        </div>
      ) : (
        <div className="space-y-2 overflow-y-auto pr-1 flex-1 min-h-0">
          {documentHistory.slice(0, 20).map((doc) => (
            <div
              key={doc.id}
              className="border border-line bg-cloud/10 hover:border-steel p-2.5 rounded-lg transition-all duration-150 flex flex-col gap-1.5"
            >
              <div className="flex items-center justify-between gap-2">
                <p
                  className="text-xs font-bold text-navy truncate flex-1"
                  title={`${doc.requisitionNo} / ${doc.tourNo}`}
                >
                  {doc.requisitionNo && doc.tourNo
                    ? `${doc.requisitionNo} · ${doc.tourNo}`
                    : doc.requisitionNo || doc.tourNo || "No Req / Tour #"}
                </p>
                <span
                  className="text-[10px] text-steel font-bold whitespace-nowrap"
                  title={new Date(doc.createdAt).toLocaleString()}
                >
                  {new Date(doc.createdAt).toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>

              <div className="text-xs text-steel font-medium space-y-1 border-t border-line/30 pt-1.5">
                {doc.tourName && (
                  <div
                    className="flex items-center gap-1.5 text-navy font-semibold text-[11px]"
                    title={doc.tourName}
                  >
                    <span className="text-[8px] font-extrabold uppercase px-1 py-0.2 bg-navy/5 text-navy rounded border border-navy/10 shrink-0">
                      Tour
                    </span>
                    <span className="truncate">{doc.tourName}</span>
                  </div>
                )}
                {doc.hotelName && (
                  <div className="flex items-center gap-1 text-steel">
                    <Building2 size={11} className="text-steel/70 shrink-0" />
                    <span className="truncate" title={doc.hotelName}>
                      {doc.hotelName}
                    </span>
                  </div>
                )}
                {doc.customerName && (
                  <div className="flex items-center gap-1 text-steel">
                    <User size={11} className="text-steel/70 shrink-0" />
                    <span className="truncate" title={doc.customerName}>
                      {doc.customerName}
                    </span>
                  </div>
                )}
                {doc.voucherDate && (
                  <div className="flex items-center gap-1 text-steel">
                    <Calendar size={11} className="text-steel/70 shrink-0" />
                    <span>
                      Travel:{" "}
                      {new Date(doc.voucherDate).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </span>
                  </div>
                )}
              </div>

              <div className="flex gap-1 mt-1.5 pt-1.5 border-t border-line/20">
                <button
                  type="button"
                  onClick={() => onOpenDocument(doc.docxPath)}
                  className="flex-1 flex items-center justify-center gap-1 bg-white hover:bg-blue-50/50 border border-line text-[10px] font-bold text-blue-700 py-1 px-1.5 rounded transition-colors"
                  title="Open Microsoft Word File"
                >
                  <FileText size={10} /> Word
                </button>
                {doc.pdfPath && (
                  <button
                    type="button"
                    onClick={() => onOpenDocument(doc.pdfPath!)}
                    className="flex-1 flex items-center justify-center gap-1 bg-white hover:bg-red-50/50 border border-line text-[10px] font-bold text-red-700 py-1 px-1.5 rounded transition-colors"
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
    </div>
  );
}
