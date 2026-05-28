import { useState, useEffect } from "react";
import type { AuthState, AccountProfile } from "../../../electron/shared/types";

interface UseAppAuthProps {
  onAuthLoaded?: (profile: AccountProfile | null) => void;
  addNotice: (message: string, type?: "info" | "success" | "error") => void;
}

export function useAppAuth({ onAuthLoaded, addNotice }: UseAppAuthProps) {
  const [authState, setAuthState] = useState<AuthState>({ isAuthenticated: false, profile: null });
  const [accountProfile, setAccountProfile] = useState<AccountProfile | null>(null);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);

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
        if (onAuthLoaded) {
          onAuthLoaded(state.profile);
        }
      })
      .finally(() => setIsCheckingAuth(false));
  }, []);

  // Automatically sync profile/role changes from database in the background every 5 seconds
  useEffect(() => {
    if (!accountProfile || !window.meridian?.getAccountProfile) return;

    const interval = setInterval(() => {
      void window.meridian.getAccountProfile()
        .then((latestProfile) => {
          if (latestProfile) {
            if (
              latestProfile.role !== accountProfile.role ||
              latestProfile.employeeName !== accountProfile.employeeName ||
              latestProfile.employeeEmail !== accountProfile.employeeEmail ||
              latestProfile.isActive !== accountProfile.isActive
            ) {
              setAccountProfile(latestProfile);
              setAuthState((prev) => ({ ...prev, profile: latestProfile }));
            }
          }
        })
        .catch((err) => console.error("Error auto-syncing profile:", err));
    }, 1000);

    return () => clearInterval(interval);
  }, [accountProfile]);

  function handleAuthenticated(state: AuthState) {
    setAuthState(state);
    setAccountProfile(state.profile);
    if (onAuthLoaded) {
      onAuthLoaded(state.profile);
    }
    addNotice("Logged in");
  }

  async function handleSignOut(onSignOutDone?: () => void) {
    if (!window.meridian) {
      return;
    }

    const state = await window.meridian.signOut();
    setAuthState(state);
    setAccountProfile(null);
    if (onSignOutDone) {
      onSignOutDone();
    }
  }

  return {
    authState,
    setAuthState,
    accountProfile,
    setAccountProfile,
    isCheckingAuth,
    setIsCheckingAuth,
    handleAuthenticated,
    handleSignOut
  };
}
