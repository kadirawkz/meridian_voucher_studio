import {
  AlertTriangle,
  Building2,
  CalendarClock,
  CheckCircle2,
  Clock,
  FileText,
  Plus,
  ReceiptText,
  RefreshCw,
  TrendingUp,
} from "lucide-react";
import { useEffect, useState, type ElementType } from "react";
import { hotels as fallbackHotels } from "../domain/referenceData";
import type { HotelRateRecordSummary, HotelRef, VoucherRecord, VoucherStatus } from "../../electron/shared/types";

interface DashboardProps {
  onNewVoucher: () => void;
  onOpenVoucher: (id: string) => void;
  onGoToRateMaster: () => void;
  onGoToRegister: () => void;
}

interface DashboardData {
  allVouchers: VoucherRecord[];
  contracts: HotelRateRecordSummary[];
  hotelsWithContracts: Set<string>;
  loading: boolean;
  loadedAt: Date | null;
}

const STATUS_CONFIG: Record<VoucherStatus, { label: string; color: string; dot: string }> = {
  draft:     { label: "Draft",     color: "bg-slate-100 text-slate-700",   dot: "bg-slate-400" },
  generated: { label: "Generated", color: "bg-blue-100 text-blue-700",     dot: "bg-blue-500" },
  sent:      { label: "Sent",      color: "bg-emerald-100 text-emerald-700", dot: "bg-emerald-500" },
};

function today() {
  return new Date().toISOString().slice(0, 10);
}

function daysFromNow(dateStr: string): number {
  const diff = new Date(dateStr).getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

function StatusBadge({ status }: { status: VoucherStatus }) {
  const c = STATUS_CONFIG[status] ?? STATUS_CONFIG.draft;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${c.color}`}>
      <span className={`size-1.5 rounded-full ${c.dot}`} />
      {c.label}
    </span>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  accent,
  onClick,
}: {
  icon: ElementType;
  label: string;
  value: string | number;
  sub?: string;
  accent?: string;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group w-full rounded-2xl border border-line bg-surface p-5 text-left shadow-sm transition hover:shadow-md ${onClick ? "cursor-pointer" : "cursor-default"}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${accent ?? "bg-cloud"}`}>
          <Icon size={20} className={accent ? "text-white" : "text-navy"} />
        </div>
        {onClick && (
          <Plus size={15} className="mt-0.5 text-steel opacity-0 transition group-hover:opacity-100" />
        )}
      </div>
      <p className="mt-4 text-3xl font-bold text-ink">{value}</p>
      <p className="mt-0.5 text-sm font-semibold text-navy">{label}</p>
      {sub && <p className="mt-1 text-xs text-steel">{sub}</p>}
    </button>
  );
}

