import React from "react";

interface ReportIssueModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ReportIssueModal({ isOpen, onClose }: ReportIssueModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/50 p-6 animate-in fade-in duration-200">
      <div className="app-panel w-full max-w-md p-8 shadow-2xl animate-in zoom-in-95 duration-200">
        <div className="mb-6 flex flex-col items-center text-center">
          <h3 className="text-xl font-bold text-navy">Report an Issue</h3>
          <p className="mt-2 text-sm text-steel">
            We're sorry you're experiencing trouble. Please describe the issue
            or visit our support page.
          </p>
        </div>

        <div className="space-y-4">
          <div className="rounded-xl border border-line bg-cloud p-4 text-xs font-medium text-steel">
            System Version: v0.1.0 (Stable)
            <br />
            Environment: Production Branch
          </div>

          <button
            onClick={() =>
              window.open(
                "https://github.com/kadirawkz/meridian_voucher_studio/issues",
                "_blank",
              )
            }
            className="app-button-primary w-full"
          >
            Open GitHub Issues
          </button>

          <button onClick={onClose} className="app-button-ghost w-full">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
