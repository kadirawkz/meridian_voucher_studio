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
  ArrowRight,
  ShieldCheck,
  Layers,
} from "lucide-react";
import { useEffect, useState, type ElementType } from "react";
import { hotels as fallbackHotels } from "../domain/referenceData";
import type {
  HotelRateRecordSummary,
  HotelRef,
  VoucherRecord,
  VoucherStatus,
} from "../../electron/shared/types";

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

const STATUS_CONFIG: Record<
  VoucherStatus,
  { label: string; color: string; dot: string }
> = {
  draft: {
    label: "Draft",
    color: "bg-slate-100 text-slate-700 border border-slate-200",
    dot: "bg-slate-400",
  },
  generated: {
    label: "Generated",
    color: "bg-indigo-50 text-indigo-700 border border-indigo-200",
    dot: "bg-indigo-500",
  },
  sent: {
    label: "Sent",
    color: "bg-emerald-50 text-emerald-700 border border-emerald-200",
    dot: "bg-emerald-500",
  },
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
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-bold tracking-wide uppercase ${c.color}`}
    >
      <span className={`size-1.5 rounded-full ${c.dot} animate-pulse`} />
      {c.label}
    </span>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  gradient,
  glowColor,
  onClick,
}: {
  icon: ElementType;
  label: string;
  value: string | number;
  sub?: string;
  gradient: string;
  glowColor: string;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group relative overflow-hidden w-full rounded-2xl border border-line bg-surface p-6 text-left shadow-sm transition-all duration-300 hover:shadow-md hover:-translate-y-0.5 active:translate-y-0 ${onClick ? "cursor-pointer" : "cursor-default"}`}
    >
      {/* Background soft glow decoration */}
      <div
        className={`absolute -right-3 -top-3 h-14 w-14 rounded-bl-full opacity-10 bg-gradient-to-br ${gradient} group-hover:scale-125 transition-transform duration-300`}
      />

      <div className="flex items-start justify-between gap-3">
        <div
          className={`flex size-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${gradient} text-white shadow-md ${glowColor}`}
        >
          <Icon size={20} />
        </div>
        {onClick && (
          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-cloud text-steel opacity-0 group-hover:opacity-100 transition-opacity duration-200">
            <ArrowRight
              size={13}
              className="group-hover:translate-x-0.5 transition-transform"
            />
          </div>
        )}
      </div>
      <p className="mt-5 text-3xl font-black text-navy tracking-tight">
        {value}
      </p>
      <p className="mt-1 text-[13px] font-bold text-steel uppercase tracking-wider">
        {label}
      </p>
      {sub && <p className="mt-1 text-xs text-steel font-medium">{sub}</p>}
    </button>
  );
}

