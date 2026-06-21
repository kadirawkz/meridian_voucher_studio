import { useState, useEffect } from "react";
import type { FolderTreeNode } from "../../../electron/shared/types";

interface UseToursExplorerProps {
  isAuthenticated: boolean;
  addNotice: (message: string, type?: "info" | "success" | "error") => void;
}

export function useToursExplorer({
  isAuthenticated,
  addNotice,
}: UseToursExplorerProps) {
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

  useEffect(() => {
    if (!isAuthenticated || !window.meridian?.onToursFolderChanged) return;

    const unsubscribe = window.meridian.onToursFolderChanged(() => {
      void refreshToursFolderTree();
    });

    return () => {
      unsubscribe();
    };
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
      addNotice(
        "The selected Tours root folder was not found or is inaccessible. Please verify the folder exists.",
        "error",
      );
    } finally {
      setIsLoadingTree(false);
    }
  }

  async function handleSelectToursFolder() {
    if (!window.meridian?.selectToursFolder) {
      addNotice(
        "Tours folder selection is temporarily unavailable. Please restart the application.",
        "error",
      );
      return;
    }

    try {
      const result = await window.meridian.selectToursFolder();
      if (result) {
        setToursFolderPath(result.path);
        setToursFolderExists(true);
        addNotice(`Tours folder path successfully updated to: ${result.path}`, "success");
        await refreshToursFolderTree();
      }
    } catch {
      addNotice("Unable to select the Tours folder. Please check if the directory exists and try again.", "error");
    }
  }

  async function handleMigrateVouchers() {
    if (!window.meridian?.migrateVouchersToTours) return;

    setIsMigrating(true);
    try {
      const result = await window.meridian.migrateVouchersToTours();
      if (result.moved > 0 && result.failed === 0) {
        addNotice(`Successfully migrated ${result.moved} voucher(s) to the Tours folder structure.`, "success");
      } else if (result.moved === 0 && result.failed === 0) {
        addNotice("There are no new vouchers to migrate to the Tours folder structure.", "info");
      }
      if (result.failed > 0) {
        addNotice(
          `Voucher migration completed with errors: ${result.moved} migrated successfully, ${result.failed} failed.`,
          "error",
        );
      }
      await refreshToursFolderTree();
    } catch {
      addNotice("Failed to complete voucher migration. Please verify folder permissions and try again.", "error");
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
    handleRevealFile,
  };
}
