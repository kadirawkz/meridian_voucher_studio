import React, { useState, useRef, useEffect } from "react";
import { useAppTheme } from "./hooks/useAppTheme";
import { useAppAuth } from "./hooks/useAppAuth";
import { useToursExplorer } from "./hooks/useToursExplorer";
import { useWorkspaceSearch } from "./hooks/useWorkspaceSearch";
import { useVoucherRegister } from "./hooks/useVoucherRegister";
import { useVoucherForm } from "./hooks/useVoucherForm";
import { withAccountDefaults } from "../domain/voucherUtils";
import { defaultVoucher } from "../domain/defaultVoucher";
import type { VoucherFormValues } from "../domain/voucherSchema";
import type { AppNotification } from "./MenuBar";
import type { VoucherRecord } from "../../electron/shared/types";
import { friendlyErrorMessage } from "../utils/errors";

type ActiveView =
  | "entry"
  | "dashboard"
  | "register"
  | "rate-master"
  | "manage-rates"
  | "settings"
  | "profile";

export function useAppBridge() {
  // Global notice/notification state (needed across various hooks)
  const [notices, setNotices] = useState<AppNotification[]>([]);
  const clearNotice = (id: string) =>
    setNotices((prev) => prev.filter((n) => n.id !== id));
  const clearAllNotices = () => setNotices([]);

  const addNotice = (
    message: string,
    type: AppNotification["type"] = "info",
  ) => {
    const id = Math.random().toString(36).substring(2, 9);

    setNotices((prev) => {
      // Deduplicate: If an identical message was added within the last 4 seconds, ignore it to prevent spam
      const duplicate = prev.find((n) => n.message === message);
      if (duplicate && Date.now() - duplicate.timestamp < 4000) {
        return prev;
      }
      return [{ id, message, type, timestamp: Date.now() }, ...prev].slice(
        0,
        50,
      );
    });
  };

  // 1. Theme Management Hook
  const theme = useAppTheme();

  // 2. Authentication Management Hook
  const auth = useAppAuth({
    addNotice,
    onAuthLoaded: (profile) => {
      formHook.resetForm(
        withAccountDefaults(formHook.form.getValues(), profile),
      );
    },
  });

  // Basic layout state
  const [activeView, setActiveView] = useState<ActiveView>(() => {
    // sessionStorage persists across page reloads/refreshes, but resets on new application startup
    const saved = window.sessionStorage.getItem("activeView");
    return (saved as ActiveView) || "dashboard";
  });

  // Sync view history to browser history to enable mouse back/forward button navigation
  useEffect(() => {
    const initialView =
      window.sessionStorage.getItem("activeView") || "dashboard";
    window.history.replaceState(initialView, "");

    const handlePopState = (e: PopStateEvent) => {
      if (e.state) {
        setActiveView(e.state as ActiveView);
      }
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  useEffect(() => {
    if (window.history.state !== activeView) {
      window.history.pushState(activeView, "");
    }
    window.sessionStorage.setItem("activeView", activeView);
  }, [activeView]);

  const [previewMode, setPreviewMode] = useState<
    "collapsed" | "thumbnail" | "expanded"
  >("thumbnail");
  const [previewPos, setPreviewPos] = useState(() => ({
    x: 8,
    y: Math.max(8, window.innerHeight / 2 - 100),
  }));
  const [isDraggingPreview, setIsDraggingPreview] = useState(false);
  const dragStartRef = useRef({ mouseX: 0, mouseY: 0, startX: 0, startY: 0 });
  const [windowSize, setWindowSize] = useState({
    width: window.innerWidth,
    height: window.innerHeight,
  });
  const [showReportIssue, setShowReportIssue] = useState(false);
  const [navCollapsed, setNavCollapsed] = useState(false);
  const [showAccountMenu, setShowAccountMenu] = useState(false);
  const [editHotelRateId, setEditHotelRateId] = useState<string | undefined>();

  const startDragPreview = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDraggingPreview(true);
    dragStartRef.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      startX: previewPos.x,
      startY: previewPos.y,
    };

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const dx = moveEvent.clientX - dragStartRef.current.mouseX;
      const dy = moveEvent.clientY - dragStartRef.current.mouseY;
      setPreviewPos({
        x: dragStartRef.current.startX + dx,
        y: dragStartRef.current.startY + dy,
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

  // Scroll tracking Refs
  const scrollPositionsRef = useRef<Record<string, number>>({});
  const mainRef = useRef<HTMLElement>(null);
  const prevViewRef = useRef<ActiveView>("dashboard");

  const accountMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        accountMenuRef.current &&
        !accountMenuRef.current.contains(event.target as Node)
      ) {
        setShowAccountMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // 3. Tours Directories Hook
  const explorer = useToursExplorer({
    isAuthenticated: auth.authState.isAuthenticated,
    addNotice,
  });

  // Automatically update windowSize and collapse side panels on window resize
  useEffect(() => {
    const handleResize = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;

      setWindowSize({ width, height });

      // Auto-collapse left sidebar on smaller screens
      if (width < 1024) {
        setNavCollapsed(true);
      }

      // Auto-collapse right explorer panel on smaller screens
      if (width < 1280) {
        explorer.setExplorerCollapsed(true);
      }
    };

    // Set initial collapse state on mount based on viewport
    handleResize();

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // 4. Workspace Search Hook
  const search = useWorkspaceSearch({
    isAuthenticated: auth.authState.isAuthenticated,
    addNotice,
  });

  // 5. Saved Register Lists Hook
  const register = useVoucherRegister({
    isAuthenticated: auth.authState.isAuthenticated,
    addNotice,
    onVoucherLoaded: (fullVoucher) => {
      formHook.resetForm(
        withAccountDefaults(
          { ...defaultVoucher, ...fullVoucher } as VoucherFormValues,
          auth.accountProfile,
        ),
      );
      setActiveView("entry");
      formHook.setGenerated(null);
    },
  });

  // 6. Voucher Forms State Hook
  const formHook = useVoucherForm({
    isAuthenticated: auth.authState.isAuthenticated,
    _activeView: activeView,
    accountProfile: auth.accountProfile,
    addNotice,
    refreshVoucherRegister: () =>
      register.refreshVoucherRegister(register.voucherFilters),
    refreshDocumentHistory: () => register.refreshDocumentHistory(),
    refreshToursFolderTree: () => explorer.refreshToursFolderTree(),
    refreshVoucherRevisions: (id) => register.refreshVoucherRevisions(id),
  });

  const handleSendEmail = async (voucherId: string) => {
    if (!window.meridian?.openEmailClient) {
      addNotice("Email service is not available.", "error");
      return;
    }

    try {
      const docs = await window.meridian.listVoucherDocuments();
      const pdfDocs = docs.filter(
        (d) => d.voucherId === voucherId && (d.pdfPath || d.format === "pdf"),
      );
      if (pdfDocs.length === 0) {
        addNotice(
          "No generated PDF voucher found to email. Please generate a PDF first.",
          "error",
        );
        return;
      }
      const latestPdfDoc = pdfDocs.sort((a, b) => {
        const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return dateB - dateA;
      })[0];

      const pdfPath =
        latestPdfDoc.pdfPath ||
        latestPdfDoc.docxPath.replace(/\.docx$/, ".pdf");

      await window.meridian.openEmailClient({ voucherId, pdfPath });

      addNotice(
        "Email client opened. PDF path has been revealed in Explorer for drag-and-drop.",
        "success",
      );

      if (formHook.form.getValues("id") === voucherId) {
        formHook.form.setValue("status", "sent");
      }

      await register.refreshVoucherRevisions(voucherId);
      await register.refreshVoucherRegister(register.voucherFilters);
      await register.refreshDocumentHistory();
    } catch (error) {
      addNotice(friendlyErrorMessage(error, "Failed to send email"), "error");
    }
  };

  return {
    // Theme properties
    activeTheme: theme.activeTheme,
    setActiveTheme: theme.setActiveTheme,
    themeClass: theme.themeClass,

    // Navigation and Shell UI state
    activeView,
    setActiveView,
    previewMode,
    setPreviewMode,
    previewPos,
    setPreviewPos,
    isDraggingPreview,
    setIsDraggingPreview,
    windowSize,
    setWindowSize,
    startDragPreview,
    showReportIssue,
    setShowReportIssue,
    navCollapsed,
    setNavCollapsed,
    showAccountMenu,
    setShowAccountMenu,
    editHotelRateId,
    setEditHotelRateId,

    // Global notifications
    notices,
    setNotices,
    addNotice,
    clearNotice,
    clearAllNotices,

    // Composed Authentication variables
    authState: auth.authState,
    setAuthState: auth.setAuthState,
    accountProfile: auth.accountProfile,
    setAccountProfile: auth.setAccountProfile,
    isCheckingAuth: auth.isCheckingAuth,
    setIsCheckingAuth: auth.setIsCheckingAuth,
    handleAuthenticated: auth.handleAuthenticated,
    handleSignOut: () =>
      auth.handleSignOut(() => {
        formHook.setGenerated(null);
        register.setDocumentHistory([]);
        register.setVoucherRevisions([]);
        formHook.resetForm(defaultVoucher);
      }),

    // Composed Explorer variables
    toursFolderPath: explorer.toursFolderPath,
    setToursFolderPath: explorer.setToursFolderPath,
    toursFolderTree: explorer.toursFolderTree,
    setToursFolderTree: explorer.setToursFolderTree,
    toursFolderExists: explorer.toursFolderExists,
    setToursFolderExists: explorer.setToursFolderExists,
    isLoadingTree: explorer.isLoadingTree,
    setIsLoadingTree: explorer.setIsLoadingTree,
    isMigrating: explorer.isMigrating,
    setIsMigrating: explorer.setIsMigrating,
    explorerCollapsed: explorer.explorerCollapsed,
    setExplorerCollapsed: explorer.setExplorerCollapsed,
    refreshToursFolderTree: explorer.refreshToursFolderTree,
    handleSelectToursFolder: explorer.handleSelectToursFolder,
    handleMigrateVouchers: explorer.handleMigrateVouchers,
    handleRevealFile: explorer.handleRevealFile,

    // Composed Workspace Search variables
    searchQuery: search.searchQuery,
    setSearchQuery: search.setSearchQuery,
    searchResults: search.searchResults,
    setSearchResults: search.setSearchResults,
    isSearching: search.isSearching,
    setIsSearching: search.setIsSearching,

    // Composed Register variables
    documentHistory: register.documentHistory,
    setDocumentHistory: register.setDocumentHistory,
    voucherRevisions: register.voucherRevisions,
    setVoucherRevisions: register.setVoucherRevisions,
    voucherRegister: register.voucherRegister,
    setVoucherRegister: register.setVoucherRegister,
    voucherFilters: register.voucherFilters,
    setVoucherFilters: register.setVoucherFilters,
    isLoadingRegister: register.isLoadingRegister,
    setIsLoadingRegister: register.setIsLoadingRegister,
    openingVoucherId: register.openingVoucherId,
    setOpeningVoucherId: register.setOpeningVoucherId,
    statusUpdatingId: register.statusUpdatingId,
    setStatusUpdatingId: register.setStatusUpdatingId,
    refreshDocumentHistory: register.refreshDocumentHistory,
    refreshVoucherRegister: register.refreshVoucherRegister,
    refreshVoucherRevisions: register.refreshVoucherRevisions,
    handleVoucherStatusUpdate: register.handleVoucherStatusUpdate,
    openVoucherFromSearch: (voucher: VoucherRecord) =>
      register.openVoucherFromSearch(voucher, () => setActiveView("entry")),

    // Composed Forms state properties
    form: formHook.form,
    resetForm: formHook.resetForm,
    lastSavedValues: formHook.lastSavedValues,
    setLastSavedValues: formHook.setLastSavedValues,
    currentValues: formHook.currentValues,
    hasChanges: formHook.hasChanges,
    fields: formHook.fields,
    append: formHook.append,
    remove: formHook.remove,
    lineItems: formHook.lineItems,
    hotelName: formHook.hotelName,
    market: formHook.market,
    ratePeriod: formHook.ratePeriod,
    customerName: formHook.customerName,
    tourType: formHook.tourType,
    voucherType: formHook.voucherType,
    dailyRooms: formHook.dailyRooms,
    uniqueContractNames: formHook.uniqueContractNames,
    actionState: formHook.actionState,
    setActionState: formHook.setActionState,
    generated: formHook.generated,
    setGenerated: formHook.setGenerated,
    hotelOptions: formHook.hotelOptions,
    marketOptions: formHook.marketOptions,
    roomCategoryOptions: formHook.roomCategoryOptions,
    customerOptions: formHook.customerOptions,
    tourTypeOptions: formHook.tourTypeOptions,
    mealBasisOptionsState: formHook.mealBasisOptionsState,
    selectedHotelRateId: formHook.selectedHotelRateId,
    setSelectedHotelRateId: formHook.setSelectedHotelRateId,
    ratesTrigger: formHook.ratesTrigger,
    setRatesTrigger: formHook.setRatesTrigger,
    availableSupplements: formHook.availableSupplements,
    manualRates: formHook.manualRates,
    setManualRates: formHook.setManualRates,
    docxDropdownOpen: formHook.docxDropdownOpen,
    setDocxDropdownOpen: formHook.setDocxDropdownOpen,
    pdfDropdownOpen: formHook.pdfDropdownOpen,
    setPdfDropdownOpen: formHook.setPdfDropdownOpen,
    handleSave: formHook.handleSave,
    handleGenerateDocx: formHook.handleGenerateDocx,
    handleGeneratePdf: formHook.handleGeneratePdf,
    handleSendEmail,
    handleClearForm: () => {
      formHook.handleClearForm();
      register.setVoucherRevisions([]);
    },

    // Scroll mapping refs
    scrollPositionsRef,
    mainRef,
    prevViewRef,
    accountMenuRef,
  };
}
