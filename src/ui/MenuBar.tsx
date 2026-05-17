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
  Clock
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
}

export function MenuBar({ 
  searchQuery, 
  setSearchQuery, 
  notices,
  onClearNotice,
  onClearAllNotices,
  onNavigate,
  onSignOut,
  onReportIssue
}: MenuBarProps) {
  const searchInputRef = useRef<any>(null); // eslint-disable-line @typescript-eslint/no-explicit-any
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isNoticesOpen, setIsNoticesOpen] = useState(false);
  const menuBarRef = useRef<any>(null); // eslint-disable-line @typescript-eslint/no-explicit-any
  const noticeRef = useRef<any>(null); // eslint-disable-line @typescript-eslint/no-explicit-any

  // Expose search focus to window for shortcut Ctrl+K
  useEffect(() => {
    const handleFocusSearch = () => searchInputRef.current?.focus();
    window.addEventListener("focus-search", handleFocusSearch);
    return () => window.removeEventListener("focus-search", handleFocusSearch);
  }, []);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: any) => { // eslint-disable-line @typescript-eslint/no-explicit-any
      if (menuBarRef.current && !menuBarRef.current.contains(event.target)) {
        setIsMenuOpen(false);
        setActiveMenu(null);
      }
      if (noticeRef.current && !noticeRef.current.contains(event.target)) {
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
        { label: "New Voucher", shortcut: "Ctrl+N", action: () => onNavigate("entry") },
        { label: "Save Voucher", shortcut: "Ctrl+S", action: () => {} },
        { type: "separator" },
        { label: "Exit", action: () => window.meridian?.closeWindow() }
      ] 
    },
    { 
      label: "Edit", 
      items: [
        { label: "Undo", shortcut: "Ctrl+Z" },
        { label: "Redo", shortcut: "Ctrl+Y" },
        { type: "separator" },
        { label: "Rate Master", shortcut: "Ctrl+R", action: () => onNavigate("rate-master") },
        { label: "Voucher Register", shortcut: "Ctrl+H", action: () => onNavigate("register") },
        { type: "separator" },
        { label: "Search", shortcut: "Ctrl+K", action: () => searchInputRef.current?.focus() }
      ] 
    },
    { 
      label: "View", 
      items: [
        { label: "Reload", shortcut: "Ctrl+R", action: () => window.location.reload() },
        { label: "Toggle DevTools", shortcut: "F12" },
        { type: "separator" },
        { label: "Dashboard", shortcut: "Ctrl+D", action: () => onNavigate("dashboard") },
        { label: "Profile", shortcut: "Ctrl+P", action: () => onNavigate("profile") },
        { label: "Settings", shortcut: "Ctrl+,", action: () => onNavigate("settings") }
      ] 
    },
    { 
      label: "Help", 
      items: [
        { label: "Report Issue", action: onReportIssue },
        { label: "Privacy Statement", action: () => {} },
        { label: "Check for Updates", action: () => {} },
        { type: "separator" },
        { label: "Sign Out", shortcut: "Ctrl+Shift+Q", action: onSignOut },
        { label: "About", action: () => window.alert("Meridian Voucher Studio v0.1.0") }
      ] 
    },
  ];

  return (
    <div className="app-menu-bar drag relative" ref={menuBarRef}>
      {/* Left: Logo and Menus */}
      <div className="flex items-center gap-1 no-drag z-10">
        <div className="flex h-7 w-7 items-center justify-center rounded overflow-hidden ml-2 bg-cloud">
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
                    activeMenu === menu.label ? "bg-cloud text-navy" : "text-steel hover:bg-cloud hover:text-navy"
                  }`}
                >
                  {menu.label}
                </button>
                
                {isMenuOpen && activeMenu === menu.label && (
                  <div className="absolute left-0 top-full z-[1001] mt-1 min-w-[220px] rounded-lg border border-line bg-surface p-1 shadow-xl animate-in fade-in zoom-in-95 duration-75">
                    {menu.items.map((item, idx) => (
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
                            <span className="ml-4 text-[10px] text-steel/60">{item.shortcut}</span>
                          )}
                        </button>
                      )
                    ))}
                  </div>
                )}
              </div>
            </React.Fragment>
          ))}
          
        </div>
      </div>

      {/* Center: Search */}
      <div className="flex-1 min-w-0 px-2 sm:px-4 max-w-xs no-drag transition-all">
        <div className="relative w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-steel" size={13} />
          <input
            ref={searchInputRef}
            type="text"
            className="w-full min-w-[120px] rounded-lg border border-line bg-cloud py-1 pl-9 pr-4 text-xs outline-none focus:border-navy focus:bg-surface transition-all shadow-sm"
            placeholder="Search... (Ctrl+K)"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Right: Feedback & Controls */}
      <div className="ml-auto flex items-center gap-2 no-drag pr-2 z-10">
        <div className="relative" ref={noticeRef}>
          <button
            onClick={() => setIsNoticesOpen(!isNoticesOpen)}
            className={`flex items-center gap-2 rounded-full border border-line px-3 py-1 mr-2 transition-all hover:bg-surface active:scale-95 ${
              isNoticesOpen ? "bg-surface shadow-sm border-navy/30" : "bg-cloud"
            }`}
          >
            <div className={`relative flex items-center justify-center`}>
              <Bell size={14} className={notices.length > 0 ? "text-navy" : "text-steel"} />
              {notices.length > 0 && (
                <span className="absolute -right-1 -top-1 flex h-3 w-3 items-center justify-center rounded-full bg-red-500 text-[8px] font-bold text-white">
                  {notices.length}
                </span>
              )}
            </div>
            <span className="text-[10px] font-bold text-steel truncate max-w-[100px]">
              {notices[0]?.message || "No notifications"}
            </span>
          </button>

          {isNoticesOpen && (
            <div className="absolute right-0 top-full z-[2000] mt-2 w-80 overflow-hidden rounded-xl border border-line bg-surface shadow-2xl animate-in fade-in slide-in-from-top-2 duration-200">
              <div className="flex items-center justify-between bg-cloud px-4 py-3 border-b border-line">
                <h3 className="text-xs font-bold text-navy flex items-center gap-2">
                  <Bell size={13} />
                  Notifications
                </h3>
                {notices.length > 0 && (
                  <button 
                    onClick={onClearAllNotices}
                    className="text-[10px] font-bold text-steel hover:text-red-500 transition-colors"
                  >
                    Clear All
                  </button>
                )}
              </div>
              
              <div className="max-h-[400px] overflow-y-auto">
                {notices.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
                    <div className="h-12 w-12 rounded-full bg-cloud flex items-center justify-center mb-3">
                      <Bell size={24} className="text-steel/30" />
                    </div>
                    <p className="text-xs font-semibold text-steel">No notifications yet</p>
                    <p className="text-[10px] text-steel/60 mt-1">Status updates and alerts will appear here.</p>
                  </div>
                ) : (
                  <div className="divide-y divide-line/50">
                    {notices.map((n) => (
                      <div key={n.id} className="group relative flex gap-3 p-4 hover:bg-cloud/50 transition-colors">
                        <div className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${
                          n.type === "error" ? "bg-red-50 text-red-500" :
                          n.type === "success" ? "bg-emerald-50 text-emerald-500" :
                          "bg-blue-50 text-blue-500"
                        }`}>
                          {n.type === "error" ? <AlertCircle size={14} /> :
                           n.type === "success" ? <CheckCircle2 size={14} /> :
                           <Info size={14} />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-navy leading-relaxed break-words">
                            {n.message}
                          </p>
                          <div className="mt-1 flex items-center gap-2 text-[9px] text-steel/60 font-semibold">
                            <Clock size={10} />
                            {new Date(n.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </div>
                        <button 
                          onClick={() => onClearNotice(n.id)}
                          className="opacity-0 group-hover:opacity-100 h-6 w-6 flex items-center justify-center rounded-md text-steel hover:bg-red-500/10 hover:text-red-500 transition-all"
                          title="Dismiss"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Window Controls */}
        <div className="flex items-center">
          <button 
            onClick={() => window.meridian?.minimizeWindow()}
            className="h-8 w-10 flex items-center justify-center text-steel hover:bg-cloud transition-colors"
            aria-label="Minimize window"
            title="Minimize window"
          >
            <Minus size={14} />
          </button>
          <button 
            onClick={() => window.meridian?.maximizeWindow()}
            className="h-8 w-10 flex items-center justify-center text-steel hover:bg-cloud transition-colors"
            aria-label="Maximize window"
            title="Maximize window"
          >
            <Square size={12} />
          </button>
          <button 
            onClick={() => window.meridian?.closeWindow()}
            className="h-8 w-12 flex items-center justify-center text-steel hover:bg-red-500 hover:text-white transition-colors"
            aria-label="Close window"
            title="Close window"
          >
            <X size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
