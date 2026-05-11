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
  ChevronLeft
} from "lucide-react";
import React, { useDeferredValue, useEffect, useMemo, useState, useRef } from "react";
import logo from "../assets/logo.png";
import { Controller, useFieldArray, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { defaultVoucher } from "../domain/defaultVoucher";
import { hotels as referenceHotels, markets, mealBasisOptions, roomCategories, tourTypes } from "../domain/referenceData";
import { VoucherFormValues, voucherSchema } from "../domain/voucherSchema";
import { AuthScreen } from "./AuthScreen";
import { DocumentHistoryPanel, GeneratedFilesPanel, LifecyclePanel, RevisionHistoryPanel } from "./AppPanels";
import { HotelRateMasterScreen } from "./HotelRateMasterScreen";
import { ManageRatesScreen } from "./ManageRatesScreen";
import { DashboardScreen } from "./DashboardScreen";
import { SettingsScreen } from "./SettingsScreen";
import { ProfileScreen } from "./ProfileScreen";
import { TourExplorerPanel } from "./TourExplorerPanel";
import { MenuBar } from "./MenuBar";
import { Button } from "./ui-kit/Button";
import { Field } from "./ui-kit/Field";
import { Select } from "./ui-kit/Inputs";
import { Panel } from "./ui-kit/Panel";
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

function friendlyErrorMessage(error: unknown, fallback: string): string {
  if (!(error instanceof Error)) {
    return fallback;
  }

  const message = error.message
    .replace(/^Error invoking remote method '[^']+':\s*/u, "")
    .replace(/^Error:\s*/u, "");

  const normalizedMessage = message.toLowerCase();

  if (
    normalizedMessage.includes("password") &&
    (normalizedMessage.includes("pwned") ||
      normalizedMessage.includes("haveibeenpwned") ||
      normalizedMessage.includes("compromised") ||
      normalizedMessage.includes("leaked"))
  ) {
    return "Choose a stronger password that has not appeared in known data breaches.";
  }

  if (normalizedMessage.includes("email rate limit exceeded")) {
    return "Too many email requests were sent. Wait a few minutes and try again.";
  }

  if (normalizedMessage.includes("invalid login credentials")) {
    return "Email or password is incorrect.";
  }

  if (normalizedMessage.includes("user already registered")) {
    return "An account already exists for this email address.";
  }

  return message;
}

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
  { name: "guide", type: "number", className: "min-w-[76px]" },
  { name: "guideBasis", type: "select-basis", className: "min-w-[96px]" },
  { name: "arrivingFor", type: "text", className: "min-w-[150px]" }
] as const;

const tableControlClass = "app-table-control";
const roomCountFields = new Set(["singleRooms", "doubleRooms", "twinRooms", "tripleRooms", "guide"]);

