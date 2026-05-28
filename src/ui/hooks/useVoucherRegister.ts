import { useState, useEffect } from "react";
import type {
  VoucherDocumentRecord,
  VoucherRevisionRecord,
  VoucherRecord,
  VoucherListFilters,
  VoucherStatus,
  VoucherPayload
} from "../../../electron/shared/types";
import { friendlyErrorMessage } from "../../utils/errors";

interface UseVoucherRegisterProps {
  isAuthenticated: boolean;
  addNotice: (message: string, type?: "info" | "success" | "error") => void;
  onVoucherLoaded: (voucher: VoucherPayload) => void;
}

export function useVoucherRegister({ isAuthenticated, addNotice, onVoucherLoaded }: UseVoucherRegisterProps) {
  const [documentHistory, setDocumentHistory] = useState<VoucherDocumentRecord[]>([]);
  const [voucherRevisions, setVoucherRevisions] = useState<VoucherRevisionRecord[]>([]);
  const [voucherRegister, setVoucherRegister] = useState<VoucherRecord[]>([]);
  const [voucherFilters, setVoucherFilters] = useState<VoucherListFilters>({
    status: "all",
    dateFrom: "",
    dateTo: "",
    query: ""
  });
  const [isLoadingRegister, setIsLoadingRegister] = useState(false);
  const [openingVoucherId, setOpeningVoucherId] = useState<string | null>(null);
  const [statusUpdatingId, setStatusUpdatingId] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthenticated || !window.meridian?.listVoucherDocuments) {
      setDocumentHistory([]);
      return;
    }

    void window.meridian
      .listVoucherDocuments()
      .then(setDocumentHistory)
      .catch((error) => {
        addNotice(friendlyErrorMessage(error, "Unable to load document history"), "error");
      });
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated || !window.meridian?.listVouchers) {
      setVoucherRegister([]);
      return;
    }

    void refreshVoucherRegister(voucherFilters);
  }, [isAuthenticated]);

  async function refreshDocumentHistory() {
    if (!window.meridian?.listVoucherDocuments) {
      return;
    }

    try {
      const history = await window.meridian.listVoucherDocuments();
      setDocumentHistory(history);
    } catch (error) {
      addNotice(friendlyErrorMessage(error, "Unable to load document history"), "error");
    }
  }

  async function refreshVoucherRegister(nextFilters: VoucherListFilters = voucherFilters) {
    if (!window.meridian?.listVouchers) {
      return;
    }

    setIsLoadingRegister(true);
    try {
      const vouchers = await window.meridian.listVouchers(nextFilters);
      setVoucherRegister(vouchers);
    } catch (error) {
      addNotice(friendlyErrorMessage(error, "Unable to load vouchers"), "error");
    } finally {
      setIsLoadingRegister(false);
    }
  }

  async function refreshVoucherRevisions(voucherId: string) {
    if (!window.meridian?.listVoucherRevisions) {
      return;
    }

    try {
      const revisions = await window.meridian.listVoucherRevisions(voucherId);
      setVoucherRevisions(revisions);
    } catch (error) {
      addNotice(friendlyErrorMessage(error, "Unable to load voucher history"), "error");
    }
  }

  async function handleVoucherStatusUpdate(voucherId: string, status: VoucherStatus) {
    if (!window.meridian?.updateVoucherStatus) {
      addNotice("Voucher status update is unavailable; restart the application", "error");
      return;
    }

    setStatusUpdatingId(voucherId);
    try {
      const result = await window.meridian.updateVoucherStatus(voucherId, status);
      addNotice(`Voucher marked as ${result.status}`);
      await refreshVoucherRevisions(voucherId);
      await refreshVoucherRegister(voucherFilters);
    } catch (error) {
      addNotice(friendlyErrorMessage(error, "Unable to update voucher status"), "error");
    } finally {
      setStatusUpdatingId(null);
    }
  }

  async function openVoucherFromSearch(voucher: VoucherRecord, onOpenSuccess?: () => void) {
    if (!window.meridian?.getVoucher) {
      addNotice("Voucher loading is unavailable; restart the application", "error");
      return;
    }

    setOpeningVoucherId(voucher.id);
    try {
      const fullVoucher = await window.meridian.getVoucher(voucher.id);
      onVoucherLoaded(fullVoucher);
      await refreshVoucherRevisions(voucher.id);
      if (onOpenSuccess) {
        onOpenSuccess();
      }
      addNotice(`Loaded voucher ${voucher.requisitionNo || voucher.tourNo || voucher.id.slice(0, 8)}`);
    } catch (error) {
      addNotice(friendlyErrorMessage(error, "Unable to load voucher"), "error");
    } finally {
      setOpeningVoucherId(null);
    }
  }

  return {
    documentHistory,
    setDocumentHistory,
    voucherRevisions,
    setVoucherRevisions,
    voucherRegister,
    setVoucherRegister,
    voucherFilters,
    setVoucherFilters,
    isLoadingRegister,
    setIsLoadingRegister,
    openingVoucherId,
    setOpeningVoucherId,
    statusUpdatingId,
    setStatusUpdatingId,
    refreshDocumentHistory,
    refreshVoucherRegister,
    refreshVoucherRevisions,
    handleVoucherStatusUpdate,
    openVoucherFromSearch
  };
}
