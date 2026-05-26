import React from "react";
import {
  History,
  Hotel,
  LayoutDashboard,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  ReceiptText,
  Settings,
  UserCircle
} from "lucide-react";
import type { AccountProfile, VoucherListFilters } from "../../electron/shared/types";

type ActiveView = "entry" | "dashboard" | "register" | "rate-master" | "manage-rates" | "settings" | "profile";

interface SidebarProps {
  navCollapsed: boolean;
  setNavCollapsed: (collapsed: boolean) => void;
  activeView: ActiveView;
  setActiveView: (view: ActiveView) => void;
  refreshVoucherRegister: (filters?: VoucherListFilters) => Promise<void>;
  voucherFilters: VoucherListFilters;
  showAccountMenu: boolean;
  setShowAccountMenu: (show: boolean) => void;
  accountProfile: AccountProfile | null;
  handleSignOut: () => Promise<void>;
  accountMenuRef: React.RefObject<HTMLDivElement>;
}

export function Sidebar({
  navCollapsed,
  setNavCollapsed,
  activeView,
  setActiveView,
  refreshVoucherRegister,
  voucherFilters,
  showAccountMenu,
  setShowAccountMenu,
  accountProfile,
  handleSignOut,
  accountMenuRef
}: SidebarProps) {
  return (
    <aside className={`app-sidebar group`}>
      {/* Collapse Button - Outside */}
      <button
        type="button"
        onClick={() => setNavCollapsed(!navCollapsed)}
        className="absolute -right-3 top-4 z-50 flex h-6 w-6 items-center justify-center rounded-full bg-surface shadow-md border border-line text-steel hover:text-navy opacity-0 group-hover:opacity-100 transition-opacity"
        title={navCollapsed ? "Expand Navigation" : "Collapse Navigation"}
      >
        {navCollapsed ? <PanelLeftOpen size={14} /> : <PanelLeftClose size={14} />}
      </button>

      <nav className={`space-y-1 ${navCollapsed ? "p-2" : "p-5"} text-sm font-semibold`}>
        <button
          type="button"
          className={`app-nav-button ${activeView === "dashboard" ? "app-nav-button-active" : ""}`}
          onClick={() => setActiveView("dashboard")}
          title="Dashboard"
        >
          <LayoutDashboard size={18} /> {!navCollapsed && "Dashboard"}
        </button>
        <button
          type="button"
          className={`app-nav-button w-full ${activeView === "entry" ? "app-nav-button-active" : ""}`}
          onClick={() => setActiveView("entry")}
          title="Voucher Entry"
        >
          <ReceiptText size={18} /> {!navCollapsed && "Voucher Entry"}
        </button>
        <button
          type="button"
          className={`app-nav-button ${activeView === "rate-master" ? "app-nav-button-active" : ""}`}
          onClick={() => setActiveView("rate-master")}
          title="Rate Master"
        >
          <Hotel size={18} /> {!navCollapsed && "Rate Master"}
        </button>
        <button
          type="button"
          className={`app-nav-button ${activeView === "register" ? "app-nav-button-active" : ""}`}
          onClick={() => {
            setActiveView("register");
            void refreshVoucherRegister(voucherFilters);
          }}
          title="Saved Vouchers"
        >
          <History size={18} /> {!navCollapsed && "Saved Vouchers"}
        </button>
      </nav>
      <div className={`mt-auto ${navCollapsed ? "p-2" : "p-5"} space-y-1`}>
        <button
          type="button"
          className={`app-nav-button w-full ${activeView === "settings" ? "app-nav-button-active" : ""}`}
          onClick={() => setActiveView("settings")}
          title="Settings"
        >
          <Settings size={18} /> {!navCollapsed && "Settings"}
        </button>

        <div className="relative" ref={accountMenuRef}>
          <button
            onClick={() => setShowAccountMenu(!showAccountMenu)}
            className={`app-nav-button w-full ${showAccountMenu ? "app-nav-button-active" : ""}`}
            title={accountProfile?.employeeName || "Account"}
          >
            <UserCircle size={18} />
            {!navCollapsed && (
              <div className="min-w-0 flex-1 text-left">
                <p className="truncate">{accountProfile?.employeeName || "Employee"}</p>
              </div>
            )}
          </button>

          {showAccountMenu && (
            <div className="absolute bottom-full left-0 z-50 mb-2 w-full min-w-[220px] rounded-2xl border border-line bg-surface p-2 shadow-2xl animate-in slide-in-from-bottom-2">
              <div className="px-3 py-2 border-b border-line mb-1">
                <p className="text-xs font-bold text-navy">Account Actions</p>
              </div>
              <button
                onClick={() => {
                  setActiveView("profile");
                  setShowAccountMenu(false);
                }}
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-ink hover:bg-cloud transition-colors"
              >
                <UserCircle size={16} /> Profile
              </button>
              <div className="my-1 border-t border-line" />
              <button
                onClick={handleSignOut}
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-red-500 hover:bg-red-500/10 transition-colors"
              >
                <LogOut size={16} /> Sign Out
              </button>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
