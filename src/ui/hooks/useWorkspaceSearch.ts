import { useState, useEffect, useDeferredValue } from "react";
import type { WorkspaceSearchResult } from "../../../electron/shared/types";
import { friendlyErrorMessage } from "../../utils/errors";

interface UseWorkspaceSearchProps {
  isAuthenticated: boolean;
  addNotice: (message: string, type?: "info" | "success" | "error") => void;
}

export function useWorkspaceSearch({ isAuthenticated, addNotice }: UseWorkspaceSearchProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const [searchResults, setSearchResults] = useState<WorkspaceSearchResult>({ vouchers: [], documents: [] });
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    if (!isAuthenticated || !window.meridian?.searchWorkspace) {
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
            addNotice(friendlyErrorMessage(error, "Unable to search workspace"), "error");
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
  }, [isAuthenticated, deferredSearchQuery]);

  return {
    searchQuery,
    setSearchQuery,
    searchResults,
    setSearchResults,
    isSearching,
    setIsSearching
  };
}
