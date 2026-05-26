import React from "react";
import { FileText, Minus, Maximize2 } from "lucide-react";
import logo from "../assets/logo.png";

interface LivePreviewWidgetProps {
  previewMode: "collapsed" | "thumbnail" | "expanded";
  setPreviewMode: React.Dispatch<React.SetStateAction<"collapsed" | "thumbnail" | "expanded">>;
  previewPos: { x: number; y: number };
  windowSize: { width: number; height: number };
  isDraggingPreview: boolean;
  startDragPreview: (e: React.MouseEvent) => void;
  // Watched fields
  date: string;
  voucherType: string;
  hotelName: string;
  requisitionNo: string;
  tourNo: string;
  tourName: string;
  customerName: string;
  lineItems: any[];
  confirmedBy: string;
  rateApplicableText: string;
  remarks: string;
  billingInstructions: string;
  employeeName: string;
  employeeEmail: string;
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
  employeeEmail
}: LivePreviewWidgetProps) {
  const targetWidth = previewMode === "expanded" ? 700 : previewMode === "collapsed" ? 180 : 308;
  const targetHeight = previewMode === "expanded" ? 968 : previewMode === "collapsed" ? 32 : 448;
  const safeX = Math.max(8, Math.min(previewPos.x, windowSize.width - targetWidth - 8));
  const safeY = Math.max(48, Math.min(previewPos.y, windowSize.height - targetHeight - 8));

  return (
    <div
      className="fixed z-50 bg-surface shadow-panel rounded-app overflow-hidden flex flex-col pointer-events-auto"
      style={{
        left: `${safeX}px`,
        top: `${safeY}px`,
        width: `${targetWidth}px`,
        height: `${targetHeight}px`,
        opacity: previewMode === "expanded" || isDraggingPreview ? 1 : 0.95,
        boxShadow: previewMode === "expanded" ? '0 25px 50px -12px rgba(0, 0, 0, 0.25)' : '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
        transition: isDraggingPreview ? 'none' : 'left 0.3s ease-out, top 0.3s ease-out, width 0.3s ease-out, height 0.3s ease-out, opacity 0.3s ease-out, box-shadow 0.3s ease-out',
      }}
    >
      <div
        className="border-b border-line bg-navy px-4 flex justify-between items-center text-white shrink-0 h-[32px] cursor-move select-none"
        onMouseDown={startDragPreview}
        onDoubleClick={() => setPreviewMode(prev => prev === "collapsed" ? "thumbnail" : "collapsed")}
      >
        <div className="flex items-center gap-2 pointer-events-none">
          <FileText size={14} />
          <h3 className="text-[10px] font-bold uppercase tracking-wide">Live Preview</h3>
        </div>

        <div className="flex items-center gap-1.5 ml-2">
          {previewMode !== "collapsed" && (
            <button
              className="hover:bg-white/20 p-1 rounded transition-colors"
              onClick={(e) => { e.stopPropagation(); setPreviewMode("collapsed"); }}
              title="Minimize"
            >
              <Minus size={16} />
            </button>
          )}
          {previewMode === "collapsed" && (
            <button
              className="hover:bg-white/20 p-1 rounded transition-colors"
              onClick={(e) => { e.stopPropagation(); setPreviewMode("thumbnail"); }}
              title="Restore"
            >
              <Maximize2 size={14} />
            </button>
          )}
        </div>
      </div>

      <div
        className="flex-1 bg-cloud overflow-hidden relative"
        onClick={() => setPreviewMode(prev => prev === "thumbnail" ? "expanded" : "thumbnail")}
      >
        <div
          className="origin-top-left transition-transform duration-300 ease-out absolute top-6 left-6"
          style={{
            transform: `scale(${previewMode === "expanded" ? 1 : 0.4})`,
            width: '652px',
            height: '920px',
            cursor: previewMode === "thumbnail" ? 'zoom-in' : 'zoom-out'
          }}
        >
          <div className="w-full h-full p-10 text-[10px] leading-[1.4] overflow-hidden flex flex-col font-sans text-gray-800" style={{ backgroundColor: "#ffffff" }}>
            {/* Header Section */}
            <div className="flex justify-between items-start mb-6 border-b border-gray-400 pb-4">
              <div className="flex gap-4">
                <img src={logo} className="w-12 h-12 object-contain opacity-40 grayscale" alt="Meridian Logo" />
                <div className="text-gray-500">
                  <div className="text-[12px]">Meridian</div>
                  <div>Colombo, Sri Lanka</div>
                  <div>Fax: +94-(0)11-2345678</div>
                  <div className="text-blue-400 underline decoration-blue-400">example@merid.com</div>
                </div>
              </div>
              <div className="text-gray-500 font-medium pt-1">
                Date: {date || "—"}
              </div>
            </div>

            {/* Title */}
            <div className="text-center font-bold text-[14px] mb-8">
              <span className="border-b-2 border-black inline-block pb-0.5">
                {voucherType === "reservation" ? "Hotel Reservation Voucher" :
                  voucherType === "amendment" ? "Amendment Voucher" : "PPTP Voucher"}
              </span>
            </div>

            {/* Top Body Grid */}
            <div className="mb-8">
              <div className="grid grid-cols-[110px_1fr] gap-y-1">
                <div className="font-bold">To</div>
                <div>: {hotelName || "—"}</div>

                <div className="font-bold">Requisition No</div>
                <div>: {requisitionNo || "—"}</div>

                <div className="font-bold">Tour No</div>
                <div>: {tourNo || "—"}</div>

                <div className="font-bold">Tour Name</div>
                <div>: {tourName || "—"}</div>

                <div className="font-bold">Customer</div>
                <div>: {customerName || "—"}</div>
              </div>
            </div>

            {/* Table */}
            <div className="mb-8 flex-1 overflow-hidden">
              <table className="w-full text-left">
                <thead>
                  <tr className="font-bold text-[9px]">
                    <th className="py-2 px-2 whitespace-nowrap">Required Date</th>
                    <th className="py-2 px-2 whitespace-nowrap">Room Category</th>
                    <th className="py-2 px-2">Basis</th>
                    <th className="py-2 px-1 text-center">SGL</th>
                    <th className="py-2 px-1 text-center">DBL</th>
                    <th className="py-2 px-1 text-center">TWN</th>
                    <th className="py-2 px-1 text-center">TPL</th>
                    <th className="py-2 px-1 text-center">Child</th>
                    <th className="py-2 px-1 text-center">Guide</th>
                    <th className="py-2 px-2 whitespace-nowrap">Arriving for</th>
                  </tr>
                </thead>
                <tbody>
                  {(lineItems || []).map((item, idx) => (
                    <tr key={idx} className={idx % 2 === 0 ? 'bg-[#f6f8fb]/50' : 'bg-white'}>
                      <td className="py-1.5 px-2">{item.requiredDate || "—"}</td>
                      <td className="py-1.5 px-2 whitespace-pre-wrap">{item.roomCategory || "—"}</td>
                      <td className="py-1.5 px-2">{item.basis || "—"}</td>
                      <td className="py-1.5 px-1 text-center">{item.singleRooms || ""}</td>
                      <td className="py-1.5 px-1 text-center">{item.doubleRooms || ""}</td>
                      <td className="py-1.5 px-1 text-center">{item.twinRooms || ""}</td>
                      <td className="py-1.5 px-1 text-center">{item.tripleRooms || ""}</td>
                      <td className="py-1.5 px-1 text-center">
                        {(() => {
                          const cc = (Number(item.child2_5) || 0) + (Number(item.child2_5Sharing) || 0) + (Number(item.child2_5Bed) || 0) + (Number(item.child2_5OwnRoom) || 0) + (Number(item.child6_11) || 0) + (Number(item.child6_11Sharing) || 0) + (Number(item.child6_11Bed) || 0) + (Number(item.child6_11OwnRoom) || 0);
                          return cc > 0 ? cc : "";
                        })()}
                      </td>
                      <td className="py-1.5 px-1 text-center">{item.guide ? `${item.guide} ${item.guideBasis || ""}`.trim() : ""}</td>
                      <td className="py-1.5 px-2">{item.arrivingFor || ""}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Bottom Sections */}
            <div className="space-y-4">
              <div>
                <div className="font-bold mb-1">Confirmed By - {confirmedBy || "Team"}</div>
              </div>

              <div>
                <div className="font-bold mb-1">Rate Applicable -</div>
                <div className="whitespace-pre-wrap leading-[1.5]">
                  {rateApplicableText || "—"}
                </div>
              </div>

              <div>
                <div className="font-bold mb-1">Remarks -</div>
                <div className="whitespace-pre-wrap">{remarks || "No"}</div>
              </div>

              <div>
                <div className="font-bold mb-1">Billing Instruction -</div>
                <div className="whitespace-pre-wrap leading-[1.5]">
                  {billingInstructions || ""}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="mt-8 pt-4 text-gray-400 font-medium">
              <div>{employeeName || "kadira"}</div>
              <div>{employeeEmail || "dilshanstoregiriulla@gmail.com"}</div>
              <div className="font-bold text-gray-500 mt-0.5">Meridian (Pvt.) Ltd.</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
