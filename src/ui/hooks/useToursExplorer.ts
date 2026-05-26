import { useState, useEffect } from "react";
import type { FolderTreeNode } from "../../../electron/shared/types";

interface UseToursExplorerProps {
  isAuthenticated: boolean;
  addNotice: (message: string, type?: "info" | "success" | "error") => void;
}

export function useToursExplorer({ isAuthenticated, addNotice }: UseToursExplorerProps) {
  const [toursFolderPath, setToursFolderPath] = useState<string | null>(null);
  const [toursFolderTree, setToursFolderTree] = useState<FolderTreeNode[]>([]);
  const [toursFolderExists, setToursFolderExists] = useState<boolean>(true);
  const [isLoadingTree, setIsLoadingTree] = useState(false);
  const [isMigrating, setIsMigrating] = useState(false);
  const [explorerCollapsed, setExplorerCollapsed] = useState(false);

  useEffect(() => {
    if (!isAuthenticated || !window.meridian?.getToursFolder) return;

    void window.meridian.getToursFolder().then((folderPath) => {
      setToursFolderPath(folderPath);
      if (folderPath) {
        void refreshToursFolderTree();
      }
    });
  }, [isAuthenticated]);

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
      addNotice("Tours root folder not found or inaccessible", "error");
    } finally {
      setIsLoadingTree(false);
    }
  }

  async function handleSelectToursFolder() {
    if (!window.meridian?.selectToursFolder) {
      addNotice("Tours folder selection unavailable; restart the application", "error");
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
      addNotice("Unable to select Tours folder", "error");
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
        addNotice(`Migration: ${result.moved} moved, ${result.failed} failed`, "error");
      }
      await refreshToursFolderTree();
    } catch {
      addNotice("Migration failed", "error");
    } finally {
      setIsMigrating(false);
    }
  }

  function handleRevealFile(filePath: string) {
    if (window.meridian?.revealInExplorer) {
      void window.meridian.revealInExplorer(filePath);
    }
  }

  return {
    toursFolderPath,
    setToursFolderPath,
    toursFolderTree,
    setToursFolderTree,
    toursFolderExists,
    setToursFolderExists,
    isLoadingTree,
    setIsLoadingTree,
    isMigrating,
    setIsMigrating,
    explorerCollapsed,
    setExplorerCollapsed,
    refreshToursFolderTree,
    handleSelectToursFolder,
    handleMigrateVouchers,
    handleRevealFile
  };
}
