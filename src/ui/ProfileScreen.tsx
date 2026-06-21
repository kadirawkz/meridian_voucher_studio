import React, { useEffect, useState } from "react";
import { Mail, User, Shield, Save } from "lucide-react";
import type { AccountProfile } from "../../electron/shared/types";

interface ProfileScreenProps {
  accountProfile: AccountProfile | null;
  onProfileUpdated: (profile: AccountProfile) => void;
  addNotice?: (message: string, type?: "info" | "success" | "error") => void;
}

export function ProfileScreen({
  accountProfile,
  onProfileUpdated,
  addNotice,
}: ProfileScreenProps) {
  const [profile, setProfile] = useState<AccountProfile | null>(accountProfile);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState({
    employeeName: "",
    employeeEmail: "",
  });

  useEffect(() => {
    if (accountProfile) {
      setProfile(accountProfile);
      setFormData({
        employeeName: accountProfile.employeeName || "",
        employeeEmail: accountProfile.employeeEmail || "",
      });
    }
  }, [accountProfile]);

  async function handleSave() {
    try {
      setIsSaving(true);
      const result = await window.meridian.updateProfile({
        employeeName: formData.employeeName,
        employeeEmail: formData.employeeEmail,
      });
      setProfile(result);
      onProfileUpdated(result);
      setIsEditing(false);
      if (addNotice) {
        addNotice("Profile information updated successfully.", "success");
      }
    } catch (error) {
      console.error("Failed to update profile:", error);
      if (addNotice) {
        addNotice("Failed to update profile information. Please verify the input and try again.", "error");
      }
    } finally {
      setIsSaving(false);
    }
  }

  function handleCancel() {
    if (accountProfile) {
      setFormData({
        employeeName: accountProfile.employeeName || "",
        employeeEmail: accountProfile.employeeEmail || "",
      });
    }
    setIsEditing(false);
  }

  if (!profile) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-steel">Loading profile...</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl p-4 md:p-8">
      <div className="space-y-6">
        {/* Profile Information */}
        <section className="app-panel app-panel-body-lg">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <h3 className="app-section-title">Account Information</h3>
            {!isEditing && (
              <button
                type="button"
                onClick={() => setIsEditing(true)}
                className="app-button-secondary text-sm w-40"
              >
                Edit Profile
              </button>
            )}
          </div>

          {isEditing ? (
            <div className="space-y-5">
              <label className="space-y-2">
                <span className="app-label">Employee Name</span>
                <input
                  type="text"
                  className="app-input"
                  value={formData.employeeName}
                  onChange={(e) =>
                    setFormData({ ...formData, employeeName: e.target.value })
                  }
                  placeholder="Your full name"
                />
              </label>
              <label className="space-y-2">
                <span className="app-label">Email Address</span>
                <input
                  type="email"
                  className="app-input"
                  value={formData.employeeEmail}
                  onChange={(e) =>
                    setFormData({ ...formData, employeeEmail: e.target.value })
                  }
                  placeholder="your.email@company.com"
                />
              </label>
              <div className="flex flex-wrap gap-3 justify-end">
                <button
                  type="button"
                  onClick={handleCancel}
                  className="app-button-secondary w-40"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={isSaving}
                  className="app-button-primary w-40"
                >
                  <Save size={16} /> {isSaving ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-3 rounded-app border border-line bg-cloud p-4 overflow-hidden">
                <User size={20} className="text-navy shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold uppercase text-steel">
                    Employee Name
                  </p>
                  <p className="text-base font-semibold text-navy truncate">
                    {profile.employeeName}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-app border border-line bg-cloud p-4 overflow-hidden">
                <Mail size={20} className="text-navy shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold uppercase text-steel">
                    Email Address
                  </p>
                  <p className="text-base font-semibold text-navy truncate">
                    {profile.employeeEmail}
                  </p>
                </div>
              </div>
            </div>
          )}
        </section>

        {/* Account Details */}
        <section className="app-panel app-panel-body-lg">
          <h3 className="mb-5 app-section-title">Account Details</h3>
          <div className="space-y-4">
            <div className="flex items-center gap-3 rounded-app border border-line bg-cloud p-4">
              <Shield size={20} className="text-navy" />
              <div>
                <p className="text-xs font-bold uppercase text-steel">
                  Account Role
                </p>
                <p className="text-base font-semibold text-navy capitalize">
                  {profile.role || "Employee"}
                </p>
              </div>
            </div>
            <div className="rounded-app border border-line bg-cloud p-4">
              <p className="text-xs font-bold uppercase text-steel">
                Account Status
              </p>
              <p className="mt-2 flex items-center gap-2 text-base font-semibold text-navy">
                <span
                  className={`h-2 w-2 rounded-full ${profile.isActive ? "bg-green-500" : "bg-red-500"}`}
                />
                {profile.isActive ? "Active" : "Inactive"}
              </p>
            </div>
            {profile.id && (
              <div className="rounded-app border border-line bg-cloud p-4">
                <p className="text-xs font-bold uppercase text-steel">
                  User ID
                </p>
                <p className="mt-2 font-mono text-xs text-steel">
                  {profile.id}
                </p>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
