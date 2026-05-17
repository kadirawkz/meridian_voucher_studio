import React, { useEffect, useState } from "react";
import { FolderOpen, Save, RotateCcw } from "lucide-react";

interface AppSettings {
  toursFolderRoot?: string;
  exportDirectory?: string;
}

interface SettingsScreenProps {
}

export function SettingsScreen() {
  const [settings, setSettings] = useState<AppSettings>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [feedback, setFeedback] = useState("");

  useEffect(() => {
    loadSettings();
  }, []);

  async function loadSettings() {
    try {
      setIsLoading(true);
      const result = await window.meridian.getSettings();
      setSettings(result || {});
    } catch (error) {
      console.error("Failed to load settings:", error);
      setFeedback("Failed to load settings");
    } finally {
      setIsLoading(false);
    }
  }

  async function saveSettings() {
    try {
      setIsSaving(true);
      await window.meridian.saveSettings(settings);
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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-steel">Loading settings...</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl p-4 md:p-8">
      <div className="mb-8">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-steel">System / Configuration</p>
        <h2 className="mt-1 font-display text-3xl font-bold text-navy">Settings</h2>
        <p className="mt-2 text-sm text-steel">Configure workspace defaults and system behavior.</p>
      </div>

      {feedback && (
        <div className={`mb-6 rounded-app border px-4 py-3 text-sm font-semibold ${
          feedback.includes("success") 
            ? "border-green-200 bg-green-50 text-green-700"
            : "border-red-200 bg-red-50 text-red-700"
        }`}>
          {feedback}
        </div>
      )}

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

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-3 justify-end">
          <button
            type="button"
            onClick={loadSettings}
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
    </div>
  );
}
