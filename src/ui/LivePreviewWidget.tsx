import React from "react";
import { FileText, Minus, Maximize2, RefreshCw } from "lucide-react";
import type { VoucherFormValues } from "../domain/voucherSchema";

interface LivePreviewWidgetProps {
  previewMode: "collapsed" | "thumbnail" | "expanded";
  setPreviewMode: React.Dispatch<
    React.SetStateAction<"collapsed" | "thumbnail" | "expanded">
  >;
  previewPos: { x: number; y: number };
  windowSize: { width: number; height: number };
  isDraggingPreview: boolean;
  startDragPreview: (e: React.MouseEvent) => void;
  // Watched fields
  date: string;
  voucherType: VoucherFormValues["voucherType"];
  hotelName: string;
  requisitionNo: string;
  tourNo: string;
  tourName: string;
  customerName: string;
  lineItems: VoucherFormValues["lineItems"];
  confirmedBy: string;
  rateApplicableText: string;
  remarks: string;
  billingInstructions: string;
  employeeName: string;
  employeeEmail: string;

  // New template fields
  tourType?: string;
  market?: string;
  ratePeriod?: string;
  voucherTitle?: string;
  rateStructure?: "detailed" | "grouped";
  manuallyEdited?: boolean;
  guideText?: string;
  surchargeText?: string;
  eventSupplementText?: string;
  totalPax?: number;
}