export function DashboardScreen({
  onNewVoucher,
  onOpenVoucher,
  onGoToRateMaster,
  onGoToRegister,
}: DashboardProps) {
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
        (contracts ?? []).map((c: HotelRateRecordSummary) => c.hotel_name),
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

  useEffect(() => {
    void load();
  }, []);

  const { allVouchers, contracts, hotelsWithContracts, loading, loadedAt } =
    data;

  // Derived stats
  const todayStr = today();
  const vouchersToday = allVouchers.filter(
    (v) => v.voucherDate === todayStr || v.createdAt?.slice(0, 10) === todayStr,
  );

  const byStatus = {
    draft: allVouchers.filter((v) => v.status === "draft").length,
    generated: allVouchers.filter((v) => v.status === "generated").length,
    sent: allVouchers.filter((v) => v.status === "sent").length,
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
  const [allHotelNames, setAllHotelNames] = useState<string[]>([
    ...fallbackHotels,
  ]);
  useEffect(() => {
    if (window.meridian?.listHotels) {
      void window.meridian
        .listHotels()
        .then((refs: HotelRef[]) => {
          const names = refs.map((h) => h.name).filter(Boolean);
          if (names.length > 0) setAllHotelNames(names);
        })
        .catch(() => {});
    }
  }, []);

  const totalReferenceHotels = allHotelNames.length;
  const coveredCount = allHotelNames.filter((h) =>
    hotelsWithContracts.has(h),
  ).length;
  const uncoveredHotels = allHotelNames.filter(
    (h) => !hotelsWithContracts.has(h),
  );
  const coveragePercentage = totalReferenceHotels
    ? Math.round((coveredCount / totalReferenceHotels) * 100)
    : 0;

  return (
    <div className="mx-auto max-w-[1500px] p-4 md:p-8 space-y-8 animate-fade-in">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-line pb-6">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-steel">
            Administrative Dashboard
          </p>
          <h2 className="mt-1 font-display text-3xl font-black text-navy tracking-tight">
            Meridian Control Center
          </h2>
          <p className="mt-1.5 text-sm text-steel flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-ping" />
            {loadedAt
              ? `Operational metrics updated today at ${loadedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}`
              : "Synchronizing system statistics…"}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={load}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 text-sm font-semibold border border-line rounded-app bg-surface text-navy hover:bg-cloud transition-all active:scale-95 shadow-sm disabled:opacity-50"
          >
            <RefreshCw
              size={15}
              className={loading ? "animate-spin text-navy" : ""}
            />
            Refresh
          </button>
          <button
            type="button"
            onClick={onNewVoucher}
            className="flex items-center gap-2 px-5 py-2.5 text-sm font-bold rounded-app bg-navy hover:bg-navy-light text-white transition-all active:scale-95 shadow-md shadow-navy/10"
          >
            <Plus size={16} />
            New Voucher
          </button>
        </div>
      </div>

      {/* ── Stat cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          icon={ReceiptText}
          label="Today's Vouchers"
          value={vouchersToday.length}
          sub={`${allVouchers.length} absolute lifetime records`}
          gradient="from-blue-600 to-indigo-600"
          glowColor="shadow-blue-500/20"
          onClick={onGoToRegister}
        />
        <StatCard
          icon={TrendingUp}
          label="Active Drafts"
          value={byStatus.draft}
          sub={`${byStatus.generated} generated · ${byStatus.sent} dispatched`}
          gradient="from-amber-500 to-orange-600"
          glowColor="shadow-amber-500/20"
          onClick={onGoToRegister}
        />
        <StatCard
          icon={Building2}
          label="Rate Master Coverage"
          value={`${coveragePercentage}%`}
          sub={`${coveredCount} / ${totalReferenceHotels} hotels under active contract`}
          gradient={
            coveredCount === totalReferenceHotels
              ? "from-emerald-500 to-teal-600"
              : "from-blue-600 to-indigo-600"
          }
          glowColor={
            coveredCount === totalReferenceHotels
              ? "shadow-emerald-500/20"
              : "shadow-violet-500/20"
          }
          onClick={onGoToRateMaster}
        />
        <StatCard
          icon={CalendarClock}
          label="Expiring Contracts"
          value={expiringContracts.length}
          sub={
            expiringContracts.length > 0
              ? "Requires administrative renewal"
              : "All databases perfectly valid"
          }
          gradient={
            expiringContracts.length > 0
              ? "from-rose-500 to-red-600"
              : "from-teal-500 to-emerald-600"
          }
          glowColor={
            expiringContracts.length > 0
              ? "shadow-rose-500/20"
              : "shadow-teal-500/20"
          }
          onClick={onGoToRateMaster}
        />
      </div>

      {/* ── Progress Pipeline Breakdown ── */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 rounded-2xl border border-line bg-gradient-to-r from-cloud/20 to-cloud/40 p-5 shadow-sm">
        <div className="flex items-center gap-2.5">
          <Layers size={16} className="text-navy" />
          <span className="text-xs font-bold uppercase tracking-wider text-navy">
            Global Status Pipeline
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {(["draft", "generated", "sent"] as VoucherStatus[]).map((s) => {
            const c = STATUS_CONFIG[s];
            const pct =
              allVouchers.length > 0
                ? Math.round((byStatus[s] / allVouchers.length) * 100)
                : 0;
            return (
              <span
                key={s}
                className={`inline-flex items-center gap-2 rounded-full px-3.5 py-1 text-xs font-bold ${c.color}`}
              >
                <span
                  className={`size-2 rounded-full ${c.dot} animate-pulse`}
                />
                <span>
                  {c.label}: {byStatus[s]} ({pct}%)
                </span>
              </span>
            );
          })}
        </div>
        {allVouchers.length === 0 && (
          <span className="text-xs text-steel font-medium italic">
            No active data rows found in workspace
          </span>
        )}
      </div>

      {/* ── Main Workspace Grid ── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_390px]">
        {/* Left Column: Recent Vouchers */}
        <div className="rounded-2xl border border-line bg-surface shadow-sm overflow-hidden flex flex-col">
          <div className="flex items-center justify-between border-b border-line px-6 py-4 bg-cloud/20">
            <div className="flex items-center gap-2">
              <FileText size={16} className="text-navy" />
              <h3 className="text-sm font-bold text-navy uppercase tracking-wider">
                Recent Operational Vouchers
              </h3>
            </div>
            <button
              type="button"
              onClick={onGoToRegister}
              className="text-xs font-bold text-navy hover:text-navy/80 flex items-center gap-1 transition-all"
            >
              <span>View Register</span>
              <ArrowRight size={12} />
            </button>
          </div>

          {loading ? (
            <div className="flex-1 flex items-center justify-center py-24 text-sm text-steel gap-2.5">
              <RefreshCw size={18} className="animate-spin text-navy" />
              <span>Retrieving workspace voucher logs...</span>
            </div>
          ) : recentVouchers.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-4 py-24 px-6 text-center">
              <div className="h-12 w-12 rounded-full bg-slate-50 flex items-center justify-center text-slate-400">
                <FileText size={20} />
              </div>
              <div>
                <p className="text-base font-bold text-navy">
                  No bookings generated yet
                </p>
                <p className="text-xs text-steel mt-1 max-w-xs">
                  Create your first client reservation voucher to populate the
                  workspace logs.
                </p>
              </div>
              <button
                type="button"
                onClick={onNewVoucher}
                className="flex items-center gap-2 rounded-app bg-navy px-4 py-2 text-xs font-bold text-white hover:bg-navy-light transition-all shadow-sm active:scale-95"
              >
                <Plus size={13} /> Create Voucher
              </button>
            </div>
          ) : (
            <div className="divide-y divide-line/60">
              {recentVouchers.map((v) => (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => onOpenVoucher(v.id)}
                  className="flex w-full items-center gap-4 px-6 py-4 text-left transition-all hover:bg-cloud/30 group"
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-cloud text-navy group-hover:bg-cloud group-hover:text-navy transition-colors duration-200">
                    <Layers size={16} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-navy group-hover:text-navy transition-colors">
                      {v.hotelName || "No Placement Hotel"}
                    </p>
                    <div className="mt-1 flex items-center gap-2 text-xs text-steel font-medium">
                      <span className="font-bold text-slate-700">
                        {v.requisitionNo || v.tourNo || "No Ref"}
                      </span>
                      <span>·</span>
                      <span className="truncate max-w-[150px]">
                        {v.customerName}
                      </span>
                    </div>
                  </div>
                  <div className="shrink-0 text-right space-y-1.5">
                    <StatusBadge status={v.status} />
                    <p className="text-[11px] text-steel font-semibold">
                      {new Date(v.createdAt).toLocaleDateString("en-GB", {
                        day: "2-digit",
                        month: "short",
                      })}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Right Column: Rate Master & Safety Coverage */}
        <div className="space-y-6">
          {/* Expiring Contracts panel */}
          <div className="rounded-2xl border border-line bg-surface shadow-sm overflow-hidden">
            <div className="flex items-center gap-2 border-b border-line px-5 py-4 bg-cloud/20">
              <CalendarClock size={16} className="text-rose-500" />
              <h3 className="text-sm font-bold text-navy uppercase tracking-wider">
                Contract Expirations
              </h3>
              {expiringContracts.length > 0 && (
                <span className="ml-auto rounded-full bg-rose-100 border border-rose-200 px-2 py-0.5 text-[10px] font-bold text-rose-700 animate-pulse">
                  {expiringContracts.length} Alerts
                </span>
              )}
            </div>
            {expiringContracts.length === 0 ? (
              <div
                className="flex items-center gap-2.5 px-5 py-6 text-xs font-semibold bg-cloud/30"
                style={{ color: "var(--color-success)" }}
              >
                <ShieldCheck
                  size={18}
                  className="shrink-0 animate-bounce"
                  style={{ color: "var(--color-success)" }}
                />
                <span>All rate contracts are valid for the next 30+ days.</span>
              </div>
            ) : (
              <div className="divide-y divide-line/60">
                {expiringContracts.map((c) => {
                  const days = daysFromNow(c.valid_to);
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={onGoToRateMaster}
                      className="flex w-full items-start gap-3 px-5 py-4 text-left transition-all hover:bg-cloud/30"
                    >
                      <AlertTriangle
                        size={15}
                        className={`mt-0.5 shrink-0 ${days <= 7 ? "text-rose-500 animate-pulse" : "text-amber-500"}`}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-bold text-navy">
                          {c.hotel_name}
                        </p>
                        <p className="text-[11px] text-steel font-medium mt-0.5">
                          {c.market} · {c.contract_name}
                        </p>
                      </div>
                      <span
                        className={`shrink-0 text-xs font-black uppercase tracking-wider px-2 py-0.5 rounded-full ${days <= 7 ? "bg-rose-50 text-rose-600 border border-rose-100" : "bg-amber-50 text-amber-600 border border-amber-100"}`}
                      >
                        {days === 0 ? "Today" : `${days}d`}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Rate Master Coverage and Gap Analysis */}
          <div className="rounded-2xl border border-line bg-surface shadow-sm overflow-hidden">
            <div className="flex items-center gap-2 border-b border-line px-5 py-4 bg-cloud/20">
              <Building2 size={16} className="text-navy" />
              <h3 className="text-sm font-bold text-navy uppercase tracking-wider">
                Rate Database Gaps
              </h3>
              <span className="ml-auto text-xs font-black text-navy bg-cloud px-2 py-0.5 rounded-full">
                {coveredCount}/{totalReferenceHotels} Done
              </span>
            </div>

            {/* Premium progress bar area */}
            <div className="px-5 py-5 border-b border-line/40 bg-cloud/5">
              <div className="flex justify-between items-center text-xs font-bold text-slate-700 mb-2">
                <span>Coverage Ratio</span>
                <span>{coveragePercentage}%</span>
              </div>
              <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-blue-600 to-indigo-600 rounded-full transition-all duration-500"
                  style={{ width: `${coveragePercentage}%` }}
                />
              </div>
              <p className="mt-2.5 text-[11px] text-steel font-semibold uppercase tracking-wider">
                {totalReferenceHotels - coveredCount} operational hotels missing
                contracts
              </p>
            </div>

            {/* Gap listings */}
            {uncoveredHotels.length > 0 ? (
              <div className="divide-y divide-line/60">
                {uncoveredHotels.slice(0, 5).map((h) => (
                  <button
                    key={h}
                    type="button"
                    onClick={onGoToRateMaster}
                    className="flex w-full items-center gap-2 px-5 py-3 text-left transition-all hover:bg-cloud/30 group"
                  >
                    <Clock size={13} className="shrink-0 text-amber-500" />
                    <span className="truncate text-xs text-slate-700 font-medium group-hover:text-navy transition-colors">
                      {h}
                    </span>
                    <Plus
                      size={11}
                      className="ml-auto text-steel opacity-0 group-hover:opacity-100 transition-opacity"
                    />
                  </button>
                ))}
                {uncoveredHotels.length > 5 && (
                  <button
                    type="button"
                    onClick={onGoToRateMaster}
                    className="flex w-full items-center justify-center gap-1.5 px-5 py-3 text-xs font-bold text-navy hover:text-navy/80 bg-cloud/20 hover:bg-cloud/40 transition-colors"
                  >
                    <span>
                      +{uncoveredHotels.length - 5} more outstanding gaps
                    </span>
                    <ArrowRight size={12} />
                  </button>
                )}
              </div>
            ) : (
              <div
                className="flex items-center gap-2.5 px-5 py-6 text-xs font-semibold bg-cloud/30"
                style={{ color: "var(--color-success)" }}
              >
                <CheckCircle2
                  size={16}
                  className="shrink-0"
                  style={{ color: "var(--color-success)" }}
                />
                <span>Zero Database Gaps! Perfect Coverage!</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
