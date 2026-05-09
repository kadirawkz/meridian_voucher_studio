import { CheckCircle2, Mail, Save } from "lucide-react";
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
    <section className="app-panel app-panel-body">
      <h3 className="mb-4 app-eyebrow">Lifecycle</h3>
      <div className="space-y-4 text-sm">
        <div className="flex gap-3 text-navy"><CheckCircle2 size={18} /> Draft Creation</div>
        <div className="flex gap-3 text-steel"><Save size={18} /> Save Draft</div>
        <div className="flex gap-3 text-steel"><Mail size={18} /> Email Sent</div>
      </div>
    </section>
  );
}

export function RevisionHistoryPanel({ voucherRevisions }: RevisionHistoryPanelProps) {
  return (
    <section className="app-panel app-panel-body">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="app-eyebrow">Revision History</h3>
        <p className="text-[11px] font-bold uppercase tracking-wide text-steel">
          {voucherRevisions.length > 0 ? `${voucherRevisions.length} versions` : "No history"}
        </p>
      </div>
      {voucherRevisions.length === 0 ? (
        <p className="text-sm text-steel">Save or open a voucher to see its audit trail.</p>
      ) : (
        <div className="space-y-3">
          {voucherRevisions.map((revision) => (
            <div key={revision.id} className="app-history-card">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-bold text-ink">Version {revision.versionNumber}</p>
                <p className="text-[11px] font-bold uppercase tracking-wide text-navy">{revision.status}</p>
              </div>
              <p className="mt-2 text-xs text-steel">{new Date(revision.createdAt).toLocaleString()}</p>
            </div>
          ))}
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
    <section className="app-panel app-panel-body">
      <h3 className="mb-4 app-eyebrow">Generated Files</h3>
      <button type="button" className="app-button-ghost mb-2 justify-start px-0 py-0 text-left font-semibold" onClick={() => onOpenDocument(generated.docxPath)}>
        Open DOCX
      </button>
      {generated.pdfPath && (
        <button type="button" className="app-button-ghost justify-start px-0 py-0 text-left font-semibold" onClick={() => onOpenDocument(generated.pdfPath!)}>
          Open PDF
        </button>
      )}
    </section>
  );
}

export function DocumentHistoryPanel({ documentHistory, onOpenDocument }: DocumentHistoryPanelProps) {
  return (
    <section className="app-panel app-panel-body">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="app-eyebrow">Document History</h3>
        <p className="text-[11px] font-bold uppercase tracking-wide text-steel">
          {documentHistory.length > 0 ? `${documentHistory.length} files` : "No history"}
        </p>
      </div>
      {documentHistory.length === 0 ? (
        <p className="text-sm text-steel">Generate a voucher document to track DOCX and PDF output here.</p>
      ) : (
        <div className="space-y-3">
          {documentHistory.slice(0, 5).map((documentRecord) => (
            <button
              key={documentRecord.id}
              type="button"
              className="app-history-card block w-full text-left hover:bg-blue-50"
              onClick={() => onOpenDocument(documentRecord.docxPath)}
            >
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-bold text-ink">{documentRecord.requisitionNo || documentRecord.tourNo || "Document"}</p>
                <p className="text-[11px] font-bold uppercase tracking-wide text-navy">{documentRecord.format}</p>
              </div>
              <p className="mt-2 text-xs text-steel">{documentRecord.hotelName || documentRecord.customerName || new Date(documentRecord.createdAt).toLocaleString()}</p>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
