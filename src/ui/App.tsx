import {
  FileDown,
  FileText,
  History,
  Hotel,
  LayoutDashboard,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  ReceiptText,
  RotateCcw,
  Save,
  Settings,
  Trash2,
  UserCircle,
  ChevronLeft,
  Minus,
  Maximize2,
  ChevronDown,
  Check
} from "lucide-react";
import React, { useDeferredValue, useEffect, useMemo, useState, useRef } from "react";
import logo from "../assets/logo.png";
import { Controller, useFieldArray, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { defaultVoucher } from "../domain/defaultVoucher";
import { hotels as fallbackHotels, markets as fallbackMarkets, mealBasisOptions, roomCategories as fallbackRoomCategories, tourTypes } from "../domain/referenceData";
import type { HotelRef, MarketRef, RoomCategoryRef, CustomerRef, TourTypeRef, MealBasisRef } from "../../electron/shared/types";
import { VoucherFormValues, voucherSchema } from "../domain/voucherSchema";
import { AuthScreen } from "./AuthScreen";
import { GeneratedFilesPanel } from "./AppPanels";
import { HotelRateMasterScreen } from "./HotelRateMasterScreen";
import { ManageRatesScreen } from "./ManageRatesScreen";
import { DashboardScreen } from "./DashboardScreen";
import { SettingsScreen } from "./SettingsScreen";
import { ProfileScreen } from "./ProfileScreen";
import { TourExplorerPanel } from "./TourExplorerPanel";
import { MenuBar, AppNotification } from "./MenuBar";
import { Button } from "./ui-kit/Button";
import { Field } from "./ui-kit/Field";
import { Select } from "./ui-kit/Inputs";
import { Panel } from "./ui-kit/Panel";
import { friendlyErrorMessage } from "./errors";
import type {
  AccountProfile,
  AuthState,
  FolderTreeNode,
  GeneratedDocument,
  HotelRateRecordSummary,
  VoucherListFilters,
  VoucherDocumentRecord,
  VoucherRevisionRecord,
  VoucherRecord,
  VoucherStatus,
  WorkspaceSearchResult
} from "../../electron/shared/types";

type ActionState = "idle" | "saving" | "generating-docx" | "generating-pdf";
type ActiveView = "entry" | "dashboard" | "register" | "rate-master" | "manage-rates" | "settings" | "profile";


function withAccountDefaults(values: VoucherFormValues, profile: { employeeName: string; employeeEmail: string } | null): VoucherFormValues {
  if (!profile) {
    return values;
  }

  return {
    ...values,
    employeeName: profile.employeeName || values.employeeName,
    employeeEmail: profile.employeeEmail || values.employeeEmail
  };
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="text-xs font-medium text-red-700">{message}</p>;
}

const voucherStatusOptions = [
  { value: "all", label: "All" },
  { value: "draft", label: "Draft" },
  { value: "generated", label: "Generated" },
  { value: "sent", label: "Sent" }
] as const;

const voucherTypes = [
  { value: "reservation", label: "Reservation", description: "Hotel booking voucher", icon: Hotel },
  { value: "amendment", label: "Amendment", description: "Change existing booking", icon: ReceiptText },
  { value: "pptp", label: "PPTP", description: "Point-to-point transport", icon: FileDown }
] as const;

const lineItemColumns = [
  { name: "requiredDate", type: "date", className: "min-w-[150px]" },
  { name: "roomCategory", type: "select-room-category", className: "min-w-[170px]" },
  { name: "basis", type: "select-basis", className: "min-w-[96px]" },
  { name: "singleRooms", type: "number", className: "min-w-[76px]" },
  { name: "doubleRooms", type: "number", className: "min-w-[76px]" },
  { name: "twinRooms", type: "number", className: "min-w-[76px]" },
  { name: "tripleRooms", type: "number", className: "min-w-[76px]" },
  { name: "child2_5Sharing", type: "number", className: "min-w-[66px]" },
  { name: "child2_5Bed", type: "number", className: "min-w-[66px]" },
  { name: "child2_5OwnRoom", type: "number", className: "min-w-[66px]" },
  { name: "child6_11Sharing", type: "number", className: "min-w-[66px]" },
  { name: "child6_11Bed", type: "number", className: "min-w-[66px]" },
  { name: "child6_11OwnRoom", type: "number", className: "min-w-[66px]" },
  { name: "guide", type: "number", className: "min-w-[76px]" },
  { name: "guideBasis", type: "select-basis", className: "min-w-[96px]" },
  { name: "supplementary", type: "select-supplementary", className: "min-w-[130px]" },
  { name: "arrivingFor", type: "text", className: "min-w-[150px]" }
] as const;

const tableControlClass = "app-table-control";
const roomCountFields = new Set([
  "singleRooms",
  "doubleRooms",
  "twinRooms",
  "tripleRooms",
  "child2_5Sharing",
  "child2_5Bed",
  "child2_5OwnRoom",
  "child6_11Sharing",
  "child6_11Bed",
  "child6_11OwnRoom",
  "guide"
]);

function SupplementaryDropdown({
  value,
  onChange,
  options
}: {
  value: string[];
  onChange: (val: string[]) => void;
  options: { name: string; label: string }[]
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const display = value.length > 0
    ? value.map(v => v.slice(0, 2)).join(", ")
    : "Select";

  return (
    <div className="relative w-full" ref={ref}>
      <div className="app-select-shell w-full animate-in fade-in duration-100" data-open={open}>
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="app-select app-select-with-chevron w-full app-select-compact app-table-control text-left truncate pr-8 cursor-pointer select-none bg-surface"
          title={value.join(", ")}
        >
          {display}
        </button>
        <ChevronDown size={16} className="app-select-chevron" />
      </div>
      {open && (
        <div className="absolute top-full left-0 mt-1 w-56 bg-surface border border-line shadow-lg rounded-app z-[100] max-h-56 overflow-y-auto thin-scrollbar p-1 animate-in fade-in slide-in-from-top-1 duration-150">
          {options.length === 0 ? (
            <div className="p-3 text-xs text-steel text-center select-none font-medium">No supplements</div>
          ) : (
            options.map((opt) => {
              const isSelected = value.includes(opt.name);
              return (
                <div
                  key={opt.name}
                  onClick={() => {
                    if (isSelected) onChange(value.filter(v => v !== opt.name));
                    else onChange([...value, opt.name]);
                  }}
                  className="flex items-center gap-2 px-3 py-2 hover:bg-cloud cursor-pointer text-xs rounded transition-colors select-none text-ink font-medium"
                >
                  <div className={`h-4 w-4 rounded border flex items-center justify-center transition-all shrink-0 ${isSelected
                      ? "border-navy bg-navy text-white animate-in zoom-in-95 duration-100"
                      : "border-line bg-surface text-transparent"
                    }`}>
                    {isSelected && <Check size={11} strokeWidth={3} className="shrink-0" />}
                  </div>
                  <span className="truncate" title={opt.label}>{opt.label}</span>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

export function App() {
  const [activeTheme, setActiveTheme] = useState<"light" | "dark" | "system">("system");
  const [systemIsDark, setSystemIsDark] = useState(() => window.matchMedia("(prefers-color-scheme: dark)").matches);

  // Load theme on startup
  useEffect(() => {
    if (window.meridian?.getSettings) {
      void window.meridian.getSettings().then((settings) => {
        if (settings?.theme) {
          setActiveTheme(settings.theme as "light" | "dark" | "system");
        }
      });
    }
  }, []);

  // Listen to system preference changes
  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleSystemThemeChange = (e: MediaQueryListEvent) => {
      setSystemIsDark(e.matches);
    };
    mediaQuery.addEventListener("change", handleSystemThemeChange);
    return () => mediaQuery.removeEventListener("change", handleSystemThemeChange);
  }, []);

  const isDark = activeTheme === "dark" || (activeTheme === "system" && systemIsDark);
  const themeClass = isDark ? "dark" : "light";

  const [activeView, setActiveView] = useState<ActiveView>("dashboard");
  const [actionState, setActionState] = useState<ActionState>("idle");
  const [previewMode, setPreviewMode] = useState<"collapsed" | "thumbnail" | "expanded">("thumbnail");
  const [previewPos, setPreviewPos] = useState(() => ({ x: 8, y: Math.max(8, window.innerHeight / 2 - 224) }));
  const [isDraggingPreview, setIsDraggingPreview] = useState(false);
  const dragStartRef = useRef({ mouseX: 0, mouseY: 0, startX: 0, startY: 0 });
  const [windowSize, setWindowSize] = useState({ width: window.innerWidth, height: window.innerHeight });



  const startDragPreview = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDraggingPreview(true);
    dragStartRef.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      startX: previewPos.x,
      startY: previewPos.y
    };

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const dx = moveEvent.clientX - dragStartRef.current.mouseX;
      const dy = moveEvent.clientY - dragStartRef.current.mouseY;
      setPreviewPos({
        x: dragStartRef.current.startX + dx,
        y: dragStartRef.current.startY + dy
      });
    };

    const handleMouseUp = () => {
      setIsDraggingPreview(false);
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  };
  const [generated, setGenerated] = useState<GeneratedDocument | null>(null);
  const [documentHistory, setDocumentHistory] = useState<VoucherDocumentRecord[]>([]);
  const [voucherRevisions, setVoucherRevisions] = useState<VoucherRevisionRecord[]>([]);
  const [voucherRegister, setVoucherRegister] = useState<VoucherRecord[]>([]);
  const [voucherFilters, setVoucherFilters] = useState<VoucherListFilters>({ status: "all", dateFrom: "", dateTo: "", query: "" });
  const [isLoadingRegister, setIsLoadingRegister] = useState(false);
  const [openingVoucherId, setOpeningVoucherId] = useState<string | null>(null);
  const [statusUpdatingId, setStatusUpdatingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const [searchResults, setSearchResults] = useState<WorkspaceSearchResult>({ vouchers: [], documents: [] });
  const [isSearching, setIsSearching] = useState(false);
  const [notices, setNotices] = useState<AppNotification[]>([]);
  const addNotice = (message: string, type: AppNotification["type"] = "info") => {
    const id = Math.random().toString(36).substring(2, 9);
    setNotices(prev => [{ id, message, type, timestamp: Date.now() }, ...prev].slice(0, 50));
  };
  const clearNotice = (id: string) => setNotices(prev => prev.filter(n => n.id !== id));
  const clearAllNotices = () => setNotices([]);
  const accountMenuRef = useRef<any>(null); // eslint-disable-line @typescript-eslint/no-explicit-any
  const [showReportIssue, setShowReportIssue] = useState(false);
  const [accountProfile, setAccountProfile] = useState<AccountProfile | null>(null);
  const [authState, setAuthState] = useState<AuthState>({ isAuthenticated: false, profile: null });
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [hotelOptions, setHotelOptions] = useState<string[]>([]);
  const [marketOptions, setMarketOptions] = useState<readonly string[]>([]);
  const [roomCategoryOptions, setRoomCategoryOptions] = useState<readonly string[]>([]);
  const [customerOptions, setCustomerOptions] = useState<string[]>([]); // eslint-disable-line @typescript-eslint/no-unused-vars
  const [tourTypeOptions, setTourTypeOptions] = useState<readonly string[]>([]);
  const [mealBasisOptionsState, setMealBasisOptionsState] = useState<readonly string[]>([]);
  const [selectedHotelRateId, setSelectedHotelRateId] = useState<string>("");
  const [toursFolderPath, setToursFolderPath] = useState<string | null>(null);
  const [toursFolderTree, setToursFolderTree] = useState<FolderTreeNode[]>([]);
  const [toursFolderExists, setToursFolderExists] = useState<boolean>(true);
  const [isLoadingTree, setIsLoadingTree] = useState(false);
  const [isMigrating, setIsMigrating] = useState(false);
  const [navCollapsed, setNavCollapsed] = useState(false);
  const [explorerCollapsed, setExplorerCollapsed] = useState(false);
  const [hotelContracts, setHotelContracts] = useState<HotelRateRecordSummary[]>([]);
  const [availableSupplements, setAvailableSupplements] = useState<{ supplement_name: string; room_category: string; supplement_amount: number; per: string; }[]>([]);
  const [manualRates, setManualRates] = useState(false);
  const [editHotelRateId, setEditHotelRateId] = useState<string | undefined>();
  const [showAccountMenu, setShowAccountMenu] = useState(false);

  const form = useForm<VoucherFormValues>({
    resolver: zodResolver(voucherSchema),
    defaultValues: defaultVoucher,
    mode: "onChange"
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "lineItems"
  });

  useEffect(() => {
    const handleResize = () => {
      const w = window.innerWidth;
      setWindowSize({ width: w, height: window.innerHeight });
      if (w < 1024) {
        setNavCollapsed(true);
      }
      if (w < 1280) {
        setExplorerCollapsed(true);
      }
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Use native Event
  useEffect(() => {
    if (!window.meridian) return;
    const unsubNavigate = window.meridian.onMenuNavigate((view: string) => setActiveView(view as ActiveView));
    const unsubSearch = window.meridian.onMenuSearchFocus(() => {
      window.dispatchEvent(new window.Event("focus-search"));
    });
    const unsubSave = window.meridian.onMenuSaveVoucher(() => {
      void form.handleSubmit(handleSave)();
    });
    const unsubPdf = window.meridian.onMenuGeneratePdf(() => {
      void form.handleSubmit(handleGeneratePdf)();
    });
    const unsubDocx = window.meridian.onMenuGenerateDocx(() => {
      void form.handleSubmit(handleGenerateDocx)();
    });
    const unsubSignOut = window.meridian.onMenuSignOut(() => void handleSignOut());

    return () => {
      unsubNavigate();
      unsubSearch();
      unsubSave();
      unsubPdf();
      unsubDocx();
      unsubSignOut();
    };
  }, [form]);


  const lineItems = useWatch({
    control: form.control,
    name: "lineItems",
    defaultValue: defaultVoucher.lineItems
  }) as VoucherFormValues["lineItems"];

  const hotelName = form.watch("hotelName");
  const market = form.watch("market");
  const ratePeriod = form.watch("ratePeriod");
  const customerName = form.watch("customerName");
  const tourType = form.watch("tourType");
  const voucherType = form.watch("voucherType");
  const dailyRooms = useMemo(() => {
    const grouped = new Map<string, { rooms: number; children: number }>();
    for (const item of lineItems) {
      if (!item.requiredDate) continue;
      const rooms =
        Number(item.singleRooms || 0) +
        Number(item.doubleRooms || 0) +
        Number(item.twinRooms || 0) +
        Number(item.tripleRooms || 0);

      const children =
        Number(item.child2_5 || 0) +
        Number(item.child2_5Sharing || 0) +
        Number(item.child2_5Bed || 0) +
        Number(item.child2_5OwnRoom || 0) +
        Number(item.child6_11 || 0) +
        Number(item.child6_11Sharing || 0) +
        Number(item.child6_11Bed || 0) +
        Number(item.child6_11OwnRoom || 0);

      if (rooms > 0 || children > 0) {
        const existing = grouped.get(item.requiredDate) || { rooms: 0, children: 0 };
        grouped.set(item.requiredDate, {
          rooms: existing.rooms + rooms,
          children: existing.children + children
        });
      }
    }

    return Array.from(grouped.entries())
      .map(([date, counts]) => ({ date, ...counts }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [lineItems]);

  const uniqueContractNames = useMemo(() => {
    const names = new Set(hotelContracts.map((c) => c.contract_name));
    return Array.from(names).sort();
  }, [hotelContracts]);

  useEffect(() => {
    if (hotelName) {
      void window.meridian?.listHotelRates(hotelName).then(setHotelContracts);
    } else {
      setHotelContracts([]);
    }
  }, [hotelName]);

  useEffect(() => {
    if (hotelName && ratePeriod && hotelContracts.length > 0) {
      const match = hotelContracts.find((c) => c.contract_name === ratePeriod);
      if (match && match.id) {
        window.meridian?.getHotelRates(match.id).then((rate) => {
          setAvailableSupplements(rate.room_supplements || []);
        });
      } else {
        setAvailableSupplements([]);
      }
    } else {
      setAvailableSupplements([]);
    }
  }, [hotelName, ratePeriod, hotelContracts]);



  useEffect(() => {
    if (!window.meridian?.getAuthState) {
      setIsCheckingAuth(false);
      return;
    }

    void window.meridian
      .getAuthState()
      .then((state) => {
        setAuthState(state);
        setAccountProfile(state.profile);
        form.reset(withAccountDefaults(form.getValues(), state.profile));
      })
      .finally(() => setIsCheckingAuth(false));
  }, [form]);

  useEffect(() => {
    if (!authState.isAuthenticated || !window.meridian?.listVoucherDocuments) {
      setDocumentHistory([]);
      return;
    }

    void window.meridian
      .listVoucherDocuments()
      .then(setDocumentHistory)
      .catch((error) => {
        addNotice(friendlyErrorMessage(error, "Unable to load document history"));
      });
  }, [authState.isAuthenticated]);

  useEffect(() => {
    if (!authState.isAuthenticated) {
      setHotelOptions([]);
      setMarketOptions([]);
      setRoomCategoryOptions([]);
      setCustomerOptions([]);
      setTourTypeOptions([]);
      setMealBasisOptionsState([]);
      return;
    }

    // Load hotels from API
    if (window.meridian?.listHotels) {
      void window.meridian.listHotels()
        .then((refs: HotelRef[]) => {
          const names = refs.map((h) => h.name).filter(Boolean);
          setHotelOptions(names.sort((a, b) => a.localeCompare(b)));
        })
        .catch(() => setHotelOptions([]));
    }

    // Load markets from API
    if (window.meridian?.listMarkets) {
      void window.meridian.listMarkets()
        .then((refs: MarketRef[]) => {
          const codes = refs.map((m) => m.code).filter(Boolean);
          setMarketOptions(codes);
        })
        .catch(() => setMarketOptions([]));
    }

    // Load room categories from API
    if (window.meridian?.listRoomCategories) {
      void window.meridian.listRoomCategories()
        .then((refs: RoomCategoryRef[]) => {
          const names = refs.map((r) => r.name).filter(Boolean);
          setRoomCategoryOptions(names);
        })
        .catch(() => setRoomCategoryOptions([]));
    }

    // Load customers from API
    if (window.meridian?.listCustomers) {
      void window.meridian.listCustomers()
        .then((refs: CustomerRef[]) => setCustomerOptions(refs.map((c) => c.name).filter(Boolean)))
        .catch(() => setCustomerOptions([]));
    }

    // Load tour types from API
    if (window.meridian?.listTourTypes) {
      void window.meridian.listTourTypes()
        .then((refs: TourTypeRef[]) => {
          const codes = refs.map((t) => t.code).filter(Boolean);
          setTourTypeOptions(codes);
        })
        .catch(() => setTourTypeOptions([]));
    }

    // Load meal basis from API
    if (window.meridian?.listMealBasis) {
      void window.meridian.listMealBasis()
        .then((refs: MealBasisRef[]) => {
          const codes = refs.map((b) => b.code).filter(Boolean);
          setMealBasisOptionsState(codes);
        })
        .catch(() => setMealBasisOptionsState([]));
    }
  }, [authState.isAuthenticated, activeView]);

  useEffect(() => {
    if (!authState.isAuthenticated || !window.meridian?.listVouchers) {
      setVoucherRegister([]);
      return;
    }

    void refreshVoucherRegister(voucherFilters);
  }, [authState.isAuthenticated]);

  useEffect(() => {
    if (!authState.isAuthenticated || !window.meridian?.getToursFolder) return;

    void window.meridian.getToursFolder().then((folderPath) => {
      setToursFolderPath(folderPath);
      if (folderPath) {
        void refreshToursFolderTree();
      }
    });
  }, [authState.isAuthenticated]);

  async function refreshToursFolderTree() {
    if (!window.meridian?.getToursFolderTree) return;

    setIsLoadingTree(true);
    try {
      const tree = await window.meridian.getToursFolderTree();
      setToursFolderTree(tree);
      setToursFolderExists(true);
    } catch {
      setToursFolderExists(false);
      setToursFolderTree([]);
      addNotice("Tours root folder not found or inaccessible");
    } finally {
      setIsLoadingTree(false);
    }
  }

  useEffect(() => {
    if (!authState.isAuthenticated || !window.meridian?.searchWorkspace) {
      setSearchResults({ vouchers: [], documents: [] });
      setIsSearching(false);
      return;
    }

    const query = deferredSearchQuery.trim();
    if (!query) {
      setSearchResults({ vouchers: [], documents: [] });
      setIsSearching(false);
      return;
    }

    let isCancelled = false;
    setIsSearching(true);

    const timeoutId = window.setTimeout(() => {
      void window.meridian
        .searchWorkspace(query)
        .then((results) => {
          if (!isCancelled) {
            setSearchResults(results);
          }
        })
        .catch((error) => {
          if (!isCancelled) {
            addNotice(friendlyErrorMessage(error, "Unable to search workspace"));
          }
        })
        .finally(() => {
          if (!isCancelled) {
            setIsSearching(false);
          }
        });
    }, 180);

    return () => {
      isCancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [authState.isAuthenticated, deferredSearchQuery]);

  async function refreshDocumentHistory() {
    if (!window.meridian?.listVoucherDocuments) {
      return;
    }

    try {
      const history = await window.meridian.listVoucherDocuments();
      setDocumentHistory(history);
    } catch (error) {
      addNotice(friendlyErrorMessage(error, "Unable to load document history"));
    }
  }

  async function refreshVoucherRegister(nextFilters: VoucherListFilters = voucherFilters) {
    if (!window.meridian?.listVouchers) {
      return;
    }

    setIsLoadingRegister(true);
    try {
      const vouchers = await window.meridian.listVouchers(nextFilters);
      setVoucherRegister(vouchers);
    } catch (error) {
      addNotice(friendlyErrorMessage(error, "Unable to load vouchers"));
    } finally {
      setIsLoadingRegister(false);
    }
  }

  async function refreshVoucherRevisions(voucherId: string) {
    if (!window.meridian?.listVoucherRevisions) {
      return;
    }

    try {
      const revisions = await window.meridian.listVoucherRevisions(voucherId);
      setVoucherRevisions(revisions);
    } catch (error) {
      addNotice(friendlyErrorMessage(error, "Unable to load voucher history"));
    }
  }

  function handleAuthenticated(state: AuthState) {
    setAuthState(state);
    setAccountProfile(state.profile);
    form.reset(withAccountDefaults(defaultVoucher, state.profile));
    addNotice("Logged in");
  }

  async function handleSignOut() {
    if (!window.meridian) {
      return;
    }

    const state = await window.meridian.signOut();
    setAuthState(state);
    setAccountProfile(null);
    setGenerated(null);
    setDocumentHistory([]);
    setVoucherRevisions([]);
    form.reset(defaultVoucher);
  }

  async function handleSave(values: VoucherFormValues) {
    if (!window.meridian) {
      addNotice("Desktop bridge unavailable; restart the application");
      return;
    }

    setActionState("saving");
    try {
      const result = await window.meridian.saveVoucher(values);
      addNotice(`Draft saved successfully (${result.id.slice(0, 8)})`);
      form.setValue("id", result.id);
      await refreshVoucherRevisions(result.id);
      await refreshVoucherRegister(voucherFilters);
    } catch (error) {
      addNotice(friendlyErrorMessage(error, "Unable to save voucher"));
    } finally {
      setActionState("idle");
    }
  }

  async function handleGenerateDocx(values: VoucherFormValues) {
    if (!window.meridian) {
      addNotice("Desktop bridge unavailable; restart the application");
      return;
    }

    setActionState("generating-docx");
    try {
      const result = window.meridian.generateDocx
        ? await window.meridian.generateDocx(values)
        : await window.meridian.generateDocuments!(values);
      setGenerated(result);
      if (result.voucherId) {
        form.setValue("id", result.voucherId);
        await refreshVoucherRevisions(result.voucherId);
      }
      addNotice("DOCX generated");
      await refreshDocumentHistory();
      await refreshVoucherRegister(voucherFilters);
      await refreshToursFolderTree();
    } catch (error) {
      addNotice(friendlyErrorMessage(error, "Unable to generate DOCX"));
    } finally {
      setActionState("idle");
    }
  }

  async function handleGeneratePdf(values: VoucherFormValues) {
    if (!window.meridian) {
      addNotice("Desktop bridge unavailable; restart the application");
      return;
    }

    setActionState("generating-pdf");
    try {
      const result = window.meridian.generatePdf
        ? await window.meridian.generatePdf(values)
        : await window.meridian.generateDocuments!(values);
      setGenerated(result);
      if (result.voucherId) {
        form.setValue("id", result.voucherId);
        await refreshVoucherRevisions(result.voucherId);
      }
      addNotice("PDF generated");
      await refreshDocumentHistory();
      await refreshVoucherRegister(voucherFilters);
      await refreshToursFolderTree();
    } catch (error) {
      addNotice(friendlyErrorMessage(error, "Unable to generate PDF"));
    } finally {
      setActionState("idle");
    }
  }

  async function handleVoucherStatusUpdate(voucherId: string, status: VoucherStatus) {
    if (!window.meridian?.updateVoucherStatus) {
      addNotice("Voucher status update is unavailable; restart the application");
      return;
    }

    setStatusUpdatingId(voucherId);
    try {
      const result = await window.meridian.updateVoucherStatus(voucherId, status);
      addNotice(`Voucher marked as ${result.status}`);
      await refreshVoucherRevisions(voucherId);
      await refreshVoucherRegister(voucherFilters);
    } catch (error) {
      addNotice(friendlyErrorMessage(error, "Unable to update voucher status"));
    } finally {
      setStatusUpdatingId(null);
    }
  }

  async function openVoucherFromSearch(voucher: VoucherRecord) {
    if (!window.meridian?.getVoucher) {
      addNotice("Voucher loading is unavailable; restart the application");
      return;
    }

    setOpeningVoucherId(voucher.id);
    try {
      const fullVoucher = await window.meridian.getVoucher(voucher.id);
      form.reset(withAccountDefaults({ ...defaultVoucher, ...fullVoucher } as VoucherFormValues, accountProfile));
      await refreshVoucherRevisions(voucher.id);
      setActiveView("entry");
      setGenerated(null);
      addNotice(`Loaded voucher ${voucher.requisitionNo || voucher.tourNo || voucher.id.slice(0, 8)}`);
    } catch (error) {
      addNotice(friendlyErrorMessage(error, "Unable to load voucher"));
    } finally {
      setOpeningVoucherId(null);
    }
  }

  async function handleSelectToursFolder() {
    if (!window.meridian?.selectToursFolder) {
      addNotice("Tours folder selection unavailable; restart the application");
      return;
    }

    try {
      const result = await window.meridian.selectToursFolder();
      if (result) {
        setToursFolderPath(result.path);
        setToursFolderExists(true);
        addNotice(`Tours folder set: ${result.path}`);
        await refreshToursFolderTree();
      }
    } catch {
      addNotice("Unable to select Tours folder");
    }
  }

  async function handleMigrateVouchers() {
    if (!window.meridian?.migrateVouchersToTours) return;

    setIsMigrating(true);
    try {
      const result = await window.meridian.migrateVouchersToTours();
      if (result.moved > 0) {
        addNotice(`Migrated ${result.moved} voucher(s)`);
      } else {
        addNotice("No vouchers to migrate");
      }
      if (result.errors.length > 0) {
        addNotice(`Migration: ${result.moved} moved, ${result.failed} failed`);
      }
      await refreshToursFolderTree();
    } catch {
      addNotice("Migration failed");
    } finally {
      setIsMigrating(false);
    }
  }

  function handleRevealFile(filePath: string) {
    if (window.meridian?.revealInExplorer) {
      void window.meridian.revealInExplorer(filePath);
    }
  }

  function handleClearForm() {
    form.reset(withAccountDefaults(defaultVoucher, accountProfile));
    setGenerated(null);
    setVoucherRevisions([]);
    addNotice("Form cleared");
  }

  useEffect(() => {
    if (!hotelName || !window.meridian?.autoFillVoucher || manualRates) return;

    const timer = window.setTimeout(async () => {
      try {
        const values = form.getValues();
        const result = await window.meridian.autoFillVoucher(values, selectedHotelRateId || undefined);

        if (result.status === "matched") {
          form.setValue("rateApplicableText", result.rateApplicableText || "");
          form.setValue("matchedHotelRateId", result.matchedHotelRateId ?? "");
          if (result.billingInstructions) form.setValue("billingInstructions", result.billingInstructions);
        } else if (result.status === "multiple" && result.candidateHotelRates?.length) {
          form.setValue("rateApplicableText", "");
          form.setValue("matchedHotelRateId", "");
        } else {
          form.setValue("rateApplicableText", "");
        }
      } catch {
        // Ignored for now
      }
    }, 400);

    return () => window.clearTimeout(timer);
  }, [lineItems, hotelName, market, ratePeriod, form, selectedHotelRateId, manualRates]);

  useEffect(() => {
    if (!customerName || !tourType) return;
    if (form.formState.dirtyFields.tourName) return;

    const firstDate = lineItems.map(li => li.requiredDate).filter(Boolean).sort()[0];
    let dateStr = "";
    if (firstDate) {
      const d = new Date(firstDate);
      if (!isNaN(d.getTime())) {
        const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        dateStr = ` ${monthNames[d.getMonth()]} ${d.getFullYear()}`;
      }
    }

    form.setValue("tourName", `${customerName} ${tourType}${dateStr}`.trim(), { shouldValidate: true });
  }, [customerName, tourType, lineItems, form]);

  useEffect(() => {
    if (!voucherType) return;
    if (form.formState.dirtyFields.voucherTitle) return;

    const titleMap: Record<string, string> = {
      reservation: "Hotel Reservation Voucher",
      amendment: "Amendment Voucher",
      pptp: "PPTP Voucher"
    };

    const title = titleMap[voucherType as string] || "";
    if (title) {
      form.setValue("voucherTitle", title, { shouldValidate: true });
    }
  }, [voucherType, form]);

  useEffect(() => {
    setSelectedHotelRateId("");
  }, [hotelName, market]);

  useEffect(() => {
    const handleDragStart = (e: any) => e.preventDefault(); // eslint-disable-line @typescript-eslint/no-explicit-any
    document.addEventListener("dragstart", handleDragStart);
    return () => document.removeEventListener("dragstart", handleDragStart);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: any) => { // eslint-disable-line @typescript-eslint/no-explicit-any
      if (accountMenuRef.current && !accountMenuRef.current.contains(event.target)) {
        setShowAccountMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  if (isCheckingAuth) {
    return (
      <div className={`min-h-screen ${themeClass} bg-bg text-ink`}>
        <div className="app-loading-screen">
          <div className="app-loading-card">
            <div className="app-loading-logo overflow-hidden bg-cloud">
              <img src={logo} alt="Logo" className="h-full w-full object-contain" />
            </div>
            <div className="app-loading-spinner" />
            <p className="app-loading-text">Meridian Voucher Studio</p>
            <p className="app-loading-subtext">Initializing workspace…</p>
          </div>
        </div>
      </div>
    );
  }

  if (!authState.isAuthenticated) {
    return (
      <div className={`min-h-screen ${themeClass} bg-bg text-ink`}>
        <AuthScreen onAuthenticated={handleAuthenticated} />
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${themeClass} bg-bg text-ink`}>
      <div className={`app-shell ${navCollapsed ? "app-shell-nav-collapsed" : "app-shell-nav-expanded"}`}>
        <MenuBar
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          notices={notices}
          onClearNotice={clearNotice}
          onClearAllNotices={clearAllNotices}
          onNavigate={(view) => setActiveView(view as ActiveView)}
          onSignOut={handleSignOut}
          onReportIssue={() => setShowReportIssue(true)}
        />

        <div className="app-body">
          <aside className="app-sidebar group">
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
                onClick={() => setActiveView("settings" as ActiveView)}
                title="Settings"
              >
                <Settings size={18} /> {!navCollapsed && "Settings"}
              </button>

              <div className="relative" ref={accountMenuRef}>
                <button
                  onClick={() => setShowAccountMenu(!showAccountMenu)}
                  className={`app-nav-button w-full ${showAccountMenu ? 'app-nav-button-active' : ''}`}
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
                        setActiveView("profile" as ActiveView);
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

          <main className="app-main thin-scrollbar">
            {activeView === "entry" ? (
              <form className="mx-auto max-w-[1400px] p-8" onSubmit={form.handleSubmit(handleSave)}>
                <div className="mb-8 flex items-end justify-between">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.16em] text-steel">Operations / Finance</p>
                    <h2 className="mt-1 font-display text-3xl font-bold text-navy">Voucher Entry</h2>
                    <p className="mt-2 text-sm text-steel">Create reservation, amendment, and PPTP documents from one controlled template.</p>
                  </div>
                  <div className="flex max-w-full flex-wrap items-center justify-end gap-2">
                    <Button
                      type="button"
                      disabled={actionState !== "idle"}
                      onClick={handleClearForm}
                      variant="secondary"
                      className="h-10 shrink-0 whitespace-nowrap px-4 w-40"
                    >
                      <RotateCcw size={17} /> Clear Form
                    </Button>
                    <Button
                      type="submit"
                      disabled={actionState !== "idle"}
                      variant="primary"
                      className="h-10 shrink-0 whitespace-nowrap px-4 w-40"
                    >
                      <Save size={17} /> {actionState === "saving" ? "Saving..." : "Save Voucher"}
                    </Button>
                    <Button
                      type="button"
                      disabled={actionState !== "idle"}
                      onClick={form.handleSubmit(handleGenerateDocx)}
                      variant="secondary"
                      className="h-10 shrink-0 whitespace-nowrap px-4 w-40"
                    >
                      <FileText size={17} /> {actionState === "generating-docx" ? "Generating..." : "Generate DOCX"}
                    </Button>
                    <Button
                      type="button"
                      disabled={actionState !== "idle"}
                      onClick={form.handleSubmit(handleGeneratePdf)}
                      variant="secondary"
                      className="h-10 shrink-0 whitespace-nowrap px-4 w-40"
                    >
                      <FileDown size={17} /> {actionState === "generating-pdf" ? "Generating..." : "Generate PDF"}
                    </Button>
                  </div>
                </div>

                <div className="flex flex-col gap-8">
                  <div className="space-y-6">
                    <Panel className="app-panel-body-lg">
                      <h3 className="mb-5 app-section-title">Primary Configuration</h3>
                      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-4 gap-5">
                        <Field label="Tour Type">
                          <Select
                            className={`w-full ${form.formState.errors.tourType ? "border-red-500" : ""}`}
                            {...form.register("tourType")}
                            onChange={(event) => {
                              form.setValue("tourType", event.target.value as VoucherFormValues["tourType"], {
                                shouldValidate: true
                              });
                            }}
                          >
                            <option value="">Select Tour Type</option>
                            {tourTypeOptions.map((type) => (
                              <option value={type} key={type}>
                                {type}
                              </option>
                            ))}
                          </Select>
                          <FieldError message={form.formState.errors.tourType?.message} />
                        </Field>
                        <Field label="Hotel Name">
                          <Select
                            className={`w-full ${form.formState.errors.hotelName ? "border-red-500" : ""}`}
                            {...form.register("hotelName")}
                            onChange={(event) => {
                              form.setValue("hotelName", event.target.value, { shouldValidate: true });
                            }}
                          >
                            <option value="">Select Hotel Name</option>
                            {hotelOptions.map((hotel) => (
                              <option value={hotel} key={hotel}>
                                {hotel}
                              </option>
                            ))}
                          </Select>
                          <FieldError message={form.formState.errors.hotelName?.message} />
                        </Field>
                        <Field label="Market">
                          <Select
                            className={`w-full ${form.formState.errors.market ? "border-red-500" : ""}`}
                            {...form.register("market")}
                            onChange={(event) => {
                              form.setValue("market", event.target.value, { shouldValidate: true });
                            }}
                          >
                            <option value="">Select Market</option>
                            {marketOptions.map((m) => (
                              <option value={m} key={m}>
                                {m}
                              </option>
                            ))}
                          </Select>
                          <FieldError message={form.formState.errors.market?.message} />
                        </Field>
                        <Field label="Rate Period">
                          <Select
                            className={`w-full ${form.formState.errors.ratePeriod ? "border-red-500" : ""}`}
                            {...form.register("ratePeriod")}
                            onChange={(event) => {
                              form.setValue("ratePeriod", event.target.value, { shouldValidate: true });
                            }}
                          >
                            <option value="">Select Rate Period</option>
                            {uniqueContractNames.map((name) => (
                              <option value={name} key={name}>
                                {name}
                              </option>
                            ))}
                          </Select>
                          <FieldError message={form.formState.errors.ratePeriod?.message} />
                        </Field>
                      </div>
                      <Controller
                        control={form.control}
                        name="voucherType"
                        render={({ field }) => (
                          <div className="mt-5 grid grid-cols-1 lg:grid-cols-3 gap-4">
                            {voucherTypes.map((type) => {
                              const Icon = type.icon;
                              const selected = field.value === type.value;
                              return (
                                <button
                                  type="button"
                                  key={type.value}
                                  onClick={() => field.onChange(type.value)}
                                  className={`rounded-app border p-4 text-left transition ${selected ? "border-navy bg-[var(--color-accent-bg)] text-navy" : "border-line bg-surface text-ink hover:border-steel"
                                    }`}
                                >
                                  <Icon size={22} />
                                  <div className="mt-3 text-sm font-bold">{type.label}</div>
                                  <div className="mt-1 text-xs text-steel">{type.description}</div>
                                </button>
                              );
                            })}
                          </div>
                        )}
                      />
                    </Panel>

                    <section className="app-panel app-panel-body-lg">
                      <h3 className="mb-5 app-section-title">Booking Information</h3>
                      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-4 gap-5">
                        <label className="space-y-2">
                          <span className="app-label">Date</span>
                          <input type="date" className="app-input" {...form.register("date")} />
                          <FieldError message={form.formState.errors.date?.message} />
                        </label>
                        <label className="space-y-2">
                          <span className="app-label">Voucher Title</span>
                          <input
                            className="app-input"
                            placeholder={voucherType.replace(/^\w/, (l) => l.toUpperCase()) + " Voucher"}
                            {...form.register("voucherTitle")}
                          />
                        </label>
                        <label className="space-y-2">
                          <span className="app-label">Requisition No</span>
                          <input className="app-input" placeholder="REQ-00000" {...form.register("requisitionNo")} />
                          <FieldError message={form.formState.errors.requisitionNo?.message} />
                        </label>
                        <label className="space-y-2">
                          <span className="app-label">Tour No</span>
                          <input className="app-input" placeholder="T/0000" {...form.register("tourNo")} />
                          <FieldError message={form.formState.errors.tourNo?.message} />
                        </label>
                        <label className="space-y-2">
                          <span className="app-label">Customer</span>
                          <Select
                            className={`w-full ${form.formState.errors.customerName ? "border-red-500" : ""}`}
                            {...form.register("customerName")}
                            onChange={(event) => {
                              form.setValue("customerName", event.target.value, {
                                shouldValidate: true
                              });
                            }}
                          >
                            <option value="">Select Customer</option>
                            {customerOptions.map((customer) => (
                              <option value={customer} key={customer}>
                                {customer}
                              </option>
                            ))}
                          </Select>
                          <FieldError message={form.formState.errors.customerName?.message} />
                        </label>
                        <label className="space-y-2">
                          <span className="app-label">Tour Name</span>
                          <input className="app-input" placeholder="Auto-filled if empty" {...form.register("tourName")} />
                          <FieldError message={form.formState.errors.tourName?.message} />
                        </label>
                      </div>
                    </section>

                    <section className="app-panel app-panel-body-lg">
                      <div className="mb-5 flex items-center justify-between">
                        <h3 className="app-section-title">Voucher Content</h3>
                        <button
                          type="button"
                          className="app-button-ghost"
                          onClick={() =>
                            append({
                              requiredDate: "",
                              roomCategory: "",
                              basis: "",
                              singleRooms: 0,
                              doubleRooms: 0,
                              twinRooms: 0,
                              tripleRooms: 0,
                              child2_5: 0,
                              child6_11: 0,
                              child2_5Sharing: 0,
                              child2_5Bed: 0,
                              child2_5OwnRoom: 0,
                              child6_11Sharing: 0,
                              child6_11Bed: 0,
                              child6_11OwnRoom: 0,
                              guide: 0,
                              guideBasis: "",
                              arrivingFor: "",
                              supplementary: []
                            })
                          }
                        >
                          <Plus size={16} /> Row
                        </button>
                      </div>
                      <div className="thin-scrollbar overflow-x-auto pb-48">
                        <table className="w-full min-w-[1440px] table-fixed border-collapse text-sm">
                          <colgroup>
                            <col className="w-[140px]" />
                            <col className="w-[150px]" />
                            <col className="w-[100px]" />
                            <col className="w-[60px]" />
                            <col className="w-[60px]" />
                            <col className="w-[60px]" />
                            <col className="w-[60px]" />
                            <col className="w-[60px]" />
                            <col className="w-[60px]" />
                            <col className="w-[60px]" />
                            <col className="w-[60px]" />
                            <col className="w-[60px]" />
                            <col className="w-[60px]" />
                            <col className="w-[60px]" />
                            <col className="w-[90px]" />
                            <col className="w-[130px]" />
                            <col className="w-[160px]" />
                            <col className="w-[56px]" />
                          </colgroup>
                          <thead>
                            <tr className="border-y border-line bg-cloud text-left text-xs font-bold uppercase tracking-wide text-steel">
                              <th className="px-2 py-3">Required Date</th>
                              <th className="px-2 py-3">Room Category</th>
                              <th className="px-2 py-3">Basis (Room)</th>
                              <th className="px-2 py-3 text-center border-l border-line" colSpan={4}>Rooms</th>
                              <th className="px-2 py-3 text-center border-x border-line" colSpan={3}>Child (2-5)</th>
                              <th className="px-2 py-3 text-center border-r border-line" colSpan={3}>Child (6-11)</th>
                              <th className="px-2 py-3 text-center" colSpan={2}>Guide</th>
                              <th className="px-2 py-3 border-l border-line">Supplementary</th>
                              <th className="px-2 py-3 border-l border-line">Arriving For</th>
                              <th className="px-2 py-3"></th>
                            </tr>
                            <tr className="border-b border-line bg-cloud/50 text-[10px] font-bold uppercase tracking-wider text-steel text-center">
                              <th className="px-2 py-1"></th>
                              <th className="px-2 py-1"></th>
                              <th className="px-2 py-1"></th>
                              <th className="px-2 py-1 border-l border-line">SGL</th>
                              <th className="px-2 py-1">DBL</th>
                              <th className="px-2 py-1">TWN</th>
                              <th className="px-2 py-1">TPL</th>
                              <th className="px-2 py-1 border-l border-line">Sharing</th>
                              <th className="px-2 py-1">Bed</th>
                              <th className="px-2 py-1">ICON</th>
                              <th className="px-2 py-1 border-l border-line">Sharing</th>
                              <th className="px-2 py-1">Bed</th>
                              <th className="px-2 py-1 border-r border-line">ICON</th>
                              <th className="px-2 py-1">QTY</th>
                              <th className="px-2 py-1">BASIS</th>
                              <th className="px-2 py-1 border-l border-line"></th>
                              <th className="px-2 py-1 border-l border-line"></th>
                              <th className="px-2 py-1"></th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-line">
                            {fields.map((field, index) => (
                              <tr key={field.id}>
                                {lineItemColumns.map((column) => (
                                  <td className={`px-2 py-2 ${column.className}`} key={column.name}>
                                    {column.type === "select-room-category" && (
                                      <Select
                                        className={tableControlClass}
                                        {...form.register(`lineItems.${index}.${column.name}`)}
                                      >
                                        <option value="">Select</option>
                                        {roomCategoryOptions.map((category) => (
                                          <option value={category} key={category}>
                                            {category}
                                          </option>
                                        ))}
                                      </Select>
                                    )}
                                    {column.type === "select-basis" && (
                                      <Select
                                        className={tableControlClass}
                                        {...form.register(`lineItems.${index}.${column.name}`)}
                                      >
                                        <option value="">Select</option>
                                        {mealBasisOptionsState.map((basis) => (
                                          <option value={basis} key={basis}>
                                            {basis}
                                          </option>
                                        ))}
                                      </Select>
                                    )}
                                    {column.type === "select-supplementary" && (
                                      <Controller
                                        control={form.control}
                                        name={`lineItems.${index}.supplementary` as never}
                                        render={({ field }) => {
                                          const cat = lineItems[index]?.roomCategory || "";
                                          const rowOpts = availableSupplements
                                            .filter((s) => s.room_category.toLowerCase() === cat.toLowerCase())
                                            .map((s) => ({ name: s.supplement_name, label: `${s.supplement_name} (${s.supplement_amount})` }));
                                          return (
                                            <SupplementaryDropdown
                                              value={field.value || []}
                                              onChange={field.onChange}
                                              options={rowOpts}
                                            />
                                          );
                                        }}
                                      />
                                    )}
                                    {column.type !== "select-room-category" && column.type !== "select-basis" && column.type !== "select-supplementary" && (
                                      <Controller
                                        control={form.control}
                                        name={`lineItems.${index}.${column.name}` as never}
                                        render={({ field }) => (
                                          <input
                                            {...field}
                                            type={column.type}
                                            min={roomCountFields.has(column.name) ? 0 : undefined}
                                            step={roomCountFields.has(column.name) ? 1 : undefined}
                                            className={tableControlClass}
                                            value={roomCountFields.has(column.name) && field.value === 0 ? "" : field.value}
                                            onChange={(e) => {
                                              if (roomCountFields.has(column.name)) {
                                                const val = e.target.value;
                                                field.onChange(val === "" ? 0 : Number(val));
                                              } else {
                                                field.onChange(e.target.value);
                                              }
                                            }}
                                            onBlur={(e) => {
                                              field.onBlur();
                                              if (roomCountFields.has(column.name) && Number(e.target.value) < 0) {
                                                field.onChange(0);
                                              }
                                            }}
                                          />
                                        )}
                                      />
                                    )}
                                  </td>
                                ))}
                                <td className="px-2 py-2">
                                  <button
                                    type="button"
                                    aria-label={`Remove voucher content row ${index + 1}`}
                                    title={`Remove voucher content row ${index + 1}`}
                                    className="rounded-app p-2 text-steel hover:bg-red-500/10 hover:text-red-500"
                                    onClick={() => remove(index)}
                                  >
                                    <Trash2 size={16} />
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      {/* Rooms summary bar (Per day calculation) */}
                      <div className="mt-4 flex flex-wrap items-center gap-4 rounded-app bg-cloud px-4 py-3 text-sm font-bold">
                        <span className="text-steel mr-2">Pax Summary per day:</span>
                        {dailyRooms.length > 0 ? (
                          dailyRooms.map((dr, idx) => (
                            <span key={idx} className="text-steel">
                              {dr.date} rooms: <span className="text-navy">{dr.rooms}</span> / child: <span className="text-navy">{dr.children}</span>
                            </span>
                          ))
                        ) : (
                          <span className="text-steel opacity-50">No data entered</span>
                        )}
                      </div>
                    </section>

                    {/* Post-Content Fields */}
                    <section className="app-panel app-panel-body-lg">
                      <h3 className="mb-5 app-section-title">Confirmation & Rates</h3>
                      <div className="space-y-5">
                        <label className="block space-y-2">
                          <span className="app-label">Confirmed By</span>
                          <input className="app-input" placeholder="Reservation contact" {...form.register("confirmedBy")} />
                          <FieldError message={form.formState.errors.confirmedBy?.message} />
                        </label>

                        <label className="block space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="app-label">Rate Applicable</span>
                            <label className="flex items-center gap-2 text-xs font-semibold text-steel hover:text-navy cursor-pointer">
                              <input
                                type="checkbox"
                                checked={manualRates}
                                onChange={(e) => setManualRates(e.target.checked)}
                                className="rounded border-line text-navy focus:ring-navy"
                              />
                              Manual Override
                            </label>
                          </div>
                          <textarea
                            className={`app-textarea min-h-48 font-mono ${manualRates ? "border-line bg-surface text-ink" : "border-navy/20 bg-blue-100/20 text-navy"}`}
                            readOnly={!manualRates}
                            {...form.register("rateApplicableText")}
                            placeholder="Select a hotel and fill room details to see rates"
                          />
                          <p className="text-xs text-steel">
                            {manualRates ? "Rates are manually overridden. Auto-fill is disabled." : "Computed live from Rate Master. Changes when you edit dates, rooms, or basis."}
                          </p>
                        </label>



                        <label className="block space-y-2">
                          <span className="app-label">Remarks</span>
                          <textarea className="app-textarea" {...form.register("remarks")} />
                        </label>

                        <label className="block space-y-2">
                          <span className="app-label">Billing Instructions</span>
                          <textarea className="app-textarea min-h-32" {...form.register("billingInstructions")} />
                        </label>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                          <label className="space-y-2">
                            <span className="app-label">Employee Name</span>
                            <input className="app-input" placeholder="Employee name" {...form.register("employeeName")} />
                            <FieldError message={form.formState.errors.employeeName?.message} />
                          </label>
                          <label className="space-y-2">
                            <span className="app-label">Employee Email</span>
                            <input type="email" className="app-input" placeholder="employee@company.com" {...form.register("employeeEmail")} />
                            <FieldError message={form.formState.errors.employeeEmail?.message} />
                          </label>
                        </div>
                      </div>
                    </section>
                  </div>

                  <aside className="pt-6 border-t border-line max-w-[400px]">
                    <GeneratedFilesPanel generated={generated} onOpenDocument={(filePath) => window.meridian.openDocument(filePath)} />
                  </aside>

                  {/* Floating Live Preview Widget */}
                  {(() => {
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
                                  Date: {form.watch("date") || "—"}
                                </div>
                              </div>

                              {/* Title */}
                              <div className="text-center font-bold text-[14px] mb-8">
                                <span className="border-b-2 border-black inline-block pb-0.5">
                                  {form.watch("voucherType") === "reservation" ? "Hotel Reservation Voucher" :
                                    form.watch("voucherType") === "amendment" ? "Amendment Voucher" : "PPTP Voucher"}
                                </span>
                              </div>

                              {/* Top Body Grid */}
                              <div className="mb-8">
                                <div className="grid grid-cols-[110px_1fr] gap-y-1">
                                  <div className="font-bold">To</div>
                                  <div>: {form.watch("hotelName") || "—"}</div>

                                  <div className="font-bold">Requisition No</div>
                                  <div>: {form.watch("requisitionNo") || "—"}</div>

                                  <div className="font-bold">Tour No</div>
                                  <div>: {form.watch("tourNo") || "—"}</div>

                                  <div className="font-bold">Tour Name</div>
                                  <div>: {form.watch("tourName") || "—"}</div>

                                  <div className="font-bold">Customer</div>
                                  <div>: {form.watch("customerName") || "—"}</div>
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
                                      <tr key={idx} className={idx % 2 === 0 ? 'bg-cloud/50' : 'bg-surface'}>
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
                                  <div className="font-bold mb-1">Confirmed By - {form.watch("confirmedBy") || "Team"}</div>
                                </div>

                                <div>
                                  <div className="font-bold mb-1">Rate Applicable -</div>
                                  <div className="whitespace-pre-wrap leading-[1.5]">
                                    {form.watch("rateApplicableText") || "—"}
                                  </div>
                                </div>

                                <div>
                                  <div className="font-bold mb-1">Remarks -</div>
                                  <div className="whitespace-pre-wrap">{form.watch("remarks") || "No"}</div>
                                </div>

                                <div>
                                  <div className="font-bold mb-1">Billing Instruction -</div>
                                  <div className="whitespace-pre-wrap leading-[1.5]">
                                    {form.watch("billingInstructions") || ""}
                                  </div>
                                </div>
                              </div>

                              {/* Footer */}
                              <div className="mt-8 pt-4 text-gray-400 font-medium">
                                <div>{form.watch("employeeName") || "kadira"}</div>
                                <div>{form.watch("employeeEmail") || "dilshanstoregiriulla@gmail.com"}</div>
                                <div className="font-bold text-gray-500 mt-0.5">Meridian (Pvt.) Ltd.</div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </form>
            ) : activeView === "dashboard" ? (
              <DashboardScreen
                onNewVoucher={() => {
                  form.reset(withAccountDefaults(defaultVoucher, accountProfile));
                  setGenerated(null);
                  setVoucherRevisions([]);
                  addNotice("New voucher ready");
                  setActiveView("entry");
                }}
                onOpenVoucher={(id: string) => void openVoucherFromSearch({ id } as VoucherRecord)}
                onGoToRateMaster={() => setActiveView("rate-master")}
                onGoToRegister={() => {
                  setActiveView("register");
                  void refreshVoucherRegister(voucherFilters);
                }}
              />
            ) : (
              <>
                <div className={activeView === "rate-master" ? "block" : "hidden"}>
                  <HotelRateMasterScreen
                    key={activeView === "rate-master" ? "active" : "inactive"}
                    initialEditId={editHotelRateId}
                    addNotice={addNotice}
                    onBack={() => {
                      setEditHotelRateId(undefined);
                      setActiveView("entry");
                    }}
                    onManageRates={() => setActiveView("manage-rates")}
                  />
                </div>
                {activeView === "manage-rates" ? (
                  <ManageRatesScreen
                    onBack={() => setActiveView("rate-master")}
                    onEdit={(id) => {
                      setEditHotelRateId(id);
                      setActiveView("rate-master");
                    }}
                  />
                ) : activeView === "settings" ? (
                  <SettingsScreen onThemeChange={setActiveTheme} />
                ) : activeView === "profile" ? (
                  <ProfileScreen
                    accountProfile={accountProfile}
                    onProfileUpdated={(profile) => setAccountProfile(profile)}
                  />
                ) : activeView === "register" ? (
                  <div className="mx-auto max-w-[1400px] p-4 md:p-8">
                    <div className="mb-8 flex items-start gap-4">
                      <button
                        onClick={() => setActiveView("dashboard")}
                        className="mt-1 flex h-10 w-10 items-center justify-center rounded-full border border-line bg-surface text-steel hover:bg-cloud hover:text-navy transition-all shadow-sm"
                        title="Go to Dashboard"
                      >
                        <ChevronLeft size={22} />
                      </button>
                      <div>
                        <p className="text-xs font-bold uppercase tracking-[0.16em] text-steel">Operations / Data Management</p>
                        <h2 className="mt-1 font-display text-3xl font-bold text-navy">Saved Vouchers</h2>
                        <p className="mt-2 text-sm text-steel">Browse and manage all saved vouchers and their revisions.</p>
                      </div>
                    </div>

                    <div className="app-panel app-panel-body-lg">
                      <div className="mb-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        <label className="space-y-2">
                          <span className="app-label">Status</span>
                          <Select
                            className="w-full"
                            value={voucherFilters.status || "all"}
                            onChange={(event) => {
                              const nextFilters = { ...voucherFilters, status: event.target.value as VoucherStatus | "all" };
                              setVoucherFilters(nextFilters);
                              void refreshVoucherRegister(nextFilters);
                            }}
                          >
                            {voucherStatusOptions.map((option) => (
                              <option value={option.value} key={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </Select>
                        </label>
                        <label className="space-y-2">
                          <span className="text-xs font-bold uppercase tracking-wide text-steel">From</span>
                          <input
                            type="date"
                            className="w-full rounded-app border border-line px-3 py-2"
                            value={voucherFilters.dateFrom || ""}
                            onChange={(event) => {
                              const nextFilters = { ...voucherFilters, dateFrom: event.target.value };
                              setVoucherFilters(nextFilters);
                              void refreshVoucherRegister(nextFilters);
                            }}
                          />
                        </label>
                        <label className="space-y-2">
                          <span className="text-xs font-bold uppercase tracking-wide text-steel">To</span>
                          <input
                            type="date"
                            className="w-full rounded-app border border-line px-3 py-2"
                            value={voucherFilters.dateTo || ""}
                            onChange={(event) => {
                              const nextFilters = { ...voucherFilters, dateTo: event.target.value };
                              setVoucherFilters(nextFilters);
                              void refreshVoucherRegister(nextFilters);
                            }}
                          />
                        </label>
                        <label className="space-y-2">
                          <span className="text-xs font-bold uppercase tracking-wide text-steel">Quick Filters</span>
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              className="rounded-app border border-line px-3 py-2 text-sm font-bold text-navy hover:bg-blue-50"
                              onClick={() => {
                                const today = new Date().toISOString().slice(0, 10);
                                const nextFilters = { ...voucherFilters, dateFrom: today, dateTo: today };
                                setVoucherFilters(nextFilters);
                                void refreshVoucherRegister(nextFilters);
                              }}
                            >
                              Today
                            </button>
                          </div>
                        </label>
                      </div>

                      {isLoadingRegister ? (
                        <p className="text-center text-steel">Loading vouchers...</p>
                      ) : voucherRegister.length === 0 ? (
                        <p className="text-center text-steel">No vouchers found.</p>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full min-w-[800px] border-collapse text-sm">
                            <thead>
                              <tr className="border-b border-line text-left text-xs font-bold uppercase tracking-wide text-steel">
                                <th className="px-4 py-3">Requisition / Tour</th>
                                <th className="px-4 py-3">Hotel</th>
                                <th className="px-4 py-3">Customer</th>
                                <th className="px-4 py-3">Created On</th>
                                <th className="px-4 py-3 w-[160px]">Status</th>
                                <th className="px-4 py-3">Actions</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-line">
                              {voucherRegister.map((voucher) => (
                                <tr key={voucher.id} className="hover:bg-cloud">
                                  <td className="px-4 py-3">
                                    <p className="font-bold text-navy">{voucher.requisitionNo || voucher.tourNo}</p>
                                    {voucher.tourName && <p className="text-[11px] text-steel truncate max-w-[150px]">{voucher.tourName}</p>}
                                  </td>
                                  <td className="px-4 py-3">
                                    <p>{voucher.hotelName}</p>
                                    <p className="text-[11px] text-steel capitalize">{voucher.voucherType}</p>
                                  </td>
                                  <td className="px-4 py-3">{voucher.customerName}</td>
                                  <td className="px-4 py-3">
                                    <p>{new Date(voucher.createdAt).toLocaleDateString()}</p>
                                    <p className="text-[11px] text-steel">{new Date(voucher.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                                  </td>
                                  <td className="px-4 py-3">
                                    <label className="sr-only" htmlFor={`voucher-status-${voucher.id}`}>
                                      Update voucher status for {voucher.requisitionNo || voucher.tourNo || voucher.id}
                                    </label>
                                    <Select
                                      id={`voucher-status-${voucher.id}`}
                                      disabled={statusUpdatingId === voucher.id}
                                      value={voucher.status}
                                      onChange={(event) => {
                                        void handleVoucherStatusUpdate(voucher.id, event.target.value as VoucherStatus);
                                      }}
                                      className="app-table-control"
                                    >
                                      {voucherStatusOptions
                                        .filter((option) => option.value !== "all")
                                        .map((option) => (
                                          <option value={option.value} key={option.value}>
                                            {option.label}
                                          </option>
                                        ))}
                                    </Select>
                                  </td>
                                  <td className="px-4 py-3">
                                    <button
                                      type="button"
                                      disabled={openingVoucherId === voucher.id}
                                      onClick={() => void openVoucherFromSearch(voucher)}
                                      className="app-button-ghost px-0 py-0"
                                    >
                                      Open
                                    </button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  </div>
                ) : null}
              </>
            )}

            {searchQuery && (
              <div className="fixed inset-0 z-50 bg-black/50" onClick={() => setSearchQuery("")}>
                <div className="app-panel absolute left-1/2 top-1/2 w-full max-w-2xl -translate-x-1/2 -translate-y-1/2 p-6 shadow-2xl">
                  <h3 className="mb-4 text-lg font-bold text-navy">Search Results</h3>
                  {isSearching ? (
                    <p className="text-center text-steel">Searching...</p>
                  ) : searchResults.vouchers.length === 0 && searchResults.documents.length === 0 ? (
                    <p className="text-center text-steel">No results found.</p>
                  ) : (
                    <div className="space-y-6">
                      {searchResults.vouchers.length > 0 && (
                        <div>
                          <h4 className="mb-3 text-sm font-bold uppercase text-steel">Vouchers</h4>
                          <div className="space-y-2">
                            {searchResults.vouchers.map((voucher) => (
                              <button
                                key={voucher.id}
                                type="button"
                                onClick={() => {
                                  void openVoucherFromSearch(voucher);
                                  setSearchQuery("");
                                }}
                                className="app-history-card flex w-full items-center justify-between px-4 py-3 text-left hover:bg-blue-50"
                              >
                                <div>
                                  <p className="font-bold text-navy">{voucher.requisitionNo || voucher.tourNo}</p>
                                  <p className="text-xs text-steel">{voucher.hotelName} · {voucher.customerName}</p>
                                </div>
                                <p className="text-xs font-bold uppercase text-steel">{voucher.status}</p>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                      {searchResults.documents.length > 0 && (
                        <div>
                          <h4 className="mb-3 text-sm font-bold uppercase text-steel">Documents</h4>
                          <div className="space-y-2">
                            {searchResults.documents.map((doc) => (
                              <button
                                key={doc.id}
                                type="button"
                                onClick={() => window.meridian.openDocument(doc.docxPath)}
                                className="app-history-card flex w-full items-center justify-between px-4 py-3 text-left hover:bg-blue-50"
                              >
                                <div>
                                  <p className="font-bold text-navy">{doc.requisitionNo || doc.tourNo}</p>
                                  <p className="text-xs text-steel">{doc.hotelName} · {doc.format.toUpperCase()}</p>
                                </div>
                                <FileText size={16} className="text-steel" />
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </main>

          <TourExplorerPanel
            toursFolderPath={toursFolderPath}
            toursFolderTree={toursFolderTree}
            toursFolderExists={toursFolderExists}
            documentHistory={documentHistory}
            voucherRevisions={voucherRevisions}
            isLoading={isLoadingTree}
            isMigrating={isMigrating}
            collapsed={explorerCollapsed}
            onToggleCollapse={() => setExplorerCollapsed((prev) => !prev)}
            onSelectFolder={handleSelectToursFolder}
            onRefresh={refreshToursFolderTree}
            onOpenFile={(filePath) => window.meridian?.openDocument(filePath)}
            onOpenDocument={(filePath) => window.meridian?.openDocument(filePath)}
            onRevealFile={handleRevealFile}
            onMigrate={handleMigrateVouchers}
          />
          {showReportIssue && (
            <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/50 p-6 animate-in fade-in duration-200">
              <div className="app-panel w-full max-w-md p-8 shadow-2xl animate-in zoom-in-95 duration-200">
                <div className="mb-6 flex flex-col items-center text-center">
                  <h3 className="text-xl font-bold text-navy">Report an Issue</h3>
                  <p className="mt-2 text-sm text-steel">
                    We're sorry you're experiencing trouble. Please describe the issue or visit our support page.
                  </p>
                </div>

                <div className="space-y-4">
                  <div className="rounded-xl border border-line bg-cloud p-4 text-xs font-medium text-steel">
                    System Version: v0.1.0 (Stable)<br />
                    Environment: Production Branch
                  </div>

                  <button
                    onClick={() => window.open("https://github.com/kadirawkz/meridian_voucher_studio/issues", "_blank")}
                    className="app-button-primary w-full"
                  >
                    Open GitHub Issues
                  </button>

                  <button
                    onClick={() => setShowReportIssue(false)}
                    className="app-button-ghost w-full"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
