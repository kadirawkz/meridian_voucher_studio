import React, { useEffect, useState } from "react";
import {
  FolderOpen,
  Save,
  RotateCcw,
  Sun,
  Moon,
  Monitor,
  Trash2,
  Plus,
  AlertTriangle,
  Archive,
  RotateCw,
  Upload,
  Download,
  FileText,
} from "lucide-react";
import type {
  TourTypeRef,
  MarketRef,
  RoomCategoryRef,
  CustomerRef,
  MealBasisRef,
  CurrencyRef,
  VoucherTemplateInfo,
  AccountProfile,
  HotelRef,
} from "../../electron/shared/types";

interface AppSettings {
  toursFolderRoot?: string;
  exportDirectory?: string;
  theme?: "light" | "dark" | "system";
  activeTemplateName?: string;
}

interface SettingsScreenProps {
  activeTheme?: "light" | "dark" | "system";
  onThemeChange?: (theme: "light" | "dark" | "system") => void;
  onReferencesChanged?: () => void;
  accountProfile: AccountProfile | null;
  onProfileUpdated: (profile: AccountProfile) => void;
  addNotice?: (message: string, type?: "info" | "success" | "error") => void;
}

export function SettingsScreen({
  activeTheme = "system",
  onThemeChange,
  onReferencesChanged,
  accountProfile: propAccountProfile,
  onProfileUpdated,
  addNotice,
}: SettingsScreenProps) {
  const [settings, setSettings] = useState<AppSettings>({ theme: activeTheme });
  const [accountProfile, setAccountProfile] = useState<AccountProfile | null>(
    propAccountProfile,
  );
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (propAccountProfile) {
      setAccountProfile(propAccountProfile);
    }
  }, [propAccountProfile]);

  const isAdminOrManager =
    accountProfile?.role === "admin" || accountProfile?.role === "manager";

  const [activeMainTab, setActiveMainTab] = useState<
    "system" | "templates" | "references"
  >("system");
  const [activeSubTab, setActiveSubTab] = useState<
    | "hotels"
    | "tour-types"
    | "markets"
    | "customers"
    | "room-categories"
    | "meal-basis"
    | "currencies"
  >("currencies");

  // Reference States
  const [hotels, setHotels] = useState<HotelRef[]>([]);
  const [tourTypes, setTourTypes] = useState<TourTypeRef[]>([]);
  const [markets, setMarkets] = useState<MarketRef[]>([]);
  const [roomCategories, setRoomCategories] = useState<RoomCategoryRef[]>([]);
  const [customers, setCustomers] = useState<CustomerRef[]>([]);
  const [mealBasis, setMealBasis] = useState<MealBasisRef[]>([]);
  const [currencies, setCurrencies] = useState<CurrencyRef[]>([]);

  const [newCode, setNewCode] = useState("");
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{
    type: string;
    id: string;
    label: string;
  } | null>(null);

  // Archived (inactive) items
  const [showArchived, setShowArchived] = useState(false);
  const [archivedItems, setArchivedItems] = useState<Record<string, unknown>[]>(
    [],
  );
  const [isLoadingArchived, setIsLoadingArchived] = useState(false);
  const [deletingIds, setDeletingIds] = useState<string[]>([]);
  const [restoringIds, setRestoringIds] = useState<string[]>([]);

  // Database Voucher Templates states
  const [dbTemplates, setDbTemplates] = useState<VoucherTemplateInfo[]>([]);
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(false);
  const [uploadingTemplate, setUploadingTemplate] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState("");
  const [selectedDocxPath, setSelectedDocxPath] = useState("");
  const [selectedHtmlPath, setSelectedHtmlPath] = useState("");

  useEffect(() => {
    loadSettingsAndProfile();
    loadAllReferences();
    loadDbTemplates();
  }, []);

  useEffect(() => {
    setSettings((prev) => ({ ...prev, theme: activeTheme }));
  }, [activeTheme]);

  async function loadSettingsAndProfile() {
    try {
      const [settingsResult, profileResult] = await Promise.all([
        window.meridian.getSettings() as Promise<AppSettings>,
        window.meridian.getAccountProfile() as Promise<AccountProfile>,
      ]);
      setSettings({
        ...settingsResult,
        theme: activeTheme,
      });
      setAccountProfile(profileResult);
      if (onProfileUpdated) {
        onProfileUpdated(profileResult);
      }
    } catch (error) {
      console.error("Failed to load settings or profile:", error);
      if (addNotice) {
        addNotice("Failed to load settings or user profile.", "error");
      }
    }
  }

  async function loadDbTemplates() {
    try {
      setIsLoadingTemplates(true);
      const list = await window.meridian.listDatabaseTemplates();
      setDbTemplates(list || []);
    } catch (error) {
      console.error("Failed to load templates:", error);
    } finally {
      setIsLoadingTemplates(false);
    }
  }

  async function handleSelectDocx() {
    try {
      const docxPath = await window.meridian.selectFile({
        title: "Select Voucher Word Template (.docx)",
        filters: [{ name: "Word Documents", extensions: ["docx"] }],
      });
      if (docxPath) {
        setSelectedDocxPath(docxPath);
      }
    } catch (error) {
      console.error("Failed to select DOCX file:", error);
    }
  }

  async function handleSelectHtml() {
    try {
      const htmlPath = await window.meridian.selectFile({
        title: "Select Voucher HTML Template (.html)",
        filters: [{ name: "HTML Documents", extensions: ["html"] }],
      });
      if (htmlPath) {
        setSelectedHtmlPath(htmlPath);
      }
    } catch (error) {
      console.error("Failed to select HTML file:", error);
    }
  }

  async function handleUploadTemplate() {
    if (!newTemplateName.trim()) {
      if (addNotice) {
        addNotice("Please enter a name for the template before uploading.", "error");
      }
      return;
    }

    if (!selectedDocxPath) {
      if (addNotice) {
        addNotice("Please select a Word template (.docx).", "error");
      }
      return;
    }

    if (!selectedHtmlPath) {
      if (addNotice) {
        addNotice("Please select an HTML template (.html).", "error");
      }
      return;
    }

    try {
      setUploadingTemplate(true);
      await window.meridian.uploadDatabaseTemplate(
        newTemplateName.trim(),
        selectedDocxPath,
        selectedHtmlPath,
      );
      setNewTemplateName("");
      setSelectedDocxPath("");
      setSelectedHtmlPath("");
      if (addNotice) {
        addNotice(`Template "${newTemplateName.trim()}" uploaded successfully to database.`, "success");
      }
      await loadDbTemplates();
    } catch (error: unknown) {
      console.error("Failed to upload template:", error);
      const errMsg =
        error instanceof Error ? error.message : "Failed to upload template";
      if (addNotice) {
        addNotice(errMsg, "error");
      }
    } finally {
      setUploadingTemplate(false);
    }
  }

  async function handleDownloadTemplate(name: string) {
    try {
      const success = await window.meridian.downloadDatabaseTemplate(name);
      if (success && addNotice) {
        addNotice(`Template "${name}" downloaded successfully.`, "success");
      }
    } catch (error) {
      console.error("Failed to download template:", error);
      if (addNotice) {
        addNotice(`Failed to download template "${name}".`, "error");
      }
    }
  }

  async function handleDeleteTemplate(name: string) {
    try {
      await window.meridian.deleteDatabaseTemplate(name);
      if (addNotice) {
        addNotice(`Template "${name}" deleted successfully.`, "success");
      }

      // If the deleted template was the active one, clear it
      if (settings.activeTemplateName === name) {
        const nextSettings = { ...settings, activeTemplateName: "" };
        setSettings(nextSettings);
        await window.meridian.saveSettings(nextSettings);
      }

      await loadDbTemplates();
    } catch (error) {
      console.error("Failed to delete template:", error);
      if (addNotice) {
        addNotice(`Failed to delete template "${name}".`, "error");
      }
    }
  }

  async function loadAllReferences() {
    try {
      if (window.meridian.listHotels) {
        const res = await window.meridian.listHotels();
        setHotels(res || []);
      }
      if (window.meridian.listTourTypes) {
        const res = await window.meridian.listTourTypes();
        setTourTypes(res || []);
      }
      if (window.meridian.listMarkets) {
        const res = await window.meridian.listMarkets();
        setMarkets(res || []);
      }
      if (window.meridian.listRoomCategories) {
        const res = await window.meridian.listRoomCategories();
        setRoomCategories(res || []);
      }
      if (window.meridian.listCustomers) {
        const res = await window.meridian.listCustomers();
        setCustomers(res || []);
      }
      if (window.meridian.listMealBasis) {
        const res = await window.meridian.listMealBasis();
        setMealBasis(res || []);
      }
      if (window.meridian.listCurrencies) {
        const res = await window.meridian.listCurrencies();
        setCurrencies(res || []);
      }
    } catch (error) {
      console.error("Failed to load references:", error);
    }
  }

  async function saveSettings() {
    try {
      setIsSaving(true);
      await window.meridian.saveSettings(settings as Record<string, unknown>);
      if (addNotice) {
        addNotice("System configuration settings saved successfully.", "success");
      }
    } catch (error) {
      console.error("Failed to save settings:", error);
      if (addNotice) {
        addNotice("Failed to save system configuration settings.", "error");
      }
    } finally {
      setIsSaving(false);
    }
  }

  async function selectToursFolder() {
    try {
      const result = await window.meridian.selectFolder({
        title: "Select Tours Folder",
      });
      if (result) {
        setSettings({ ...settings, toursFolderRoot: result });
      }
    } catch (error) {
      console.error("Failed to select tours folder:", error);
    }
  }

  async function selectExportDirectory() {
    try {
      const result = await window.meridian.selectFolder({
        title: "Select Export Directory",
        defaultPath: settings.exportDirectory,
      });
      if (result) {
        setSettings({ ...settings, exportDirectory: result });
      }
    } catch (error) {
      console.error("Failed to select export directory:", error);
    }
  }

  async function handleAddItem(e: React.FormEvent) {
    e.preventDefault();
    try {
      if (activeSubTab === "hotels") {
        if (!newName.trim()) return;
        await window.meridian.saveHotel({
          name: newName.trim(),
          email: newEmail.trim() || undefined,
          is_active: true,
        });
      } else if (activeSubTab === "tour-types") {
        if (!newCode.trim()) return;
        await window.meridian.saveTourType({
          code: newCode.trim().toUpperCase(),
          name: newName.trim() || newCode.trim().toUpperCase(),
        });
      } else if (activeSubTab === "markets") {
        if (!newCode.trim()) return;
        await window.meridian.saveMarket({
          code: newCode.trim().toUpperCase(),
          name: newName.trim() || newCode.trim().toUpperCase(),
        });
      } else if (activeSubTab === "meal-basis") {
        if (!newCode.trim()) return;
        await window.meridian.saveMealBasis({
          code: newCode.trim().toUpperCase(),
          name: newName.trim() || newCode.trim().toUpperCase(),
        });
      } else if (activeSubTab === "customers") {
        if (!newName.trim()) return;
        await window.meridian.saveCustomer({
          name: newName.trim(),
          is_active: true,
        });
      } else if (activeSubTab === "room-categories") {
        if (!newName.trim()) return;
        await window.meridian.saveRoomCategory({ name: newName.trim() });
      } else if (activeSubTab === "currencies") {
        if (!newCode.trim()) return;
        await window.meridian.saveCurrency({
          code: newCode.trim().toUpperCase(),
          name: newName.trim() || newCode.trim().toUpperCase(),
        });
      }

      setNewCode("");
      setNewName("");
      setNewEmail("");
      if (addNotice) {
        addNotice(`Successfully added item "${newName.trim() || newCode.trim().toUpperCase()}" to reference list.`, "success");
      }
      await loadAllReferences();
      if (onReferencesChanged) onReferencesChanged();
    } catch (error) {
      console.error("Failed to add item:", error);
      if (addNotice) {
        addNotice("Failed to add item to reference list.", "error");
      }
    }
  }

  function triggerDelete(type: string, id: string, label: string) {
    setDeleteTarget({ type, id, label });
    setShowDeleteConfirm(true);
  }

  /** Map UI sub-tab names to DB table names */
  function subTabToTable(subTab: string): string {
    const map: Record<string, string> = {
      hotels: "hotels",
      "tour-types": "tour_types",
      markets: "markets",
      customers: "customers",
      "room-categories": "room_categories",
      "meal-basis": "meal_basis",
      currencies: "currencies",
    };
    return map[subTab] ?? subTab;
  }

  async function loadArchivedItems() {
    try {
      setIsLoadingArchived(true);
      const table = subTabToTable(activeSubTab);
      const items = await window.meridian.listInactiveReferences(table);
      setArchivedItems(items || []);
    } catch (error) {
      console.error("Failed to load archived items:", error);
      setArchivedItems([]);
    } finally {
      setIsLoadingArchived(false);
    }
  }

  async function handleRestore(id: string) {
    try {
      setRestoringIds((prev) => [...prev, id]);
      const table = subTabToTable(activeSubTab);

      await Promise.all([
        window.meridian.restoreReference(table, id),
        new Promise((resolve) => setTimeout(resolve, 350)),
      ]);

      if (addNotice) {
        addNotice("Reference item restored successfully.", "success");
      }
      await loadAllReferences();
      await loadArchivedItems();
      if (onReferencesChanged) onReferencesChanged();
    } catch (error) {
      console.error("Failed to restore item:", error);
      if (addNotice) {
        addNotice("Failed to restore reference item.", "error");
      }
    } finally {
      setRestoringIds((prev) => prev.filter((item) => item !== id));
    }
  }

  async function handleConfirmDelete() {
    if (!deleteTarget) return;
    const { type, id } = deleteTarget;
    try {
      setShowDeleteConfirm(false);
      setDeletingIds((prev) => [...prev, id]);

      const apiCall = (async () => {
        if (type === "hotels") {
          await window.meridian.deleteHotel(id);
        } else if (type === "tour-types") {
          await window.meridian.deleteTourType(id);
        } else if (type === "markets") {
          await window.meridian.deleteMarket(id);
        } else if (type === "meal-basis") {
          await window.meridian.deleteMealBasis(id);
        } else if (type === "customers") {
          await window.meridian.deleteCustomer(id);
        } else if (type === "room-categories") {
          await window.meridian.deleteRoomCategory(id);
        } else if (type === "currencies") {
          await window.meridian.deleteCurrency(id);
        }
      })();

      await Promise.all([
        apiCall,
        new Promise((resolve) => setTimeout(resolve, 350)),
      ]);

      if (addNotice) {
        addNotice(`Reference item "${deleteTarget.label}" successfully deleted and archived.`, "success");
      }
      await loadAllReferences();
      if (showArchived) await loadArchivedItems();
      if (onReferencesChanged) onReferencesChanged();
    } catch (error) {
      console.error("Failed to delete item:", error);
      if (addNotice) {
        addNotice(`Failed to delete reference item "${deleteTarget.label}".`, "error");
      }
    } finally {
      setDeletingIds((prev) => prev.filter((item) => item !== id));
      setDeleteTarget(null);
    }
  }

  return (
    <div className="mx-auto max-w-4xl p-4 md:p-8">
      {/* Main Tab Navigation */}
      <div className="flex gap-6 border-b border-line mb-6">
        <button
          type="button"
          onClick={() => setActiveMainTab("system")}
          className={`pb-3 font-semibold text-sm transition-all border-b-2 -mb-[2px] ${
            activeMainTab === "system"
              ? "border-navy text-navy font-bold"
              : "border-transparent text-steel hover:text-navy"
          }`}
        >
          System Configuration
        </button>
        <button
          type="button"
          onClick={() => setActiveMainTab("references")}
          className={`pb-3 font-semibold text-sm transition-all border-b-2 -mb-[2px] ${
            activeMainTab === "references"
              ? "border-navy text-navy font-bold"
              : "border-transparent text-steel hover:text-navy"
          }`}
        >
          Reference Lists
        </button>
        {isAdminOrManager && (
          <button
            type="button"
            onClick={() => setActiveMainTab("templates")}
            className={`pb-3 font-semibold text-sm transition-all border-b-2 -mb-[2px] ${
              activeMainTab === "templates"
                ? "border-navy text-navy font-bold"
                : "border-transparent text-steel hover:text-navy"
            }`}
          >
            Voucher Templates
          </button>
        )}
      </div>



      {activeMainTab === "system" && (
        <div className="space-y-6">
          {/* Workspace Settings */}
          <section className="app-panel app-panel-body-lg">
            <h3 className="mb-5 app-section-title">Workspace</h3>
            <div className="space-y-5">
              <div>
                <label className="block space-y-2 mb-3">
                  <span className="app-label">Tours Folder Root</span>
                  <p className="text-xs text-steel">
                    Location where tour folders are organized
                  </p>
                </label>
                <div className="flex items-center gap-3">
                  <div className="flex-1 min-w-0 truncate rounded-app border border-line bg-cloud px-3 py-2 text-sm text-steel">
                    {settings.toursFolderRoot || "Not set"}
                  </div>
                  <button
                    type="button"
                    onClick={selectToursFolder}
                    className="app-button-secondary whitespace-nowrap"
                  >
                    <FolderOpen size={16} /> Select
                  </button>
                </div>
              </div>

              <div>
                <label className="block space-y-2 mb-3">
                  <span className="app-label">Export Directory</span>
                  <p className="text-xs text-steel">
                    Default location for generated PDF and DOCX files
                  </p>
                </label>
                <div className="flex items-center gap-3">
                  <div className="flex-1 min-w-0 truncate rounded-app border border-line bg-cloud px-3 py-2 text-sm text-steel">
                    {settings.exportDirectory ||
                      "Documents/Meridian Voucher Studio"}
                  </div>
                  <button
                    type="button"
                    onClick={selectExportDirectory}
                    className="app-button-secondary whitespace-nowrap"
                  >
                    <FolderOpen size={16} /> Select
                  </button>
                </div>
              </div>
            </div>
          </section>

          {/* Appearance Settings */}
          <section className="app-panel app-panel-body-lg">
            <h3 className="mb-5 app-section-title">Appearance</h3>
            <div className="space-y-4">
              <div>
                <label className="block space-y-2 mb-3">
                  <span className="app-label">Application Theme</span>
                  <p className="text-xs text-steel">
                    Choose how Meridian Voucher Studio looks on your screen
                  </p>
                </label>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {[
                    {
                      value: "light",
                      label: "Light Theme",
                      icon: Sun,
                      desc: "Clean and classic, ideal for bright workspaces.",
                    },
                    {
                      value: "dark",
                      label: "Dark Theme",
                      icon: Moon,
                      desc: "A sleek, low-glare dark palette optimized for clarity.",
                    },
                    {
                      value: "system",
                      label: "System Sync",
                      icon: Monitor,
                      desc: "Automatically match your computer's OS theme.",
                    },
                  ].map((item) => {
                    const Icon = item.icon;
                    const isSelected =
                      (settings.theme || "system") === item.value;
                    return (
                      <button
                        key={item.value}
                        type="button"
                        onClick={async () => {
                          const nextSettings = {
                            ...settings,
                            theme: item.value as "light" | "dark" | "system",
                          };
                          setSettings(nextSettings);
                          if (onThemeChange) {
                            onThemeChange(
                              item.value as "light" | "dark" | "system",
                            );
                          }
                          try {
                            await window.meridian.saveSettings(
                              nextSettings as Record<string, unknown>,
                            );
                          } catch (err) {
                            console.error(
                              "Failed to auto-save theme settings:",
                              err,
                            );
                          }
                        }}
                        className={`flex flex-col items-start rounded-app border p-4 text-left transition-all ${
                          isSelected
                            ? "border-navy bg-[var(--color-accent-bg)] text-navy shadow-sm"
                            : "border-line bg-surface text-ink hover:border-steel"
                        }`}
                      >
                        <div className="flex items-center gap-2 font-bold text-sm">
                          <Icon
                            size={18}
                            className={isSelected ? "text-navy" : "text-steel"}
                          />
                          <span>{item.label}</span>
                        </div>
                        <p className="mt-2 text-xs text-steel leading-relaxed">
                          {item.desc}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </section>

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-3 justify-end">
            <button
              type="button"
              onClick={loadSettingsAndProfile}
              className="app-button-secondary w-40"
            >
              <RotateCcw size={16} /> Reset
            </button>
            <button
              type="button"
              onClick={saveSettings}
              disabled={isSaving}
              className="app-button-primary w-40"
            >
              <Save size={16} /> {isSaving ? "Saving..." : "Save Settings"}
            </button>
          </div>
        </div>
      )}

      {activeMainTab === "templates" && isAdminOrManager && (
        <div className="space-y-6">
          {/* Voucher Templates Section */}
          <section className="app-panel app-panel-body-lg">
            <h3 className="mb-5 app-section-title">Voucher Templates</h3>
            <div className="space-y-6">
              {/* Active Template Selector */}
              <div>
                <label className="block space-y-2 mb-3">
                  <span className="app-label">Active Company Template</span>
                  <p className="text-xs text-steel">
                    Select the voucher template that all employees will use for
                    document generation
                  </p>
                </label>
                <select
                  id="active-template-name"
                  aria-label="Active Company Template"
                  title="Active Company Template"
                  value={settings.activeTemplateName || ""}
                  disabled={!isAdminOrManager}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      activeTemplateName: e.target.value,
                    })
                  }
                  className="w-full md:w-1/2 rounded-app border border-line bg-surface px-3 py-2 text-sm font-semibold text-navy outline-none focus:border-navy disabled:opacity-75 disabled:cursor-not-allowed"
                >
                  <option value="">
                    -- Select a Template --
                  </option>
                  {dbTemplates.map((t) => (
                    <option key={t.id} value={t.name}>
                      {t.name} (Uploaded{" "}
                      {t.created_at
                        ? new Date(t.created_at).toLocaleDateString()
                        : "N/A"}
                      )
                    </option>
                  ))}
                </select>
              </div>

              {isAdminOrManager && (
                <>
                  <hr className="border-line" />

                  {/* Upload Form */}
                  <div className="space-y-4">
                    <h4 className="font-bold text-xs uppercase text-steel tracking-wider">
                      Upload Custom Template
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Left side: Template Name and Upload button */}
                      <div className="space-y-4">
                        <div>
                          <label className="block mb-1.5 text-xs font-bold text-navy">
                            Template Name
                          </label>
                          <input
                            type="text"
                            value={newTemplateName}
                            onChange={(e) => setNewTemplateName(e.target.value)}
                            placeholder="e.g. Standard Tour Template, Winter Special"
                            className="w-full rounded-app border border-line bg-surface px-3 py-2 text-sm font-semibold text-navy outline-none focus:border-navy"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={handleUploadTemplate}
                          disabled={
                            uploadingTemplate ||
                            !newTemplateName.trim() ||
                            !selectedDocxPath ||
                            !selectedHtmlPath
                          }
                          className="app-button-primary w-full py-2 text-sm font-semibold flex items-center justify-center gap-1.5"
                        >
                          <Upload size={16} />
                          {uploadingTemplate ? "Uploading..." : "Upload Template"}
                        </button>
                      </div>

                      {/* Right side: Two required files selection */}
                      <div className="space-y-3">
                        <label className="block text-xs font-bold text-navy">
                          Required Template Files
                        </label>
                        
                        {/* Word Template Selection */}
                        <div className="flex items-center gap-3">
                          <button
                            type="button"
                            onClick={handleSelectDocx}
                            className={`flex-1 flex items-center justify-between border rounded-app px-3 py-2 text-sm transition-all ${
                              selectedDocxPath
                                ? "border-emerald-500/30 bg-emerald-50/10 text-emerald-800"
                                : "border-line bg-surface hover:border-steel text-steel"
                            }`}
                          >
                            <span className="truncate font-semibold max-w-[80%]">
                              {selectedDocxPath
                                ? selectedDocxPath.split(/[\\/]/).pop()
                                : "Select Word Template (.docx)"}
                            </span>
                            <span className="text-xs px-2 py-0.5 rounded-full bg-cloud font-bold text-navy shrink-0 border border-line">
                              {selectedDocxPath ? "Selected" : "Word"}
                            </span>
                          </button>
                          {selectedDocxPath && (
                            <button
                              type="button"
                              onClick={() => setSelectedDocxPath("")}
                              className="text-red-500 hover:text-red-700 p-1"
                              title="Clear Word selection"
                            >
                              <Trash2 size={16} />
                            </button>
                          )}
                        </div>

                        {/* HTML Template Selection */}
                        <div className="flex items-center gap-3">
                          <button
                            type="button"
                            onClick={handleSelectHtml}
                            className={`flex-1 flex items-center justify-between border rounded-app px-3 py-2 text-sm transition-all ${
                              selectedHtmlPath
                                ? "border-emerald-500/30 bg-emerald-50/10 text-emerald-800"
                                : "border-line bg-surface hover:border-steel text-steel"
                            }`}
                          >
                            <span className="truncate font-semibold max-w-[80%]">
                              {selectedHtmlPath
                                ? selectedHtmlPath.split(/[\\/]/).pop()
                                : "Select HTML Template (.html)"}
                            </span>
                            <span className="text-xs px-2 py-0.5 rounded-full bg-cloud font-bold text-navy shrink-0 border border-line">
                              {selectedHtmlPath ? "Selected" : "HTML"}
                            </span>
                          </button>
                          {selectedHtmlPath && (
                            <button
                              type="button"
                              onClick={() => setSelectedHtmlPath("")}
                              className="text-red-500 hover:text-red-700 p-1"
                              title="Clear HTML selection"
                            >
                              <Trash2 size={16} />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </>
              )}

              {/* Database Templates Table */}
              <div>
                <h4 className="font-bold text-xs uppercase text-steel tracking-wider mb-3">
                  Templates in Database
                </h4>
                <div className="overflow-hidden border border-line rounded-app bg-surface shadow-sm">
                  <table className="w-full border-collapse text-left text-sm text-navy">
                    <thead>
                      <tr className="bg-cloud border-b border-line text-xs font-bold uppercase tracking-wider text-steel">
                        <th className="px-4 py-2.5">Template Name</th>
                        <th className="px-4 py-2.5">Last Updated</th>
                        <th className="px-4 py-2.5 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line">
                      {isLoadingTemplates ? (
                        <tr>
                          <td
                            colSpan={3}
                            className="px-4 py-8 text-center text-steel italic"
                          >
                            Loading templates...
                          </td>
                        </tr>
                      ) : dbTemplates.length === 0 ? (
                        <tr>
                          <td
                            colSpan={3}
                            className="px-4 py-8 text-center text-steel italic"
                          >
                            No templates uploaded. Please upload a template (Word & HTML) to enable document generation.
                          </td>
                        </tr>
                      ) : (
                        dbTemplates.map((t) => (
                          <tr key={t.id} className="hover:bg-cloud/40">
                            <td className="px-4 py-3 font-semibold flex items-center gap-2">
                              <FileText size={16} className="text-steel" />
                              <span>{t.name}</span>
                              {settings.activeTemplateName === t.name && (
                                <span className="rounded-full bg-green-500/10 text-green-600 px-2 py-0.5 text-xs font-bold">
                                  Active
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-steel">
                              {t.updated_at || t.created_at
                                ? new Date(
                                    t.updated_at || t.created_at || "",
                                  ).toLocaleString()
                                : "N/A"}
                            </td>
                            <td className="px-4 py-3 text-right">
                              <div className="flex gap-2 justify-end">
                                <button
                                  type="button"
                                  onClick={() => handleDownloadTemplate(t.name)}
                                  title="Download Template"
                                  className="text-steel hover:text-navy rounded p-1 hover:bg-cloud transition-colors"
                                >
                                  <Download size={16} />
                                </button>
                                {isAdminOrManager && (
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteTemplate(t.name)}
                                    title="Delete Template"
                                    className="text-steel hover:text-red-500 rounded p-1 hover:bg-red-500/10 transition-colors"
                                  >
                                    <Trash2 size={16} />
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </section>

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-3 justify-end">
            <button
              type="button"
              onClick={loadSettingsAndProfile}
              className="app-button-secondary w-40"
            >
              <RotateCcw size={16} /> Reset
            </button>
            <button
              type="button"
              onClick={saveSettings}
              disabled={isSaving}
              className="app-button-primary w-40"
            >
              <Save size={16} /> {isSaving ? "Saving..." : "Save Settings"}
            </button>
          </div>
        </div>
      )}

      {activeMainTab === "references" && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {/* Side Subtabs Navigation */}
          <div className="md:col-span-1 flex flex-col gap-1 border-r border-line pr-4">
            {[
              { id: "currencies", label: "Currencies" },
              { id: "customers", label: "Customers" },
              { id: "hotels", label: "Hotels" },
              { id: "markets", label: "Markets" },
              { id: "meal-basis", label: "Meal Basis" },
              { id: "room-categories", label: "Room Categories" },
              { id: "tour-types", label: "Tour Types" },
            ].map((subTab) => (
              <button
                key={subTab.id}
                type="button"
                onClick={() => {
                  setActiveSubTab(
                    subTab.id as
                      | "hotels"
                      | "tour-types"
                      | "markets"
                      | "customers"
                      | "room-categories"
                      | "meal-basis"
                      | "currencies",
                  );
                  setNewCode("");
                  setNewName("");
                  setNewEmail("");
                  setShowArchived(false);
                  setArchivedItems([]);
                }}
                className={`w-full text-left px-3 py-2 text-sm font-semibold rounded-app transition-all ${
                  activeSubTab === subTab.id
                    ? "bg-navy text-white shadow-sm"
                    : "text-steel hover:bg-cloud hover:text-navy"
                }`}
              >
                {subTab.label}
              </button>
            ))}
          </div>

          {/* Subtab Contents panel */}
          <div className="md:col-span-3 space-y-6">
            <section className="app-panel app-panel-body-lg">
              <h3 className="mb-4 app-section-title font-bold text-lg text-navy capitalize">
                Manage {activeSubTab.replace("-", " ")}
              </h3>

              {/* Form to add item */}
              <form
                onSubmit={handleAddItem}
                className="bg-cloud p-4 rounded-app border border-line mb-6"
              >
                <h4 className="font-bold text-xs uppercase text-steel tracking-wider mb-3">
                  Add New Entry
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-end">
                  {activeSubTab === "hotels" ? (
                    <>
                      <div>
                        <label className="block mb-1.5 text-xs font-bold text-navy">
                          Name *
                        </label>
                        <input
                          type="text"
                          required
                          value={newName}
                          onChange={(e) => setNewName(e.target.value)}
                          placeholder="e.g. Hotel Grand, Sunset Resort"
                          className="w-full rounded-app border border-line bg-surface px-3 py-1.5 text-sm font-semibold text-navy outline-none focus:border-navy"
                        />
                      </div>
                      <div>
                        <label className="block mb-1.5 text-xs font-bold text-navy">
                          Email (Optional)
                        </label>
                        <input
                          type="email"
                          value={newEmail}
                          onChange={(e) => setNewEmail(e.target.value)}
                          placeholder="e.g. reservations@hotel.com"
                          className="w-full rounded-app border border-line bg-surface px-3 py-1.5 text-sm font-semibold text-navy outline-none focus:border-navy"
                        />
                      </div>
                    </>
                  ) : [
                    "tour-types",
                    "markets",
                    "meal-basis",
                    "currencies",
                  ].includes(activeSubTab) ? (
                    <>
                      <div>
                        <label className="block mb-1.5 text-xs font-bold text-navy">
                          Code *
                        </label>
                        <input
                          type="text"
                          required
                          value={newCode}
                          onChange={(e) => setNewCode(e.target.value)}
                          placeholder={
                            activeSubTab === "tour-types"
                              ? "e.g. WSL"
                              : activeSubTab === "markets"
                                ? "e.g. UK"
                                : activeSubTab === "meal-basis"
                                  ? "e.g. BB"
                                  : "e.g. USD"
                          }
                          className="w-full rounded-app border border-line bg-surface px-3 py-1.5 text-sm font-semibold text-navy outline-none focus:border-navy"
                        />
                      </div>
                      <div>
                        <label className="block mb-1.5 text-xs font-bold text-navy">
                          Name (Optional)
                        </label>
                        <input
                          type="text"
                          value={newName}
                          onChange={(e) => setNewName(e.target.value)}
                          placeholder={
                            activeSubTab === "tour-types"
                              ? "e.g. Winter Tour"
                              : activeSubTab === "markets"
                                ? "e.g. United Kingdom"
                                : activeSubTab === "meal-basis"
                                  ? "e.g. Bed & Breakfast"
                                  : "e.g. US Dollar"
                          }
                          className="w-full rounded-app border border-line bg-surface px-3 py-1.5 text-sm font-semibold text-navy outline-none focus:border-navy"
                        />
                      </div>
                    </>
                  ) : (
                    /* Customers and room categories only need name */
                    <div className="sm:col-span-2">
                      <label className="block mb-1.5 text-xs font-bold text-navy">
                        Name *
                      </label>
                      <input
                        type="text"
                        required
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                        placeholder={
                          activeSubTab === "customers"
                            ? "Customer / Agent Name"
                            : "e.g. Executive Suite"
                        }
                        className="w-full rounded-app border border-line bg-surface px-3 py-1.5 text-sm font-semibold text-navy outline-none focus:border-navy"
                      />
                    </div>
                  )}
                </div>
                <div className="mt-4 flex justify-end">
                  <button
                    type="submit"
                    className="app-button-primary py-1.5 px-4 text-sm font-semibold flex items-center gap-1"
                  >
                    <Plus size={16} /> Add Entry
                  </button>
                </div>
              </form>

              {/* Items List Table */}
              <div className="overflow-hidden border border-line rounded-app bg-surface shadow-sm">
                <table className="w-full border-collapse text-left text-sm text-navy">
                  <thead>
                    <tr className="bg-cloud border-b border-line text-xs font-bold uppercase tracking-wider text-steel">
                      {activeSubTab === "hotels" ? (
                        <>
                          <th className="px-4 py-2.5">Name</th>
                          <th className="px-4 py-2.5">Email Address</th>
                        </>
                      ) : [
                        "tour-types",
                        "markets",
                        "meal-basis",
                        "currencies",
                      ].includes(activeSubTab) ? (
                        <>
                          <th className="px-4 py-2.5">Code</th>
                          <th className="px-4 py-2.5">Name</th>
                        </>
                      ) : (
                        <th className="px-4 py-2.5">Name</th>
                      )}
                      <th className="px-4 py-2.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {/* Rendering Hotels */}
                    {activeSubTab === "hotels" &&
                      (hotels.length === 0 ? (
                        <tr>
                          <td
                            colSpan={3}
                            className="px-4 py-8 text-center text-steel italic"
                          >
                            No hotels seeded in database.
                          </td>
                        </tr>
                      ) : (
                        hotels.map((item) => (
                          <tr
                            key={item.id}
                            className={`reference-row-transition hover:bg-cloud/40 ${
                              deletingIds.includes(item.id)
                                ? "reference-row-exit"
                                : ""
                            }`}
                          >
                            <td className="px-4 py-3 font-semibold">{item.name}</td>
                            <td className="px-4 py-3 text-steel">
                              {item.email || <span className="text-slate-300 italic">No Email Configured</span>}
                            </td>
                            <td className="px-4 py-3 text-right">
                              <button
                                type="button"
                                aria-label={`Delete hotel ${item.name}`}
                                title={`Delete hotel ${item.name}`}
                                onClick={() =>
                                  triggerDelete(
                                    "hotels",
                                    item.id,
                                    item.name,
                                  )
                                }
                                className="text-steel hover:text-red-500 rounded p-1 hover:bg-red-500/10 transition-colors"
                              >
                                <Trash2 size={16} />
                              </button>
                            </td>
                          </tr>
                        ))
                      ))}

                    {/* Rendering Tour Types */}
                    {activeSubTab === "tour-types" &&
                      (tourTypes.length === 0 ? (
                        <tr>
                          <td
                            colSpan={3}
                            className="px-4 py-8 text-center text-steel italic"
                          >
                            No tour types seeded in database.
                          </td>
                        </tr>
                      ) : (
                        tourTypes.map((item) => (
                          <tr
                            key={item.id}
                            className={`reference-row-transition hover:bg-cloud/40 ${
                              deletingIds.includes(item.id)
                                ? "reference-row-exit"
                                : ""
                            }`}
                          >
                            <td className="px-4 py-3 font-bold">{item.code}</td>
                            <td className="px-4 py-3 text-steel">
                              {item.name}
                            </td>
                            <td className="px-4 py-3 text-right">
                              <button
                                type="button"
                                aria-label={`Delete tour type ${item.code}`}
                                title={`Delete tour type ${item.code}`}
                                onClick={() =>
                                  triggerDelete(
                                    "tour-types",
                                    item.id,
                                    item.code,
                                  )
                                }
                                className="text-steel hover:text-red-500 rounded p-1 hover:bg-red-500/10 transition-colors"
                              >
                                <Trash2 size={16} />
                              </button>
                            </td>
                          </tr>
                        ))
                      ))}

                    {/* Rendering Markets */}
                    {activeSubTab === "markets" &&
                      (markets.length === 0 ? (
                        <tr>
                          <td
                            colSpan={3}
                            className="px-4 py-8 text-center text-steel italic"
                          >
                            No markets seeded in database.
                          </td>
                        </tr>
                      ) : (
                        markets.map((item) => (
                          <tr
                            key={item.id}
                            className={`reference-row-transition hover:bg-cloud/40 ${
                              deletingIds.includes(item.id)
                                ? "reference-row-exit"
                                : ""
                            }`}
                          >
                            <td className="px-4 py-3 font-bold">{item.code}</td>
                            <td className="px-4 py-3 text-steel">
                              {item.name}
                            </td>
                            <td className="px-4 py-3 text-right">
                              <button
                                type="button"
                                aria-label={`Delete market ${item.code}`}
                                title={`Delete market ${item.code}`}
                                onClick={() =>
                                  triggerDelete("markets", item.id, item.code)
                                }
                                className="text-steel hover:text-red-500 rounded p-1 hover:bg-red-500/10 transition-colors"
                              >
                                <Trash2 size={16} />
                              </button>
                            </td>
                          </tr>
                        ))
                      ))}

                    {/* Rendering Room Categories */}
                    {activeSubTab === "room-categories" &&
                      (roomCategories.length === 0 ? (
                        <tr>
                          <td
                            colSpan={2}
                            className="px-4 py-8 text-center text-steel italic"
                          >
                            No room categories seeded in database.
                          </td>
                        </tr>
                      ) : (
                        roomCategories.map((item) => (
                          <tr
                            key={item.id}
                            className={`reference-row-transition hover:bg-cloud/40 ${
                              deletingIds.includes(item.id)
                                ? "reference-row-exit"
                                : ""
                            }`}
                          >
                            <td className="px-4 py-3 font-semibold">
                              {item.name}
                            </td>
                            <td className="px-4 py-3 text-right">
                              <button
                                type="button"
                                aria-label={`Delete room category ${item.name}`}
                                title={`Delete room category ${item.name}`}
                                onClick={() =>
                                  triggerDelete(
                                    "room-categories",
                                    item.id,
                                    item.name,
                                  )
                                }
                                className="text-steel hover:text-red-500 rounded p-1 hover:bg-red-500/10 transition-colors"
                              >
                                <Trash2 size={16} />
                              </button>
                            </td>
                          </tr>
                        ))
                      ))}

                    {/* Rendering Customers */}
                    {activeSubTab === "customers" &&
                      (customers.length === 0 ? (
                        <tr>
                          <td
                            colSpan={2}
                            className="px-4 py-8 text-center text-steel italic"
                          >
                            No customer/agents loaded in database.
                          </td>
                        </tr>
                      ) : (
                        customers.map((item) => (
                          <tr
                            key={item.id}
                            className={`reference-row-transition hover:bg-cloud/40 ${
                              deletingIds.includes(item.id)
                                ? "reference-row-exit"
                                : ""
                            }`}
                          >
                            <td className="px-4 py-3 font-semibold">
                              {item.name}
                            </td>
                            <td className="px-4 py-3 text-right">
                              <button
                                type="button"
                                aria-label={`Delete customer ${item.name}`}
                                title={`Delete customer ${item.name}`}
                                onClick={() =>
                                  triggerDelete("customers", item.id, item.name)
                                }
                                className="text-steel hover:text-red-500 rounded p-1 hover:bg-red-500/10 transition-colors"
                              >
                                <Trash2 size={16} />
                              </button>
                            </td>
                          </tr>
                        ))
                      ))}

                    {/* Rendering Meal Basis */}
                    {activeSubTab === "meal-basis" &&
                      (mealBasis.length === 0 ? (
                        <tr>
                          <td
                            colSpan={3}
                            className="px-4 py-8 text-center text-steel italic"
                          >
                            No meal basis options seeded in database.
                          </td>
                        </tr>
                      ) : (
                        mealBasis.map((item) => (
                          <tr
                            key={item.id}
                            className={`reference-row-transition hover:bg-cloud/40 ${
                              deletingIds.includes(item.id)
                                ? "reference-row-exit"
                                : ""
                            }`}
                          >
                            <td className="px-4 py-3 font-bold">{item.code}</td>
                            <td className="px-4 py-3 text-steel">
                              {item.name}
                            </td>
                            <td className="px-4 py-3 text-right">
                              <button
                                type="button"
                                aria-label={`Delete meal basis ${item.code}`}
                                title={`Delete meal basis ${item.code}`}
                                onClick={() =>
                                  triggerDelete(
                                    "meal-basis",
                                    item.id,
                                    item.code,
                                  )
                                }
                                className="text-steel hover:text-red-500 rounded p-1 hover:bg-red-500/10 transition-colors"
                              >
                                <Trash2 size={16} />
                              </button>
                            </td>
                          </tr>
                        ))
                      ))}

                    {/* Rendering Currencies */}
                    {activeSubTab === "currencies" &&
                      (currencies.length === 0 ? (
                        <tr>
                          <td
                            colSpan={3}
                            className="px-4 py-8 text-center text-steel italic"
                          >
                            No currencies loaded in database.
                          </td>
                        </tr>
                      ) : (
                        currencies.map((item) => (
                          <tr
                            key={item.id}
                            className={`reference-row-transition hover:bg-cloud/40 ${
                              deletingIds.includes(item.id)
                                ? "reference-row-exit"
                                : ""
                            }`}
                          >
                            <td className="px-4 py-3 font-bold">{item.code}</td>
                            <td className="px-4 py-3 text-steel">
                              {item.name}
                            </td>
                            <td className="px-4 py-3 text-right">
                              <button
                                type="button"
                                aria-label={`Delete currency ${item.code}`}
                                title={`Delete currency ${item.code}`}
                                onClick={() =>
                                  triggerDelete(
                                    "currencies",
                                    item.id,
                                    item.code,
                                  )
                                }
                                className="text-steel hover:text-red-500 rounded p-1 hover:bg-red-500/10 transition-colors"
                              >
                                <Trash2 size={16} />
                              </button>
                            </td>
                          </tr>
                        ))
                      ))}
                  </tbody>
                </table>
              </div>

              {/* Show Archived Toggle */}
              <div className="mt-4 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const next = !showArchived;
                    setShowArchived(next);
                    if (next) loadArchivedItems();
                  }}
                  className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-app border transition-all ${
                    showArchived
                      ? "border-amber-400/20 bg-amber-400/5 text-amber-500"
                      : "border-line bg-cloud text-steel hover:text-navy"
                  }`}
                >
                  <Archive size={14} />
                  {showArchived ? "Hide Archived" : "Show Archived"}
                </button>
              </div>

              {/* Archived Items */}
              {showArchived && (
                <div className="mt-4 overflow-hidden border border-amber-400/15 rounded-app bg-amber-50/30 shadow-sm">
                  <div className="px-4 py-2.5 bg-amber-400/5 border-b border-amber-400/15">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-amber-600/80 flex items-center gap-1.5">
                      <Archive size={14} /> Archived Items
                    </h4>
                  </div>
                  <table className="w-full border-collapse text-left text-sm text-navy">
                    <tbody className="divide-y divide-amber-400/8">
                      {isLoadingArchived ? (
                        <tr>
                          <td
                            colSpan={3}
                            className="px-4 py-6 text-center text-steel italic"
                          >
                            Loading archived items...
                          </td>
                        </tr>
                      ) : archivedItems.length === 0 ? (
                        <tr>
                          <td
                            colSpan={3}
                            className="px-4 py-6 text-center text-steel italic"
                          >
                            No archived items.
                          </td>
                        </tr>
                      ) : (
                        archivedItems.map((item) => {
                          const id = item.id as string;
                          const code = (item.code as string) || "";
                          const name = (item.name as string) || "";
                          const hasCode = [
                            "tour-types",
                            "markets",
                            "meal-basis",
                            "currencies",
                          ].includes(activeSubTab);
                          return (
                            <tr
                              key={id}
                              className={`reference-row-transition hover:bg-amber-400/5 ${
                                restoringIds.includes(id)
                                  ? "reference-row-restore-exit"
                                  : ""
                              }`}
                            >
                              {activeSubTab === "hotels" ? (
                                <>
                                  <td className="px-4 py-3 font-semibold text-steel/70">
                                    {name}
                                  </td>
                                  <td className="px-4 py-3 text-steel/70">
                                    {(item.email as string) || <span className="text-slate-300/60 italic">No Email</span>}
                                  </td>
                                </>
                              ) : hasCode ? (
                                <>
                                  <td className="px-4 py-3 font-bold text-steel/70">
                                    {code}
                                  </td>
                                  <td className="px-4 py-3 text-steel/70">
                                    {name}
                                  </td>
                                </>
                              ) : (
                                <td className="px-4 py-3 font-semibold text-steel/70">
                                  {name}
                                </td>
                              )}
                              <td className="px-4 py-3 text-right">
                                <button
                                  type="button"
                                  onClick={() => handleRestore(id)}
                                  className="text-amber-500 hover:text-green-500 rounded p-1 hover:bg-green-500/8 transition-colors flex items-center gap-1 ml-auto text-xs font-semibold"
                                >
                                  <RotateCw size={14} /> Restore
                                </button>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      {showDeleteConfirm && deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy/40 backdrop-blur-sm p-4 animate-fade-in">
          <div className="w-full max-w-md bg-surface rounded-app border border-line p-6 shadow-xl">
            <div className="flex gap-4 items-start">
              <div className="p-3 bg-red-500/10 text-red-500 rounded-full">
                <AlertTriangle size={24} />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-display font-bold text-lg text-navy">
                  Confirm Deletion
                </h3>
                <p className="mt-2 text-sm text-steel leading-relaxed">
                  Are you sure you want to delete{" "}
                  <strong className="text-navy">"{deleteTarget.label}"</strong>?
                  This will deactivate it, removing it from active selection
                  dropdowns while preserving historical voucher references.
                </p>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setDeleteTarget(null);
                }}
                className="app-button-secondary px-5"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="app-button-primary bg-red-500 hover:bg-red-600 border-transparent text-white px-5"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