export function DashboardScreen({ onNewVoucher, onOpenVoucher, onGoToRateMaster, onGoToRegister }: DashboardProps) {
  const [data, setData] = useState<DashboardData>({
    allVouchers: [],
    contracts: [],
    hotelsWithContracts: new Set(),
    loading: true,
    loadedAt: null,
  });

  async function load() {
    setData((d) => ({ ...d, loading: true }));
    try {
      const [vouchers, contracts] = await Promise.all([
        window.meridian?.listVouchers?.() ?? Promise.resolve([]),
        window.meridian?.listHotelRates?.() ?? Promise.resolve([]),
      ]);

      const hotelsWithContracts = new Set<string>(
        (contracts ?? []).map((c: HotelRateRecordSummary) => c.hotel_name)
      );

      setData({
        allVouchers: vouchers ?? [],
        contracts: contracts ?? [],
        hotelsWithContracts,
        loading: false,
        loadedAt: new Date(),
      });
    } catch {
      setData((d) => ({ ...d, loading: false }));
    }
  }

  useEffect(() => { void load(); }, []);

  const { allVouchers, contracts, hotelsWithContracts, loading, loadedAt } = data;

  // Derived stats
  const todayStr = today();
  const vouchersToday = allVouchers.filter((v) => v.voucherDate === todayStr || v.createdAt?.slice(0, 10) === todayStr);

  const byStatus = {
    draft:     allVouchers.filter((v) => v.status === "draft").length,
    generated: allVouchers.filter((v) => v.status === "generated").length,
    sent:      allVouchers.filter((v) => v.status === "sent").length,
  };

  const recentVouchers = [...allVouchers]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 8);

  const expiringContracts = contracts
    .filter((c) => {
      const days = daysFromNow(c.valid_to);
      return days >= 0 && days <= 30;
    })
    .sort((a, b) => a.valid_to.localeCompare(b.valid_to));

  // Load hotel names from API for coverage calculation
  const [allHotelNames, setAllHotelNames] = useState<string[]>([...fallbackHotels]);
  useEffect(() => {
    if (window.meridian?.listHotels) {
      void window.meridian.listHotels()
        .then((refs: HotelRef[]) => {
          const names = refs.map((h) => h.name).filter(Boolean);
          if (names.length > 0) setAllHotelNames(names);
        })
        .catch(() => {});
    }
  }, []);

  const totalReferenceHotels = allHotelNames.length;
  const coveredCount = allHotelNames.filter((h) => hotelsWithContracts.has(h)).length;
  const uncoveredHotels = allHotelNames.filter((h) => !hotelsWithContracts.has(h));

  return (
    <div className="mx-auto max-w-[1400px] p-4 md:p-8">
      {/* Page header */}
      <div className="mb-8 flex items-end justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-steel">Operations</p>
          <h2 className="mt-1 font-display text-3xl font-bold text-navy">Dashboard</h2>
          <p className="mt-2 text-sm text-steel">
            {loadedAt
              ? `Updated ${loadedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
              : "Loading…"}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={load}
            disabled={loading}
            className="flex items-center gap-2 rounded-xl border border-line bg-surface px-4 py-2 text-sm font-bold text-steel shadow-sm hover:text-navy disabled:opacity-50"
          >
            <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
            Refresh
          </button>
          <button
            type="button"
            onClick={onNewVoucher}
            className="flex items-center gap-2 rounded-xl bg-navy px-4 py-2 text-sm font-bold text-white shadow-sm hover:bg-navy/90"
          >
            <Plus size={15} /> New Voucher
          </button>
        </div>
      </div>

      {/* ── Stat cards ── */}
      <div className="mb-8 grid grid-cols-1 sm:grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          icon={ReceiptText}
          label="Vouchers Today"
          value={vouchersToday.length}
          sub={`${allVouchers.length} total`}
          accent="bg-navy"
          onClick={onGoToRegister}
        />
        <StatCard
          icon={TrendingUp}
          label="Draft"
          value={byStatus.draft}
          sub={`${byStatus.generated} generated · ${byStatus.sent} sent`}
          accent="bg-slate-500"
          onClick={onGoToRegister}
        />
        <StatCard
          icon={Building2}
          label="Rate Master Coverage"
          value={`${coveredCount} / ${totalReferenceHotels}`}
          sub={`${totalReferenceHotels - coveredCount} hotels without a contract`}
          accent={coveredCount === totalReferenceHotels ? "bg-emerald-500" : "bg-amber-500"}
          onClick={onGoToRateMaster}
        />
        <StatCard
          icon={CalendarClock}
          label="Expiring Soon"
          value={expiringContracts.length}
          sub="Contracts expiring within 30 days"
          accent={expiringContracts.length > 0 ? "bg-red-500" : "bg-emerald-500"}
          onClick={onGoToRateMaster}
        />
      </div>

      {/* ── Status breakdown ── */}
      <div className="mb-8 flex flex-wrap items-center gap-3 rounded-2xl border border-line bg-surface px-6 py-4 shadow-sm">
        <p className="shrink-0 text-xs font-bold uppercase tracking-wide text-steel">Status Breakdown</p>
        <div className="ml-0 md:ml-4 flex flex-wrap items-center gap-2">
          {(["draft", "generated", "sent"] as VoucherStatus[]).map((s) => {
            const c = STATUS_CONFIG[s];
            const pct = allVouchers.length > 0 ? Math.round((byStatus[s] / allVouchers.length) * 100) : 0;
            return (
              <span key={s} className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ${c.color}`}>
                <span className={`size-1.5 rounded-full ${c.dot}`} />
                {c.label} — {byStatus[s]} ({pct}%)
              </span>
            );
          })}
        </div>
        {allVouchers.length === 0 && (
          <span className="ml-auto text-xs text-steel">No vouchers yet</span>
        )}
      </div>

      {/* ── Main grid: Recent Vouchers + Right column ── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_380px]">

        {/* Recent Vouchers */}
        <div className="rounded-2xl border border-line bg-surface shadow-sm">
          <div className="flex items-center justify-between border-b border-line px-6 py-4">
            <div className="flex items-center gap-2">
              <FileText size={16} className="text-navy" />
              <h3 className="text-sm font-bold text-navy">Recent Vouchers</h3>
            </div>
            <button
              type="button"
              onClick={onGoToRegister}
              className="text-xs font-semibold text-steel hover:text-navy"
            >
              View all →
            </button>
          </div>
          {loading ? (
            <div className="flex items-center justify-center py-16 text-sm text-steel">
              <RefreshCw size={16} className="mr-2 animate-spin" /> Loading…
            </div>
          ) : recentVouchers.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
              <p className="text-sm font-semibold text-steel">No vouchers yet</p>
              <button
                type="button"
                onClick={onNewVoucher}
                className="mt-1 flex items-center gap-2 rounded-xl bg-navy px-4 py-2 text-xs font-bold text-white"
              >
                <Plus size={13} /> Create first voucher
              </button>
            </div>
          ) : (
            <div className="divide-y divide-line">
              {recentVouchers.map((v) => (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => onOpenVoucher(v.id)}
                  className="flex w-full items-center gap-4 px-6 py-3.5 text-left transition hover:bg-cloud"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-ink">{v.hotelName || "—"}</p>
                    <p className="mt-0.5 truncate text-xs text-steel">
                      {v.tourNo} · {v.customerName}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <StatusBadge status={v.status} />
                    <p className="mt-1 text-xs text-steel">{v.voucherDate}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Right column */}
        <div className="space-y-6">

          {/* Expiring Contracts */}
          <div className="rounded-2xl border border-line bg-surface shadow-sm">
            <div className="flex items-center gap-2 border-b border-line px-5 py-4">
              <CalendarClock size={16} className="text-red-500" />
              <h3 className="text-sm font-bold text-navy">Expiring Contracts</h3>
              {expiringContracts.length > 0 && (
                <span className="ml-auto rounded-full bg-red-100 px-2 py-0.5 text-xs font-bold text-red-700">
                  {expiringContracts.length}
                </span>
              )}
            </div>
            {expiringContracts.length === 0 ? (
              <div className="flex items-center gap-2 px-5 py-5 text-xs text-emerald-700">
                <CheckCircle2 size={15} className="shrink-0" />
                All contracts valid for 30+ days
              </div>
            ) : (
              <div className="divide-y divide-line">
                {expiringContracts.map((c) => {
                  const days = daysFromNow(c.valid_to);
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={onGoToRateMaster}
                      className="flex w-full items-start gap-3 px-5 py-3.5 text-left transition hover:bg-cloud"
                    >
                      <AlertTriangle
                        size={14}
                        className={`mt-0.5 shrink-0 ${days <= 7 ? "text-red-500" : "text-amber-500"}`}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-semibold text-ink">{c.hotel_name}</p>
                        <p className="text-xs text-steel">{c.market} · {c.contract_name}</p>
                      </div>
                      <span className={`shrink-0 text-xs font-bold ${days <= 7 ? "text-red-600" : "text-amber-600"}`}>
                        {days === 0 ? "Today" : `${days}d`}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Rate Master Coverage */}
          <div className="rounded-2xl border border-line bg-surface shadow-sm">
            <div className="flex items-center gap-2 border-b border-line px-5 py-4">
              <Building2 size={16} className="text-navy" />
              <h3 className="text-sm font-bold text-navy">Rate Master Coverage</h3>
              <span className="ml-auto text-xs font-bold text-navy">
                {coveredCount}/{totalReferenceHotels}
              </span>
            </div>

            {/* Progress bar */}
            <div className="px-5 pt-4">
              <progress
                className="app-progress h-2 w-full"
                max={totalReferenceHotels}
                value={coveredCount}
              />
              <p className="mt-2 text-xs text-steel">
                {totalReferenceHotels - coveredCount} hotels missing contracts
              </p>
            </div>

            {/* Missing hotels */}
            {uncoveredHotels.length > 0 ? (
              <div className="mt-3 divide-y divide-line">
                {uncoveredHotels.slice(0, 5).map((h) => (
                  <button
                    key={h}
                    type="button"
                    onClick={onGoToRateMaster}
                    className="flex w-full items-center gap-2 px-5 py-2.5 text-left transition hover:bg-cloud"
                  >
                    <Clock size={12} className="shrink-0 text-amber-500" />
                    <span className="truncate text-xs text-steel">{h}</span>
                  </button>
                ))}
                {uncoveredHotels.length > 5 && (
                  <button
                    type="button"
                    onClick={onGoToRateMaster}
                    className="flex w-full items-center justify-center gap-1.5 px-5 py-2.5 text-xs font-semibold text-steel hover:text-navy"
                  >
                    +{uncoveredHotels.length - 5} more → Add in Rate Master
                  </button>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2 px-5 py-4 text-xs text-emerald-700">
                <CheckCircle2 size={14} className="shrink-0" />
                All hotels covered
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
