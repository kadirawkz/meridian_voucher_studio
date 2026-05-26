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
