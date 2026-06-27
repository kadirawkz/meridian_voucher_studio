import React, { useRef, useState, useEffect } from "react";
import {
  Search,
  Minus,
  Square,
  X,
  Bell,
  Info,
  AlertCircle,
  CheckCircle2,
  Clock,
  Trash2,
  FolderOpen,
  ArrowRight,
  Loader2,
} from "lucide-react";
import logo from "../assets/logo.png";

export interface AppNotification {
  id: string;
  message: string;
  type: "info" | "success" | "error";
  timestamp: number;
}

interface MenuBarProps {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  notices: AppNotification[];
  onClearNotice: (id: string) => void;
  onClearAllNotices: () => void;
  onNavigate: (view: string) => void;
  onSignOut: () => void;
  onReportIssue: () => void;
  isLoading?: boolean;
}

function formatRelativeTime(timestamp: number): string {
  const diffMs = Date.now() - timestamp;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);

  if (diffSec < 10) return "Just now";
  if (diffSec < 60) return `${diffSec}s ago`;
  if (diffMin < 60) return `${diffMin}m ago`;
  return new Date(timestamp).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function MenuBar({
  searchQuery,
  setSearchQuery,
  notices,
  onClearNotice,
  onClearAllNotices,
  onNavigate,
  onSignOut,
  onReportIssue,
  isLoading,
}: MenuBarProps) {
  const searchInputRef = useRef<any>(null); // eslint-disable-line @typescript-eslint/no-explicit-any
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isNoticesOpen, setIsNoticesOpen] = useState(false);
  const [noticeFilter, setNoticeFilter] = useState<
    "all" | "error" | "success" | "info"
  >("all");
  const [hasOpenedNotices, setHasOpenedNotices] = useState(false);
  const menuBarRef = useRef<any>(null); // eslint-disable-line @typescript-eslint/no-explicit-any
  const noticeRef = useRef<any>(null); // eslint-disable-line @typescript-eslint/no-explicit-any
  const prevNoticesLengthRef = useRef(notices.length);

  // Monitor notifications count to show badge only for newly arrived items
  useEffect(() => {
    if (notices.length > prevNoticesLengthRef.current) {
      setHasOpenedNotices(false);
    }
    prevNoticesLengthRef.current = notices.length;
  }, [notices.length]);

  // Expose search focus to window for shortcut Ctrl+K
  useEffect(() => {
    const handleFocusSearch = () => searchInputRef.current?.focus();
    window.addEventListener("focus-search", handleFocusSearch);
    return () => window.removeEventListener("focus-search", handleFocusSearch);
  }, []);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        menuBarRef.current &&
        !menuBarRef.current.contains(event.target as Node)
      ) {
        setIsMenuOpen(false);
        setActiveMenu(null);
      }
      if (
        noticeRef.current &&
        !noticeRef.current.contains(event.target as Node)
      ) {
        setIsNoticesOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    const root = menuBarRef.current as HTMLElement | null;
    if (!root) return;

    root.style.setProperty("-webkit-app-region", "drag");
    root.querySelectorAll<HTMLElement>(".no-drag").forEach((element) => {
      element.style.setProperty("-webkit-app-region", "no-drag");
    });
  }, []);

  const handleMenuClick = (label: string) => {
    if (isMenuOpen && activeMenu === label) {
      setIsMenuOpen(false);
      setActiveMenu(null);
    } else {
      setIsMenuOpen(true);
      setActiveMenu(label);
    }
  };

  const handleMenuMouseEnter = (label: string) => {
    if (isMenuOpen) {
      setActiveMenu(label);
    }
  };

  const handleItemClick = (action?: () => void) => {
    if (action) action();
    setIsMenuOpen(false);
    setActiveMenu(null);
  };

  const menuItems = [
    {
      label: "File",
      items: [
        {
          label: "New Voucher",
          shortcut: "Ctrl+N",
          action: () => onNavigate("entry"),
        },
        { label: "Save Voucher", shortcut: "Ctrl+S", action: () => {} },
        { type: "separator" },
        { label: "Exit", action: () => window.meridian?.closeWindow() },
      ],
    },
    {
      label: "Edit",
      items: [
        { label: "Undo", shortcut: "Ctrl+Z" },
        { label: "Redo", shortcut: "Ctrl+Y" },
        { type: "separator" },
        {
          label: "Rate Master",
          shortcut: "Ctrl+R",
          action: () => onNavigate("rate-master"),
        },
        {
          label: "Voucher Register",
          shortcut: "Ctrl+H",
          action: () => onNavigate("register"),
        },
        { type: "separator" },
        {
          label: "Search",
          shortcut: "Ctrl+K",
          action: () => searchInputRef.current?.focus(),
        },
      ],
    },
    {
      label: "View",
      items: [
        {
          label: "Reload",
          shortcut: "Ctrl+R",
          action: () => window.location.reload(),
        },
        ...(import.meta.env.DEV
          ? [{ label: "Toggle DevTools", shortcut: "F12" }]
          : []),
        { type: "separator" },
        {
          label: "Dashboard",
          shortcut: "Ctrl+D",
          action: () => onNavigate("dashboard"),
        },
        {
          label: "Profile",
          shortcut: "Ctrl+P",
          action: () => onNavigate("profile"),
        },
        {
          label: "Settings",
          shortcut: "Ctrl+,",
          action: () => onNavigate("settings"),
        },
      ],
    },
    {
      label: "Help",
      items: [
        { label: "Report Issue", action: onReportIssue },
        { label: "Privacy Statement", action: () => {} },
        { label: "Check for Updates", action: () => {} },
        { type: "separator" },
        { label: "Sign Out", shortcut: "Ctrl+Shift+Q", action: onSignOut },
        {
          label: "About",
          action: () => window.alert("Meridian Voucher Studio v0.1.0"),
        },
      ],
    },
  ];

  // Filtering notices
  const filteredNotices = notices.filter(
    (n) => noticeFilter === "all" || n.type === noticeFilter,
  );

  return (
    <div
      className="app-menu-bar drag relative bg-surface border-b border-line shadow-sm"
      ref={menuBarRef}
    >
      {/* Left: Logo and Menus */}
      <div className="flex items-center gap-1 no-drag z-10">
        <div className="flex h-7 w-7 items-center justify-center rounded overflow-hidden ml-2 bg-cloud shadow-sm">
          <img src={logo} alt="Logo" className="h-full w-full object-contain" />
        </div>

        <div className="flex items-center ml-1">
          {menuItems.map((menu) => (
            <React.Fragment key={menu.label}>
              <div className="relative">
                <button
                  onClick={() => handleMenuClick(menu.label)}
                  onMouseEnter={() => handleMenuMouseEnter(menu.label)}
                  className={`flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded transition-colors ${
                    activeMenu === menu.label
                      ? "bg-cloud text-navy"
                      : "text-steel hover:bg-cloud hover:text-navy"
                  }`}
                >
                  {menu.label}
                </button>

                {isMenuOpen && activeMenu === menu.label && (
                  <div className="absolute left-0 top-full z-[1001] mt-1 min-w-[220px] rounded-lg border border-line bg-surface p-1 shadow-xl animate-in fade-in zoom-in-95 duration-75">
                    {menu.items.map((item, idx) =>
                      item.type === "separator" ? (
                        <div key={idx} className="my-1 border-t border-line" />
                      ) : (
                        <button
                          key={item.label}
                          onClick={() => handleItemClick(item.action)}
                          className="flex w-full items-center justify-between rounded-md px-3 py-1.5 text-left text-xs font-medium text-ink hover:bg-cloud hover:text-navy transition-colors"
                        >
                          <span className="flex items-center gap-2">
                            {item.label}
                          </span>
                          {item.shortcut && (
                            <span className="ml-4 text-[10px] text-steel/60">
                              {item.shortcut}
                            </span>
                          )}
                        </button>
                      ),
                    )}
                  </div>
                )}
              </div>
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* Loading / Buffering Icon */}
      {isLoading && (
        <div
          className="flex items-center justify-center ml-2 text-navy animate-spin no-drag"
          title="Loading state..."
        >
          <Loader2 size={16} />
        </div>
      )}

      {/* Center: Search */}
      <div className="flex-1 min-w-0 px-2 sm:px-4 max-w-xs no-drag transition-all">
        <div className="relative w-full">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 text-steel"
            size={13}
          />
          <input
            ref={searchInputRef}
            type="text"
            className="w-full min-w-[120px] rounded-lg border border-line bg-cloud py-1.5 pl-9 pr-4 text-xs outline-none focus:border-navy focus:bg-surface transition-all shadow-sm"
            placeholder="Search... (Ctrl+K)"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Right: Feedback & Controls */}
      <div className="ml-auto flex items-center gap-2 no-drag mr-2 z-10">
        <div className="relative" ref={noticeRef}>
          <button
            onClick={() => {
              setIsNoticesOpen(!isNoticesOpen);
              if (!isNoticesOpen) {
                setHasOpenedNotices(true);
              }
            }}
            className={`flex items-center gap-2 rounded-full border px-3 py-1.5 mr-2 transition-all hover:bg-surface active:scale-95 ${
              isNoticesOpen
                ? "bg-surface shadow-md border-navy/30 ring-2 ring-navy/10"
                : notices.length > 0
                  ? notices[0].type === "error"
                    ? "bg-rose-50 border-rose-200 text-rose-700 hover:border-rose-300"
                    : notices[0].type === "success"
                      ? "bg-emerald-50 border-emerald-200 text-emerald-700 hover:border-emerald-300"
                      : "bg-cloud border-line text-steel"
                  : "bg-cloud border-line text-steel"
            }`}
          >
            <div className={`relative flex items-center justify-center`}>
              <Bell
                size={14}
                className={
                  isNoticesOpen
                    ? "text-navy"
                    : notices.length > 0
                      ? notices[0].type === "error"
                        ? "text-rose-500"
                        : notices[0].type === "success"
                          ? "text-emerald-500"
                          : "text-steel"
                      : "text-steel"
                }
              />
              {notices.length > 0 && !hasOpenedNotices && !isNoticesOpen && (
                <span
                  className={`absolute -right-1 -top-1 flex h-2.5 w-2.5 items-center justify-center rounded-full text-[7px] font-bold text-white ring-[0.5px] ring-white ${
                    notices[0]?.type === "error"
                      ? "bg-rose-500"
                      : notices[0]?.type === "success"
                        ? "bg-emerald-500"
                        : "bg-slate-400"
                  }`}
                >
                  {notices.length}
                </span>
              )}
            </div>
            <span
              className={`text-[10px] font-bold truncate max-w-[130px] ${
                isNoticesOpen
                  ? "text-navy"
                  : notices.length > 0
                    ? notices[0].type === "error"
                      ? "text-rose-700"
                      : notices[0].type === "success"
                        ? "text-emerald-700"
                        : "text-steel"
                    : "text-steel"
              }`}
            >
              {notices[0]?.message || "No system alerts"}
            </span>
          </button>

          {isNoticesOpen && (
            <div className="absolute right-0 top-full z-[2000] mt-2 w-[340px] overflow-hidden rounded-xl border border-line bg-surface shadow-2xl animate-in fade-in slide-in-from-top-2 duration-200">
              {/* Header */}
              <div className="flex items-center justify-between bg-cloud px-4 py-3.5 border-b border-line">
                <h3 className="text-xs font-bold text-navy flex items-center gap-2">
                  <Bell size={14} className="text-navy" />
                  Alert Center
                </h3>
                {notices.length > 0 && (
                  <button
                    onClick={onClearAllNotices}
                    className="flex items-center gap-1 text-[10px] font-bold text-rose-600 hover:text-rose-700 transition-colors"
                  >
                    <Trash2 size={11} />
                    Dismiss All
                  </button>
                )}
              </div>

              {/* Advanced Filter Tab Bar */}
              <div className="flex border-b border-line/60 bg-cloud/30 p-1.5 gap-1">
                {(["all", "error", "success", "info"] as const).map(
                  (filter) => {
                    const filterCount =
                      filter === "all"
                        ? notices.length
                        : notices.filter((n) => n.type === filter).length;
                    return (
                      <button
                        key={filter}
                        type="button"
                        onClick={() => setNoticeFilter(filter)}
                        className={`flex-1 py-1 rounded text-[10px] font-bold uppercase transition-all tracking-wider ${
                          noticeFilter === filter
                            ? "bg-surface text-navy shadow-sm border border-line/80"
                            : "text-steel hover:text-navy hover:bg-cloud/50"
                        }`}
                      >
                        {filter} {filterCount > 0 && `(${filterCount})`}
                      </button>
                    );
                  },
                )}
              </div>

              {/* Notifications Container */}
              <div className="max-h-[380px] overflow-y-auto">
                {filteredNotices.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
                    <div className="h-12 w-12 rounded-full bg-cloud flex items-center justify-center mb-3 text-steel/30 shadow-inner">
                      <Bell size={22} />
                    </div>
                    <p className="text-xs font-bold text-navy">Clear skies!</p>
                    <p className="text-[10px] text-steel mt-1 max-w-[200px]">
                      No notifications matching your filters are currently
                      active.
                    </p>
                  </div>
                ) : (
                  <div className="divide-y divide-line/45">
                    {filteredNotices.map((n) => {
                      const isDocumentGen =
                        n.message.toLowerCase().includes("generated") ||
                        (n.message.toLowerCase().includes("saved") &&
                          (n.message.toLowerCase().includes("voucher") ||
                            n.message.toLowerCase().includes("draft")));

                      return (
                        <div
                          key={n.id}
                          className="group relative flex gap-3 p-4 hover:bg-cloud/30 transition-all"
                        >
                          <div
                            className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full shadow-sm ${
                              n.type === "error"
                                ? "bg-rose-50 text-rose-500 border border-rose-100"
                                : n.type === "success"
                                  ? "bg-emerald-50 text-emerald-500 border border-emerald-100"
                                  : "bg-blue-50 text-blue-500 border border-blue-100"
                            }`}
                          >
                            {n.type === "error" ? (
                              <AlertCircle size={13} />
                            ) : n.type === "success" ? (
                              <CheckCircle2 size={13} />
                            ) : (
                              <Info size={13} />
                            )}
                          </div>
                          <div className="flex-1 min-w-0 space-y-1.5">
                            <p className="text-xs font-semibold text-ink leading-relaxed break-words">
                              {n.message}
                            </p>

                            {/* Smart Productivity Quick Action */}
                            {isDocumentGen && (
                              <button
                                type="button"
                                onClick={() => {
                                  onNavigate("register");
                                  setIsNoticesOpen(false);
                                }}
                                className="flex items-center gap-1 text-[10px] font-bold text-navy hover:text-navy/80 transition-colors"
                              >
                                <FolderOpen size={11} />
                                <span>Inspect in Register</span>
                                <ArrowRight size={9} />
                              </button>
                            )}

                            <div className="flex items-center gap-1.5 text-[9px] text-steel font-bold">
                              <Clock size={10} className="text-steel/50" />
                              <span>{formatRelativeTime(n.timestamp)}</span>
                            </div>
                          </div>
                          <button
                            onClick={() => onClearNotice(n.id)}
                            className="opacity-0 group-hover:opacity-100 h-6 w-6 flex items-center justify-center rounded-md text-steel hover:bg-rose-50 hover:text-rose-600 transition-all self-start"
                            title="Dismiss Notice"
                          >
                            <X size={13} />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Window Controls */}
      <div className="flex items-stretch h-full no-drag z-10 self-stretch">
        <button
          onClick={() => window.meridian?.minimizeWindow()}
          className="w-11 flex items-center justify-center text-steel hover:bg-cloud transition-colors"
          aria-label="Minimize window"
          title="Minimize window"
        >
          <Minus size={14} />
        </button>
        <button
          onClick={() => window.meridian?.maximizeWindow()}
          className="w-11 flex items-center justify-center text-steel hover:bg-cloud transition-colors"
          aria-label="Maximize window"
          title="Maximize window"
        >
          <Square size={12} />
        </button>
        <button
          onClick={() => window.meridian?.closeWindow()}
          className="w-12 flex items-center justify-center text-steel hover:bg-red-500 hover:text-white transition-colors"
          aria-label="Close window"
          title="Close window"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
}
