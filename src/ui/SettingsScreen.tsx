import React, { useEffect, useState } from "react";
import { FolderOpen, Save, RotateCcw, Sun, Moon, Monitor, Trash2, Plus, AlertTriangle, Archive, RotateCw, Upload, Download, FileText } from "lucide-react";
import type { TourTypeRef, MarketRef, RoomCategoryRef, CustomerRef, MealBasisRef, CurrencyRef, VoucherTemplateInfo, AccountProfile } from "../../electron/shared/types";

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
}

export function SettingsScreen({ 
  activeTheme = "system", 
  onThemeChange, 
  onReferencesChanged,
  accountProfile: propAccountProfile,
  onProfileUpdated
}: SettingsScreenProps) {
  const [settings, setSettings] = useState<AppSettings>({ theme: activeTheme });
  const [accountProfile, setAccountProfile] = useState<AccountProfile | null>(propAccountProfile);
  const [isSaving, setIsSaving] = useState(false);
  const [feedback, setFeedback] = useState("");

  useEffect(() => {
    if (propAccountProfile) {
      setAccountProfile(propAccountProfile);
    }
  }, [propAccountProfile]);

  const isAdminOrManager = accountProfile?.role === "admin" || accountProfile?.role === "manager";

  const [activeMainTab, setActiveMainTab] = useState<"system" | "templates" | "references">("system");
  const [activeSubTab, setActiveSubTab] = useState<"tour-types" | "markets" | "customers" | "room-categories" | "meal-basis" | "currencies">("tour-types");

  // Reference States
  const [tourTypes, setTourTypes] = useState<TourTypeRef[]>([]);
  const [markets, setMarkets] = useState<MarketRef[]>([]);
  const [roomCategories, setRoomCategories] = useState<RoomCategoryRef[]>([]);
  const [customers, setCustomers] = useState<CustomerRef[]>([]);
  const [mealBasis, setMealBasis] = useState<MealBasisRef[]>([]);
  const [currencies, setCurrencies] = useState<CurrencyRef[]>([]);

  const [newCode, setNewCode] = useState("");
  const [newName, setNewName] = useState("");

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ type: string; id: string; label: string } | null>(null);

  // Archived (inactive) items
  const [showArchived, setShowArchived] = useState(false);
  const [archivedItems, setArchivedItems] = useState<Record<string, unknown>[]>([]);
  const [isLoadingArchived, setIsLoadingArchived] = useState(false);
  const [deletingIds, setDeletingIds] = useState<string[]>([]);
  const [restoringIds, setRestoringIds] = useState<string[]>([]);

  // Database Voucher Templates states
  const [dbTemplates, setDbTemplates] = useState<VoucherTemplateInfo[]>([]);
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(false);
  const [uploadingTemplate, setUploadingTemplate] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState("");

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
        window.meridian.getAccountProfile() as Promise<AccountProfile>
      ]);
      setSettings({
        ...settingsResult,
        theme: activeTheme
      });
      setAccountProfile(profileResult);
      if (onProfileUpdated) {
        onProfileUpdated(profileResult);
      }
    } catch (error) {
      console.error("Failed to load settings or profile:", error);
      setFeedback("Failed to load settings");
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

  async function handleUploadTemplate() {
    if (!newTemplateName.trim()) {
      setFeedback("Please enter a name for the template");
      return;
    }

    try {
      const filePath = await window.meridian.selectFile({
        title: "Select Voucher Template (.docx)",
        filters: [{ name: "Word Documents", extensions: ["docx"] }]
      });

      if (!filePath) return;

      setUploadingTemplate(true);
      await window.meridian.uploadDatabaseTemplate(newTemplateName.trim(), filePath);
      setNewTemplateName("");
      setFeedback("Template uploaded successfully to database");
      setTimeout(() => setFeedback(""), 3000);
      await loadDbTemplates();
    } catch (error: unknown) {
      console.error("Failed to upload template:", error);
      const errMsg = error instanceof Error ? error.message : "Failed to upload template";
      setFeedback(errMsg);
    } finally {
      setUploadingTemplate(false);
    }
  }

  async function handleDownloadTemplate(name: string) {
    try {
      const success = await window.meridian.downloadDatabaseTemplate(name);
      if (success) {
        setFeedback("Template downloaded successfully");
        setTimeout(() => setFeedback(""), 3000);
      }
    } catch (error) {
      console.error("Failed to download template:", error);
      setFeedback("Failed to download template");
    }
  }

  async function handleDeleteTemplate(name: string) {
    try {
      await window.meridian.deleteDatabaseTemplate(name);
      setFeedback("Template deleted successfully");
      setTimeout(() => setFeedback(""), 3000);
      
      // If the deleted template was the active one, clear it
      if (settings.activeTemplateName === name) {
        const nextSettings = { ...settings, activeTemplateName: "" };
        setSettings(nextSettings);
        await window.meridian.saveSettings(nextSettings);
      }

      await loadDbTemplates();
    } catch (error) {
      console.error("Failed to delete template:", error);
      setFeedback("Failed to delete template");
    }
  }

  async function loadAllReferences() {
    try {
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
      setFeedback("Settings saved successfully");
      setTimeout(() => setFeedback(""), 3000);
    } catch (error) {
      console.error("Failed to save settings:", error);
      setFeedback("Failed to save settings");
    } finally {
      setIsSaving(false);
    }
  }

  async function selectToursFolder() {
    try {
      const result = await window.meridian.selectFolder({
        title: "Select Tours Folder"
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
        defaultPath: settings.exportDirectory
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
      if (activeSubTab === "tour-types") {
        if (!newCode.trim()) return;
        await window.meridian.saveTourType({ code: newCode.trim().toUpperCase(), name: newName.trim() || newCode.trim().toUpperCase() });
      } else if (activeSubTab === "markets") {
        if (!newCode.trim()) return;
        await window.meridian.saveMarket({ code: newCode.trim().toUpperCase(), name: newName.trim() || newCode.trim().toUpperCase() });
      } else if (activeSubTab === "meal-basis") {
        if (!newCode.trim()) return;
        await window.meridian.saveMealBasis({ code: newCode.trim().toUpperCase(), name: newName.trim() || newCode.trim().toUpperCase() });
      } else if (activeSubTab === "customers") {
        if (!newName.trim()) return;
        await window.meridian.saveCustomer({ name: newName.trim(), is_active: true });
      } else if (activeSubTab === "room-categories") {
        if (!newName.trim()) return;
        await window.meridian.saveRoomCategory({ name: newName.trim() });
      } else if (activeSubTab === "currencies") {
        if (!newCode.trim()) return;
        await window.meridian.saveCurrency({ code: newCode.trim().toUpperCase(), name: newName.trim() || newCode.trim().toUpperCase() });
      }
      
      setNewCode("");
      setNewName("");
      setFeedback("Item added successfully");
      setTimeout(() => setFeedback(""), 3000);
      await loadAllReferences();
      if (onReferencesChanged) onReferencesChanged();
    } catch (error) {
      console.error("Failed to add item:", error);
      setFeedback("Failed to add item");
    }
  }

  function triggerDelete(type: string, id: string, label: string) {
    setDeleteTarget({ type, id, label });
    setShowDeleteConfirm(true);
  }

  /** Map UI sub-tab names to DB table names */
  function subTabToTable(subTab: string): string {
    const map: Record<string, string> = {
      "tour-types": "tour_types",
      "markets": "markets",
      "customers": "customers",
      "room-categories": "room_categories",
      "meal-basis": "meal_basis",
      "currencies": "currencies",
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
        new Promise((resolve) => setTimeout(resolve, 350))
      ]);

      setFeedback("Item restored successfully");
      setTimeout(() => setFeedback(""), 3000);
      await loadAllReferences();
      await loadArchivedItems();
      if (onReferencesChanged) onReferencesChanged();
    } catch (error) {
      console.error("Failed to restore item:", error);
      setFeedback("Failed to restore item");
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
        if (type === "tour-types") {
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
        new Promise((resolve) => setTimeout(resolve, 350))
      ]);

      setFeedback("Item deleted successfully");
      setTimeout(() => setFeedback(""), 3000);
      await loadAllReferences();
      if (showArchived) await loadArchivedItems();
      if (onReferencesChanged) onReferencesChanged();
    } catch (error) {
      console.error("Failed to delete item:", error);
      setFeedback("Failed to delete item");
    } finally {
      setDeletingIds((prev) => prev.filter((item) => item !== id));
      setDeleteTarget(null);
    }
  }



  return (
    <div className="mx-auto max-w-4xl p-4 md:p-8">
      <div className="mb-6">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-steel">System / Configuration</p>
        <h2 className="mt-1 font-display text-3xl font-bold text-navy">Settings</h2>
        <p className="mt-2 text-sm text-steel">Configure workspace defaults, system behavior, and reference tables.</p>
      </div>

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

      {feedback && (
        <div className={`mb-6 rounded-app border px-4 py-3 text-sm font-semibold ${
          feedback.includes("success") 
            ? "border-green-500/20 bg-green-500/10 text-green-500"
            : "border-red-500/20 bg-red-500/10 text-red-500"
        }`}>
          {feedback}
        </div>
      )}

      {activeMainTab === "system" && (
        <div className="space-y-6">
          {/* Workspace Settings */}
          <section className="app-panel app-panel-body-lg">
            <h3 className="mb-5 app-section-title">Workspace</h3>
            <div className="space-y-5">
              <div>
                <label className="block space-y-2 mb-3">
                  <span className="app-label">Tours Folder Root</span>
                  <p className="text-xs text-steel">Location where tour folders are organized</p>
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
                  <p className="text-xs text-steel">Default location for generated PDF and DOCX files</p>
                </label>
                <div className="flex items-center gap-3">
                  <div className="flex-1 min-w-0 truncate rounded-app border border-line bg-cloud px-3 py-2 text-sm text-steel">
                    {settings.exportDirectory || "Documents/Meridian Voucher Studio"}
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
                  <p className="text-xs text-steel">Choose how Meridian Voucher Studio looks on your screen</p>
                </label>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {[
                    { value: "light", label: "Light Theme", icon: Sun, desc: "Clean and classic, ideal for bright workspaces." },
                    { value: "dark", label: "Dark Theme", icon: Moon, desc: "A sleek, low-glare dark palette optimized for clarity." },
                    { value: "system", label: "System Sync", icon: Monitor, desc: "Automatically match your computer's OS theme." }
                  ].map((item) => {
                    const Icon = item.icon;
                    const isSelected = (settings.theme || "system") === item.value;
                    return (
                       <button
                         key={item.value}
                         type="button"
                         onClick={async () => {
                           const nextSettings = { ...settings, theme: item.value as "light" | "dark" | "system" };
                           setSettings(nextSettings);
                           if (onThemeChange) {
                             onThemeChange(item.value as "light" | "dark" | "system");
                           }
                           try {
                             await window.meridian.saveSettings(nextSettings as Record<string, unknown>);
                           } catch (err) {
                             console.error("Failed to auto-save theme settings:", err);
                           }
                         }}
                        className={`flex flex-col items-start rounded-app border p-4 text-left transition-all ${
                          isSelected 
                            ? "border-navy bg-[var(--color-accent-bg)] text-navy shadow-sm" 
                            : "border-line bg-surface text-ink hover:border-steel"
                        }`}
                      >
                        <div className="flex items-center gap-2 font-bold text-sm">
                          <Icon size={18} className={isSelected ? "text-navy" : "text-steel"} />
                          <span>{item.label}</span>
                        </div>
                        <p className="mt-2 text-xs text-steel leading-relaxed">{item.desc}</p>
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
                  <p className="text-xs text-steel">Select the voucher template that all employees will use for document generation</p>
                </label>
                <select
                  value={settings.activeTemplateName || ""}
                  disabled={!isAdminOrManager}
                  onChange={(e) => setSettings({ ...settings, activeTemplateName: e.target.value })}
                  className="w-full md:w-1/2 rounded-app border border-line bg-surface px-3 py-2 text-sm font-semibold text-navy outline-none focus:border-navy disabled:opacity-75 disabled:cursor-not-allowed"
                >
                  <option value="">Built-in Default Template (voucher-template.docx)</option>
                  {dbTemplates.map((t) => (
                    <option key={t.id} value={t.name}>
                      {t.name} (Uploaded {t.created_at ? new Date(t.created_at).toLocaleDateString() : "N/A"})
                    </option>
                  ))}
                </select>
              </div>

              {isAdminOrManager && (
                <>
                  <hr className="border-line" />

                  {/* Upload Form */}
                  <div>
                    <h4 className="font-bold text-xs uppercase text-steel tracking-wider mb-3">Upload Custom Template</h4>
                    <div className="flex flex-col sm:flex-row gap-3 items-end">
                      <div className="flex-1 w-full">
                        <label className="block mb-1.5 text-xs font-bold text-navy">Template Name</label>
                        <input
                          type="text"
                          value={newTemplateName}
                          onChange={(e) => setNewTemplateName(e.target.value)}
                          placeholder="e.g. Standard Tour Template, Winter Special"
                          className="w-full rounded-app border border-line bg-surface px-3 py-1.5 text-sm font-semibold text-navy outline-none focus:border-navy"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={handleUploadTemplate}
                        disabled={uploadingTemplate || !newTemplateName.trim()}
                        className="app-button-secondary py-1.5 px-4 text-sm font-semibold flex items-center gap-1.5 whitespace-nowrap w-full sm:w-auto justify-center"
                      >
                        <Upload size={16} />
                        {uploadingTemplate ? "Uploading..." : "Select File & Upload"}
                      </button>
                    </div>
                  </div>
                </>
              )}

              {/* Database Templates Table */}
              <div>
                <h4 className="font-bold text-xs uppercase text-steel tracking-wider mb-3">Templates in Database</h4>
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
                          <td colSpan={3} className="px-4 py-8 text-center text-steel italic">
                            Loading templates...
                          </td>
                        </tr>
                      ) : dbTemplates.length === 0 ? (
                        <tr>
                          <td colSpan={3} className="px-4 py-8 text-center text-steel italic">
                            No custom templates uploaded. Using built-in default template.
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
                              {t.updated_at || t.created_at ? new Date(t.updated_at || t.created_at || "").toLocaleString() : "N/A"}
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
              { id: "tour-types", label: "Tour Types" },
              { id: "markets", label: "Markets" },
              { id: "customers", label: "Customers" },
              { id: "room-categories", label: "Room Categories" },
              { id: "meal-basis", label: "Meal Basis" },
              { id: "currencies", label: "Currencies" }
            ].map((subTab) => (
              <button
                key={subTab.id}
                type="button"
                onClick={() => {
                  setActiveSubTab(subTab.id as "tour-types" | "markets" | "customers" | "room-categories" | "meal-basis" | "currencies");
                  setNewCode("");
                  setNewName("");
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
              <form onSubmit={handleAddItem} className="bg-cloud p-4 rounded-app border border-line mb-6">
                <h4 className="font-bold text-xs uppercase text-steel tracking-wider mb-3">Add New Entry</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-end">
                  {/* Tour types, markets, meal basis need code + optional name */}
                  {["tour-types", "markets", "meal-basis", "currencies"].includes(activeSubTab) ? (
                    <>
                      <div>
                        <label className="block mb-1.5 text-xs font-bold text-navy">Code *</label>
                        <input
                          type="text"
                          required
                          value={newCode}
                          onChange={(e) => setNewCode(e.target.value)}
                          placeholder={
                            activeSubTab === "tour-types" ? "e.g. WSL" :
                            activeSubTab === "markets" ? "e.g. UK" :
                            activeSubTab === "meal-basis" ? "e.g. BB" : "e.g. USD"
                          }
                          className="w-full rounded-app border border-line bg-surface px-3 py-1.5 text-sm font-semibold text-navy outline-none focus:border-navy"
                        />
                      </div>
                      <div>
                        <label className="block mb-1.5 text-xs font-bold text-navy">Name (Optional)</label>
                        <input
                          type="text"
                          value={newName}
                          onChange={(e) => setNewName(e.target.value)}
                          placeholder={
                            activeSubTab === "tour-types" ? "e.g. Winter Tour" :
                            activeSubTab === "markets" ? "e.g. United Kingdom" :
                            activeSubTab === "meal-basis" ? "e.g. Bed & Breakfast" : "e.g. US Dollar"
                          }
                          className="w-full rounded-app border border-line bg-surface px-3 py-1.5 text-sm font-semibold text-navy outline-none focus:border-navy"
                        />
                      </div>
                    </>
                  ) : (
                    /* Customers and room categories only need name */
                    <div className="sm:col-span-2">
                      <label className="block mb-1.5 text-xs font-bold text-navy">Name *</label>
                      <input
                        type="text"
                        required
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                        placeholder={activeSubTab === "customers" ? "Customer / Agent Name" : "e.g. Executive Suite"}
                        className="w-full rounded-app border border-line bg-surface px-3 py-1.5 text-sm font-semibold text-navy outline-none focus:border-navy"
                      />
                    </div>
                  )}
                </div>
                <div className="mt-4 flex justify-end">
                  <button type="submit" className="app-button-primary py-1.5 px-4 text-sm font-semibold flex items-center gap-1">
                    <Plus size={16} /> Add Entry
                  </button>
                </div>
              </form>

              {/* Items List Table */}
              <div className="overflow-hidden border border-line rounded-app bg-surface shadow-sm">
                <table className="w-full border-collapse text-left text-sm text-navy">
                  <thead>
                    <tr className="bg-cloud border-b border-line text-xs font-bold uppercase tracking-wider text-steel">
                      {["tour-types", "markets", "meal-basis", "currencies"].includes(activeSubTab) ? (
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
                    {/* Rendering Tour Types */}
                    {activeSubTab === "tour-types" && (
                      tourTypes.length === 0 ? (
                        <tr><td colSpan={3} className="px-4 py-8 text-center text-steel italic">No tour types seeded in database.</td></tr>
                      ) : (
                        tourTypes.map((item) => (
                          <tr 
                            key={item.id} 
                            className={`reference-row-transition hover:bg-cloud/40 ${
                              deletingIds.includes(item.id) ? "reference-row-exit" : ""
                            }`}
                          >
                            <td className="px-4 py-3 font-bold">{item.code}</td>
                            <td className="px-4 py-3 text-steel">{item.name}</td>
                            <td className="px-4 py-3 text-right">
                              <button
                                type="button"
                                onClick={() => triggerDelete("tour-types", item.id, item.code)}
                                className="text-steel hover:text-red-500 rounded p-1 hover:bg-red-500/10 transition-colors"
                              >
                                <Trash2 size={16} />
                              </button>
                            </td>
                          </tr>
                        ))
                      )
                    )}

                    {/* Rendering Markets */}
                    {activeSubTab === "markets" && (
                      markets.length === 0 ? (
                        <tr><td colSpan={3} className="px-4 py-8 text-center text-steel italic">No markets seeded in database.</td></tr>
                      ) : (
                        markets.map((item) => (
                          <tr 
                            key={item.id} 
                            className={`reference-row-transition hover:bg-cloud/40 ${
                              deletingIds.includes(item.id) ? "reference-row-exit" : ""
                            }`}
                          >
                            <td className="px-4 py-3 font-bold">{item.code}</td>
                            <td className="px-4 py-3 text-steel">{item.name}</td>
                            <td className="px-4 py-3 text-right">
                              <button
                                type="button"
                                onClick={() => triggerDelete("markets", item.id, item.code)}
                                className="text-steel hover:text-red-500 rounded p-1 hover:bg-red-500/10 transition-colors"
                              >
                                <Trash2 size={16} />
                              </button>
                            </td>
                          </tr>
                        ))
                      )
                    )}

                    {/* Rendering Room Categories */}
                    {activeSubTab === "room-categories" && (
                      roomCategories.length === 0 ? (
                        <tr><td colSpan={2} className="px-4 py-8 text-center text-steel italic">No room categories seeded in database.</td></tr>
                      ) : (
                        roomCategories.map((item) => (
                          <tr 
                            key={item.id} 
                            className={`reference-row-transition hover:bg-cloud/40 ${
                              deletingIds.includes(item.id) ? "reference-row-exit" : ""
                            }`}
                          >
                            <td className="px-4 py-3 font-semibold">{item.name}</td>
                            <td className="px-4 py-3 text-right">
                              <button
                                type="button"
                                onClick={() => triggerDelete("room-categories", item.id, item.name)}
                                className="text-steel hover:text-red-500 rounded p-1 hover:bg-red-500/10 transition-colors"
                              >
                                <Trash2 size={16} />
                              </button>
                            </td>
                          </tr>
                        ))
                      )
                    )}

                    {/* Rendering Customers */}
                    {activeSubTab === "customers" && (
                      customers.length === 0 ? (
                        <tr><td colSpan={2} className="px-4 py-8 text-center text-steel italic">No customer/agents loaded in database.</td></tr>
                      ) : (
                        customers.map((item) => (
                          <tr 
                            key={item.id} 
                            className={`reference-row-transition hover:bg-cloud/40 ${
                              deletingIds.includes(item.id) ? "reference-row-exit" : ""
                            }`}
                          >
                            <td className="px-4 py-3 font-semibold">{item.name}</td>
                            <td className="px-4 py-3 text-right">
                              <button
                                type="button"
                                onClick={() => triggerDelete("customers", item.id, item.name)}
                                className="text-steel hover:text-red-500 rounded p-1 hover:bg-red-500/10 transition-colors"
                              >
                                <Trash2 size={16} />
                              </button>
                            </td>
                          </tr>
                        ))
                      )
                    )}

                    {/* Rendering Meal Basis */}
                    {activeSubTab === "meal-basis" && (
                      mealBasis.length === 0 ? (
                        <tr><td colSpan={3} className="px-4 py-8 text-center text-steel italic">No meal basis options seeded in database.</td></tr>
                      ) : (
                        mealBasis.map((item) => (
                          <tr 
                            key={item.id} 
                            className={`reference-row-transition hover:bg-cloud/40 ${
                              deletingIds.includes(item.id) ? "reference-row-exit" : ""
                            }`}
                          >
                            <td className="px-4 py-3 font-bold">{item.code}</td>
                            <td className="px-4 py-3 text-steel">{item.name}</td>
                            <td className="px-4 py-3 text-right">
                              <button
                                type="button"
                                onClick={() => triggerDelete("meal-basis", item.id, item.code)}
                                className="text-steel hover:text-red-500 rounded p-1 hover:bg-red-500/10 transition-colors"
                              >
                                <Trash2 size={16} />
                              </button>
                            </td>
                          </tr>
                        ))
                      )
                    )}

                    {/* Rendering Currencies */}
                    {activeSubTab === "currencies" && (
                      currencies.length === 0 ? (
                        <tr><td colSpan={3} className="px-4 py-8 text-center text-steel italic">No currencies loaded in database.</td></tr>
                      ) : (
                        currencies.map((item) => (
                          <tr 
                            key={item.id} 
                            className={`reference-row-transition hover:bg-cloud/40 ${
                              deletingIds.includes(item.id) ? "reference-row-exit" : ""
                            }`}
                          >
                            <td className="px-4 py-3 font-bold">{item.code}</td>
                            <td className="px-4 py-3 text-steel">{item.name}</td>
                            <td className="px-4 py-3 text-right">
                              <button
                                type="button"
                                onClick={() => triggerDelete("currencies", item.id, item.code)}
                                className="text-steel hover:text-red-500 rounded p-1 hover:bg-red-500/10 transition-colors"
                              >
                                <Trash2 size={16} />
                              </button>
                            </td>
                          </tr>
                        ))
                      )
                    )}
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
                        <tr><td colSpan={3} className="px-4 py-6 text-center text-steel italic">Loading archived items...</td></tr>
                      ) : archivedItems.length === 0 ? (
                        <tr><td colSpan={3} className="px-4 py-6 text-center text-steel italic">No archived items.</td></tr>
                      ) : (
                        archivedItems.map((item) => {
                          const id = item.id as string;
                          const code = (item.code as string) || "";
                          const name = (item.name as string) || "";
                          const hasCode = ["tour-types", "markets", "meal-basis", "currencies"].includes(activeSubTab);
                          return (
                            <tr 
                              key={id} 
                              className={`reference-row-transition hover:bg-amber-400/5 ${
                                restoringIds.includes(id) ? "reference-row-restore-exit" : ""
                              }`}
                            >
                              {hasCode ? (
                                <>
                                  <td className="px-4 py-3 font-bold text-steel/70">{code}</td>
                                  <td className="px-4 py-3 text-steel/70">{name}</td>
                                </>
                              ) : (
                                <td className="px-4 py-3 font-semibold text-steel/70">{name}</td>
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
                <h3 className="font-display font-bold text-lg text-navy">Confirm Deletion</h3>
                <p className="mt-2 text-sm text-steel leading-relaxed">
                  Are you sure you want to delete <strong className="text-navy">"{deleteTarget.label}"</strong>? This will deactivate it, removing it from active selection dropdowns while preserving historical voucher references.
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