export function LivePreviewWidget({
  previewMode,
  setPreviewMode,
  previewPos,
  windowSize,
  isDraggingPreview,
  startDragPreview,
  date,
  voucherType,
  hotelName,
  requisitionNo,
  tourNo,
  tourName,
  customerName,
  lineItems,
  confirmedBy,
  rateApplicableText,
  remarks,
  billingInstructions,
  employeeName,
  employeeEmail,

  // New fields
  tourType = "",
  market = "",
  ratePeriod = "",
  voucherTitle = "",
  rateStructure = "detailed",
  manuallyEdited = false,
  guideText = "",
  surchargeText = "",
  eventSupplementText = "",
  totalPax = 0,
}: LivePreviewWidgetProps) {
  const baseWidth = 700;
  const baseHeight = 968;

  const [renderedHtml, setRenderedHtml] = React.useState<string>("");

  React.useEffect(() => {
    let active = true;
    async function updatePreview() {
      if (!window.meridian?.renderVoucherHtml) return;
      try {
        const html = await window.meridian.renderVoucherHtml({
          date,
          voucherType,
          hotelName,
          requisitionNo,
          tourNo,
          tourName,
          customerName,
          lineItems,
          confirmedBy,
          rateApplicableText,
          remarks,
          billingInstructions,
          employeeName,
          employeeEmail,
          tourType,
          market,
          ratePeriod,
          voucherTitle,
          rateStructure,
          manuallyEdited,
          guideText,
          surchargeText,
          eventSupplementText,
          totalPax,
          pageNumber: "1",
          rateApplicable: 0,
        });
        if (active) {
          setRenderedHtml(html);
        }
      } catch (err) {
        console.error("Failed to render preview HTML:", err);
      }
    }

    void updatePreview();
    return () => {
      active = false;
    };
  }, [
    date,
    voucherType,
    hotelName,
    requisitionNo,
    tourNo,
    tourName,
    customerName,
    lineItems,
    confirmedBy,
    rateApplicableText,
    remarks,
    billingInstructions,
    employeeName,
    employeeEmail,
    tourType,
    market,
    ratePeriod,
    voucherTitle,
    rateStructure,
    manuallyEdited,
    guideText,
    surchargeText,
    eventSupplementText,
    totalPax,
  ]);

  let fitScale = 1;
  if (previewMode === "expanded") {
    const margin = 24;
    const maxW = windowSize.width - margin;
    const maxH = windowSize.height - margin - 40;
    fitScale = Math.min(1, maxW / baseWidth, maxH / baseHeight);
  }

  const targetWidth =
    previewMode === "expanded"
      ? Math.round(baseWidth * fitScale)
      : previewMode === "collapsed"
        ? 180
        : 270;
  const targetHeight =
    previewMode === "expanded"
      ? Math.round(baseHeight * fitScale)
      : previewMode === "collapsed"
        ? 32
        : 400;
  const safeX = Math.max(
    8,
    Math.min(previewPos.x, windowSize.width - targetWidth - 8),
  );
  const safeY = Math.max(
    48,
    Math.min(previewPos.y, windowSize.height - targetHeight - 8),
  );

  return (
    <>
      <style>{`
        #live-preview-widget-container {
          left: ${safeX}px;
          top: ${safeY}px;
          width: ${targetWidth}px;
          height: ${targetHeight}px;
          opacity: ${previewMode === "expanded" || isDraggingPreview ? 1 : 0.95};
          box-shadow: ${
            previewMode === "expanded"
              ? "0 25px 50px -12px rgba(0, 0, 0, 0.25)"
              : "0 10px 15px -3px rgba(0, 0, 0, 0.1)"
          };
          transition: ${
            isDraggingPreview
              ? "none"
              : "left 0.3s ease-out, top 0.3s ease-out, width 0.3s ease-out, height 0.3s ease-out, opacity 0.3s ease-out, box-shadow 0.3s ease-out"
          };
        }
        #live-preview-widget-inner {
          top: ${
            previewMode === "expanded"
              ? `${Math.round(8 * fitScale)}px`
              : "8px"
          };
          left: ${
            previewMode === "expanded"
              ? `${Math.round(24 * fitScale)}px`
              : "10px"
          };
          transform: scale(${previewMode === "expanded" ? fitScale : 0.383});
          width: 652px;
          height: 920px;
          cursor: ${previewMode === "thumbnail" ? "zoom-in" : "zoom-out"};
        }
      `}</style>
      <div
        id="live-preview-widget-container"
        className="fixed z-50 bg-surface shadow-panel rounded-app overflow-hidden flex flex-col pointer-events-auto"
      >
        <div
          className="border-b border-line bg-navy px-4 flex justify-between items-center text-white shrink-0 h-[32px] cursor-move select-none"
          onMouseDown={startDragPreview}
          onDoubleClick={() =>
            setPreviewMode((prev) =>
              prev === "collapsed" ? "thumbnail" : "collapsed",
            )
          }
        >
          <div className="flex items-center gap-2 pointer-events-none">
            <FileText size={14} />
            <h3 className="text-[10px] font-bold uppercase tracking-wide">
              Live Preview
            </h3>
          </div>

          <div className="flex items-center gap-1.5 ml-2">
            {previewMode !== "collapsed" && (
              <button
                className="hover:bg-white/20 p-1 rounded transition-colors"
                onClick={(e) => {
                  e.stopPropagation();
                  setPreviewMode("collapsed");
                }}
                title="Minimize"
              >
                <Minus size={16} />
              </button>
            )}
            {previewMode === "collapsed" && (
              <button
                className="hover:bg-white/20 p-1 rounded transition-colors"
                onClick={(e) => {
                  e.stopPropagation();
                  setPreviewMode("thumbnail");
                }}
                title="Restore"
              >
                <Maximize2 size={14} />
              </button>
            )}
          </div>
        </div>

        <div
          className="flex-1 bg-cloud overflow-hidden relative"
          onClick={() =>
            setPreviewMode((prev) =>
              prev === "thumbnail" ? "expanded" : "thumbnail",
            )
          }
        >
          <div
            id="live-preview-widget-inner"
            className="origin-top-left transition-transform duration-300 ease-out absolute"
          >
            {renderedHtml ? (
              <iframe
                srcDoc={renderedHtml}
                className="w-full h-full border-none overflow-hidden pointer-events-none bg-transparent"
                title="Voucher Live Preview"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-cloud text-steel">
                <RefreshCw className="animate-spin text-steel" size={24} />
              </div>
            )}
          </div>
      </div>
    </div>
  </>
);
}