export function App() {
  const [activeView, setActiveView] = useState<ActiveView>("dashboard");
  const [actionState, setActionState] = useState<ActionState>("idle");
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
  const [notice, setNotice] = useState("Draft ready");
  const accountMenuRef = useRef<any>(null); // eslint-disable-line @typescript-eslint/no-explicit-any
  const [showReportIssue, setShowReportIssue] = useState(false);
  const [accountProfile, setAccountProfile] = useState<AccountProfile | null>(null);
  const [authState, setAuthState] = useState<AuthState>({ isAuthenticated: false, profile: null });
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [hotelOptions, setHotelOptions] = useState<string[]>([...referenceHotels]);
  const [selectedHotelRateId, setSelectedHotelRateId] = useState<string>("");
  const [toursFolderPath, setToursFolderPath] = useState<string | null>(null);
  const [toursFolderTree, setToursFolderTree] = useState<FolderTreeNode[]>([]);
  const [isLoadingTree, setIsLoadingTree] = useState(false);
  const [isMigrating, setIsMigrating] = useState(false);
  const [navCollapsed, setNavCollapsed] = useState(false);
  const [explorerCollapsed, setExplorerCollapsed] = useState(false);
  const [hotelContracts, setHotelContracts] = useState<HotelRateRecordSummary[]>([]);
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

  // Use native Event
  useEffect(() => {
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

  const navWidth = navCollapsed ? 64 : 288;
  
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
    const grouped = new Map<string, number>();
    for (const item of lineItems) {
      if (!item.requiredDate) continue;
      const total =
        Number(item.singleRooms || 0) +
        Number(item.doubleRooms || 0) +
        Number(item.twinRooms || 0) +
        Number(item.tripleRooms || 0);
      
      if (total > 0) {
        grouped.set(item.requiredDate, (grouped.get(item.requiredDate) || 0) + total);
      }
    }
    
    return Array.from(grouped.entries())
      .map(([date, total]) => ({ date, total }))
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
        setNotice(friendlyErrorMessage(error, "Unable to load document history"));
      });
  }, [authState.isAuthenticated]);

  useEffect(() => {
    if (!authState.isAuthenticated || !window.meridian?.listHotelsFromRates) {
      setHotelOptions([...referenceHotels]);
      return;
    }

    void window.meridian
      .listHotelsFromRates()
      .then((dbHotels) => {
        const set = new Set<string>();
        for (const h of referenceHotels) set.add(h);
        for (const h of dbHotels) if (h?.trim()) set.add(h.trim());
        setHotelOptions(Array.from(set).sort((a, b) => a.localeCompare(b)));
      })
      .catch(() => setHotelOptions([...referenceHotels]));
  }, [authState.isAuthenticated]);

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
    } catch {
      setNotice("Unable to scan Tours folder");
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
            setNotice(friendlyErrorMessage(error, "Unable to search workspace"));
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
      setNotice(friendlyErrorMessage(error, "Unable to load document history"));
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
      setNotice(friendlyErrorMessage(error, "Unable to load vouchers"));
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
      setNotice(friendlyErrorMessage(error, "Unable to load voucher history"));
    }
  }

  function handleAuthenticated(state: AuthState) {
    setAuthState(state);
    setAccountProfile(state.profile);
    form.reset(withAccountDefaults(defaultVoucher, state.profile));
    setNotice("Logged in");
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
      setNotice("Desktop bridge unavailable; restart the application");
      return;
    }

    setActionState("saving");
    try {
      const result = await window.meridian.saveVoucher(values);
      setNotice(`Saved as ${result.status} (${result.id.slice(0, 8)})`);
      form.setValue("id", result.id);
      await refreshVoucherRevisions(result.id);
      await refreshVoucherRegister(voucherFilters);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Unable to save voucher");
    } finally {
      setActionState("idle");
    }
  }

  async function handleGenerateDocx(values: VoucherFormValues) {
    if (!window.meridian) {
      setNotice("Desktop bridge unavailable; restart the application");
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
      setNotice("DOCX generated");
      await refreshDocumentHistory();
      await refreshVoucherRegister(voucherFilters);
      await refreshToursFolderTree();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Unable to generate DOCX");
    } finally {
      setActionState("idle");
    }
  }

  async function handleGeneratePdf(values: VoucherFormValues) {
    if (!window.meridian) {
      setNotice("Desktop bridge unavailable; restart the application");
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
      setNotice("PDF generated");
      await refreshDocumentHistory();
      await refreshVoucherRegister(voucherFilters);
      await refreshToursFolderTree();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Unable to generate PDF");
    } finally {
      setActionState("idle");
    }
  }

  async function handleVoucherStatusUpdate(voucherId: string, status: VoucherStatus) {
    if (!window.meridian?.updateVoucherStatus) {
      setNotice("Voucher status update is unavailable; restart the application");
      return;
    }

    setStatusUpdatingId(voucherId);
    try {
      const result = await window.meridian.updateVoucherStatus(voucherId, status);
      setNotice(`Voucher marked as ${result.status}`);
      await refreshVoucherRevisions(voucherId);
      await refreshVoucherRegister(voucherFilters);
    } catch (error) {
      setNotice(friendlyErrorMessage(error, "Unable to update voucher status"));
    } finally {
      setStatusUpdatingId(null);
    }
  }

  async function openVoucherFromSearch(voucher: VoucherRecord) {
    if (!window.meridian?.getVoucher) {
      setNotice("Voucher loading is unavailable; restart the application");
      return;
    }

    setOpeningVoucherId(voucher.id);
    try {
      const fullVoucher = await window.meridian.getVoucher(voucher.id);
      form.reset(withAccountDefaults({ ...defaultVoucher, ...fullVoucher } as VoucherFormValues, accountProfile));
      await refreshVoucherRevisions(voucher.id);
      setActiveView("entry");
      setGenerated(null);
      setNotice(`Loaded voucher ${voucher.requisitionNo || voucher.tourNo || voucher.id.slice(0, 8)}`);
    } catch (error) {
      setNotice(friendlyErrorMessage(error, "Unable to load voucher"));
    } finally {
      setOpeningVoucherId(null);
    }
  }

  async function handleSelectToursFolder() {
    if (!window.meridian?.selectToursFolder) {
      setNotice("Tours folder selection unavailable; restart the application");
      return;
    }

    try {
      const result = await window.meridian.selectToursFolder();
      if (result) {
        setToursFolderPath(result.path);
        setNotice(`Tours folder set: ${result.path}`);
        await refreshToursFolderTree();
      }
    } catch {
      setNotice("Unable to select Tours folder");
    }
  }

  async function handleMigrateVouchers() {
    if (!window.meridian?.migrateVouchersToTours) return;

    setIsMigrating(true);
    try {
      const result = await window.meridian.migrateVouchersToTours();
      if (result.moved > 0) {
        setNotice(`Migrated ${result.moved} voucher(s)`);
      } else {
        setNotice("No vouchers to migrate");
      }
      if (result.errors.length > 0) {
        setNotice(`Migration: ${result.moved} moved, ${result.failed} failed`);
      }
      await refreshToursFolderTree();
    } catch {
      setNotice("Migration failed");
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
    setNotice("Form cleared");
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
          if (result.cancellationText) form.setValue("cancellationText", result.cancellationText);
          if (result.autoTextNotes) form.setValue("autoTextNotes", result.autoTextNotes);
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
      <div className="app-loading-screen">
        <div className="app-loading-card">
          <div className="app-loading-logo overflow-hidden bg-white">
            <img src={logo} alt="Logo" className="h-full w-full object-contain" />
          </div>
          <div className="app-loading-spinner" />
          <p className="app-loading-text">Meridian Voucher Studio</p>
          <p className="app-loading-subtext">Initializing workspace…</p>
        </div>
      </div>
    );
  }

  if (!authState.isAuthenticated) {
    return <AuthScreen onAuthenticated={handleAuthenticated} />;
  }

  return (
    <div className={`app-shell ${navCollapsed ? "app-shell-nav-collapsed" : "app-shell-nav-expanded"}`}>
      <MenuBar 
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        notice={notice}
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
            className="absolute -right-3 top-4 z-50 flex h-6 w-6 items-center justify-center rounded-full bg-white shadow-md border border-line text-steel hover:text-navy opacity-0 group-hover:opacity-100 transition-opacity"
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
                <div className="absolute bottom-full left-0 z-50 mb-2 w-full min-w-[220px] rounded-2xl border border-line bg-white p-2 shadow-2xl animate-in slide-in-from-bottom-2">
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
                    className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"
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
              <div className="flex gap-3">
                <button
                  type="button"
                  disabled={actionState !== "idle"}
                  onClick={handleClearForm}
                  className="app-button-secondary"
                >
                  <RotateCcw size={17} /> Clear
                </button>
                <Button
                  type="submit"
                  disabled={actionState !== "idle"}
                  variant="secondary"
                >
                  <Save size={17} /> {actionState === "saving" ? "Saving" : "Save"}
                </Button>
                <Button
                  type="button"
                  disabled={actionState !== "idle"}
                  onClick={form.handleSubmit(handleGenerateDocx)}
                  variant="primary"
                >
                  <FileText size={17} /> {actionState === "generating-docx" ? "Generating" : "Generate DOCX"}
                </Button>
                <Button
                  type="button"
                  disabled={actionState !== "idle"}
                  onClick={form.handleSubmit(handleGeneratePdf)}
                  variant="primary"
                >
                  <FileDown size={17} /> {actionState === "generating-pdf" ? "Generating" : "Generate PDF"}
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-[minmax(0,1fr)_360px] gap-6">
              <div className="space-y-6">
                <Panel className="app-panel-body-lg">
                  <h3 className="mb-5 app-section-title">Primary Configuration</h3>
                  <div className="grid grid-cols-2 gap-5">
                    <Field label="Tour Type">
                      <Select
                        className="w-full"
                        {...form.register("tourType")}
                        onChange={(event) => {
                          form.setValue("tourType", event.target.value as VoucherFormValues["tourType"], {
                            shouldValidate: true
                          });
                        }}
                      >
                        <option value="">Select Tour Type</option>
                        {tourTypes.map((type) => (
                          <option value={type} key={type}>
                            {type}
                          </option>
                        ))}
                      </Select>
                    </Field>
                    <Field label="Hotel Name">
                      <Select
                        className="w-full"
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
                      <Select className="w-full" {...form.register("market")}>
                        <option value="">Select Market</option>
                        {markets.map((m) => (
                          <option value={m} key={m}>
                            {m}
                          </option>
                        ))}
                      </Select>
                    </Field>
                    <Field label="Rate Period">
                      <Select className={`w-full ${form.formState.errors.ratePeriod ? "border-red-500" : ""}`} {...form.register("ratePeriod")}>
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
                      <div className="mt-5 grid grid-cols-3 gap-4">
                        {voucherTypes.map((type) => {
                          const Icon = type.icon;
                          const selected = field.value === type.value;
                          return (
                            <button
                              type="button"
                              key={type.value}
                              onClick={() => field.onChange(type.value)}
                              className={`rounded-app border p-4 text-left transition ${
                                selected ? "border-navy bg-blue-50 text-navy" : "border-line bg-white text-ink hover:border-steel"
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
                  <div className="grid grid-cols-2 gap-5">
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
                      <input className="app-input" placeholder="T/000" {...form.register("tourNo")} />
                      <FieldError message={form.formState.errors.tourNo?.message} />
                    </label>
                    <label className="space-y-2">
                      <span className="app-label">Customer</span>
                      <input className="app-input" placeholder="Customer or company" {...form.register("customerName")} />
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
                          guide: 0,
                          guideBasis: "",
                          arrivingFor: ""
                        })
                      }
                    >
                      <Plus size={16} /> Row
                    </button>
                  </div>
                  <div className="thin-scrollbar overflow-x-auto">
                    <table className="w-full min-w-[1180px] table-fixed border-collapse text-sm">
                      <thead>
                        <tr className="border-y border-line bg-cloud text-left text-xs font-bold uppercase tracking-wide text-steel">
                          {[
                            ["Required Date", "w-[150px]"],
                            ["Room Rate", "w-[170px]"],
                            ["Basis (Room)", "w-[96px]"],
                            ["SGL", "w-[76px]"],
                            ["DBL", "w-[76px]"],
                            ["TWN", "w-[76px]"],
                            ["TPL", "w-[76px]"],
                            ["Guide", "w-[76px]"],
                            ["Basis (Guide)", "w-[96px]"],
                            ["Arriving For", "w-[150px]"],
                            ["", "w-[56px]"]
                          ].map(([header, width]) => (
                            <th className={`px-2 py-3 ${width}`} key={header}>{header}</th>
                          ))}
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
                                    {roomCategories.map((category) => (
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
                                    {mealBasisOptions.map((basis) => (
                                      <option value={basis} key={basis}>
                                        {basis}
                                      </option>
                                    ))}
                                  </Select>
                                )}
                                {column.type !== "select-room-category" && column.type !== "select-basis" && (
                                  <input
                                    type={column.type}
                                    min={roomCountFields.has(column.name) ? 0 : undefined}
                                    step={roomCountFields.has(column.name) ? 1 : undefined}
                                    className={tableControlClass}
                                    {...form.register(`lineItems.${index}.${column.name}`)}
                                    onBlur={(event) => {
                                      if (roomCountFields.has(column.name) && Number(event.target.value) < 0) {
                                        form.setValue(`lineItems.${index}.${column.name}`, 0, { shouldValidate: true });
                                      }
                                    }}
                                  />
                                )}
                              </td>
                            ))}
                            <td className="px-2 py-2">
                              <button
                                type="button"
                                aria-label={`Remove voucher content row ${index + 1}`}
                                title={`Remove voucher content row ${index + 1}`}
                                className="rounded-app p-2 text-steel hover:bg-red-50 hover:text-red-700"
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
                    <span className="text-steel mr-2">Rooms per day:</span>
                    {dailyRooms.length > 0 ? (
                      dailyRooms.map((dr, idx) => (
                        <span key={idx} className="text-steel">
                          {dr.date} rooms = <span className="text-navy">{dr.total}</span>
                        </span>
                      ))
                    ) : (
                      <span className="text-steel opacity-50">No rooms entered</span>
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
                        className={`app-textarea min-h-16 font-mono ${manualRates ? "border-line bg-white text-ink" : "border-navy/20 bg-blue-50/50 text-navy"}`}
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

                    <div className="grid grid-cols-2 gap-5">
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

              <aside className="space-y-6">
                <section className="rounded-app border border-line bg-white shadow-panel">
                  <div className="border-b border-line bg-cloud px-5 py-4">
                    <h3 className="text-sm font-bold uppercase tracking-wide text-navy">Voucher Preview</h3>
                  </div>
                  <div className="p-6">
                    <div className="aspect-[3/4] border border-line bg-white p-5 shadow-sm">
                      <div className="flex items-start justify-between border-b border-line pb-4">
                        <div>
                          <p className="text-xs font-bold uppercase tracking-wide text-steel">Meridian</p>
                          <p className="mt-1 font-display text-xl font-bold text-navy">{form.watch("voucherTitle") || `${voucherType.toUpperCase()} Voucher`}</p>
                        </div>
                        <p className="text-xs font-bold text-steel">Page {form.watch("pageNumber")}</p>
                      </div>
                      <div className="mt-5 space-y-3 text-sm">
                        <p><span className="font-bold text-steel">Hotel:</span> {form.watch("hotelName") || "Pending"}</p>
                        <p><span className="font-bold text-steel">Tour:</span> {form.watch("tourName") || "Pending"}</p>
                        <p><span className="font-bold text-steel">Customer:</span> {form.watch("customerName") || "Pending"}</p>
                        <p><span className="font-bold text-steel">Rooms:</span> {dailyRooms.reduce((sum, dr) => sum + dr.total, 0)}</p>
                      </div>
                      <div className="mt-6 h-28 rounded-app border border-dashed border-line bg-cloud" />
                      <div className="mt-auto pt-8 text-center text-xs font-bold uppercase tracking-wide text-steel">Authenticated Digital Voucher</div>
                    </div>
                  </div>
                </section>

                <LifecyclePanel />
                <RevisionHistoryPanel voucherRevisions={voucherRevisions} />
                <GeneratedFilesPanel generated={generated} onOpenDocument={(filePath) => window.meridian.openDocument(filePath)} />
                <DocumentHistoryPanel
                  documentHistory={documentHistory}
                  onOpenDocument={(filePath) => window.meridian.openDocument(filePath)}
                />
              </aside>
            </div>
          </form>
        ) : activeView === "dashboard" ? (
          <DashboardScreen
            onNewVoucher={() => {
              form.reset(withAccountDefaults(defaultVoucher, accountProfile));
              setGenerated(null);
              setVoucherRevisions([]);
              setNotice("New voucher ready");
              setActiveView("entry");
            }}
            onOpenVoucher={(id: string) => void openVoucherFromSearch({ id } as VoucherRecord)}
            onGoToRateMaster={() => setActiveView("rate-master")}
            onGoToRegister={() => {
              setActiveView("register");
              void refreshVoucherRegister(voucherFilters);
            }}
          />
        ) : activeView === "rate-master" ? (
          <HotelRateMasterScreen
            initialEditId={editHotelRateId}
            onBack={() => {
              setEditHotelRateId(undefined);
              setActiveView("entry");
            }}
            onManageRates={() => setActiveView("manage-rates")}
          />
        ) : activeView === "manage-rates" ? (
          <ManageRatesScreen
            onBack={() => setActiveView("rate-master")}
            onEdit={(id) => {
              setEditHotelRateId(id);
              setActiveView("rate-master");
            }}
          />
        ) : activeView === "settings" ? (
          <SettingsScreen
          />
        ) : activeView === "profile" ? (
          <ProfileScreen
            accountProfile={accountProfile}
            onProfileUpdated={(profile) => setAccountProfile(profile)}
          />
        ) : (
          <div className="mx-auto max-w-[1400px] p-8">
            <div className="mb-8 flex items-start gap-4">
              <button 
                onClick={() => setActiveView("dashboard")}
                className="mt-1 flex h-10 w-10 items-center justify-center rounded-full border border-line bg-white text-steel hover:bg-cloud hover:text-navy transition-all shadow-sm"
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
              <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
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
                  <div className="flex gap-2">
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
                  <table className="w-full border-collapse text-sm">
                    <thead>
                      <tr className="border-b border-line text-left text-xs font-bold uppercase tracking-wide text-steel">
                        <th className="px-4 py-3">Requisition / Tour</th>
                        <th className="px-4 py-3">Hotel</th>
                        <th className="px-4 py-3">Customer</th>
                        <th className="px-4 py-3">Date</th>
                        <th className="px-4 py-3 w-[160px]">Status</th>
                        <th className="px-4 py-3">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line">
                      {voucherRegister.map((voucher) => (
                        <tr key={voucher.id} className="hover:bg-cloud">
                          <td className="px-4 py-3 font-bold text-navy">{voucher.requisitionNo || voucher.tourNo}</td>
                          <td className="px-4 py-3">{voucher.hotelName}</td>
                          <td className="px-4 py-3">{voucher.customerName}</td>
                          <td className="px-4 py-3">{new Date(voucher.voucherDate).toLocaleDateString()}</td>
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
          isLoading={isLoadingTree}
          isMigrating={isMigrating}
          collapsed={explorerCollapsed}
          onToggleCollapse={() => setExplorerCollapsed((prev) => !prev)}
          onSelectFolder={handleSelectToursFolder}
          onRefresh={refreshToursFolderTree}
          onOpenFile={(filePath) => window.meridian?.openDocument(filePath)}
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
  );
}

