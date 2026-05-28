import { useState, useEffect, useMemo } from "react";
import { useForm, useFieldArray, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { defaultVoucher } from "../../domain/defaultVoucher";
import { VoucherFormValues, voucherSchema } from "../../domain/voucherSchema";
import {
  withAccountDefaults,
  isFormVoucherEqual,
} from "../../domain/voucherUtils";
import { friendlyErrorMessage } from "../../utils/errors";
import type {
  AccountProfile,
  GeneratedDocument,
  HotelRateRecordSummary,
  HotelRef,
  MarketRef,
  RoomCategoryRef,
  CustomerRef,
  TourTypeRef,
  MealBasisRef,
} from "../../../electron/shared/types";

interface UseVoucherFormProps {
  isAuthenticated: boolean;
  activeView: string;
  accountProfile: AccountProfile | null;
  addNotice: (message: string, type?: "info" | "success" | "error") => void;
  refreshVoucherRegister: () => Promise<void>;
  refreshDocumentHistory: () => Promise<void>;
  refreshToursFolderTree: () => Promise<void>;
  refreshVoucherRevisions: (id: string) => Promise<void>;
}

export function useVoucherForm({
  isAuthenticated,
  activeView,
  accountProfile,
  addNotice,
  refreshVoucherRegister,
  refreshDocumentHistory,
  refreshToursFolderTree,
  refreshVoucherRevisions,
}: UseVoucherFormProps) {
  const [actionState, setActionState] = useState<
    "idle" | "saving" | "generating-docx" | "generating-pdf"
  >("idle");
  const [generated, setGenerated] = useState<GeneratedDocument | null>(null);

  const [hotelOptions, setHotelOptions] = useState<string[]>([]);
  const [marketOptions, setMarketOptions] = useState<readonly string[]>([]);
  const [roomCategoryOptions, setRoomCategoryOptions] = useState<
    readonly string[]
  >([]);
  const [customerOptions, setCustomerOptions] = useState<string[]>([]);
  const [tourTypeOptions, setTourTypeOptions] = useState<readonly string[]>([]);
  const [mealBasisOptionsState, setMealBasisOptionsState] = useState<
    readonly string[]
  >([]);

  const [selectedHotelRateId, setSelectedHotelRateId] = useState<string>("");
  const [ratesTrigger, setRatesTrigger] = useState(0);
  const [hotelContracts, setHotelContracts] = useState<
    HotelRateRecordSummary[]
  >([]);
  const [availableSupplements, setAvailableSupplements] = useState<
    {
      supplement_name: string;
      room_category: string;
      supplement_amount: number;
      per: string;
    }[]
  >([]);
  const [manualRates, setManualRates] = useState(false);

  const [docxDropdownOpen, setDocxDropdownOpen] = useState(false);
  const [pdfDropdownOpen, setPdfDropdownOpen] = useState(false);

  const form = useForm<VoucherFormValues>({
    resolver: zodResolver(voucherSchema),
    defaultValues: defaultVoucher,
    mode: "onChange",
  });

  const [lastSavedValues, setLastSavedValues] =
    useState<VoucherFormValues>(defaultVoucher);

  function resetForm(newValues: VoucherFormValues) {
    form.reset(newValues);
    setLastSavedValues(newValues);
  }

  const currentValues = form.watch();
  const hasChanges = useMemo(() => {
    return !isFormVoucherEqual(currentValues, lastSavedValues);
  }, [currentValues, lastSavedValues]);

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "lineItems",
  });

  const lineItems = useWatch({
    control: form.control,
    name: "lineItems",
    defaultValue: defaultVoucher.lineItems,
  }) as VoucherFormValues["lineItems"];

  const hotelName = form.watch("hotelName");
  const market = form.watch("market");
  const ratePeriod = form.watch("ratePeriod");
  const customerName = form.watch("customerName");
  const tourType = form.watch("tourType");
  const voucherType = form.watch("voucherType");

  const dailyRooms = useMemo(() => {
    const grouped = new Map<string, { rooms: number; children: number }>();
    for (const item of lineItems) {
      if (!item.requiredDate) continue;
      const rooms =
        Number(item.singleRooms || 0) +
        Number(item.doubleRooms || 0) +
        Number(item.twinRooms || 0) +
        Number(item.tripleRooms || 0);

      const children =
        Number(item.child2_5 || 0) +
        Number(item.child2_5Sharing || 0) +
        Number(item.child2_5Bed || 0) +
        Number(item.child2_5OwnRoom || 0) +
        Number(item.child6_11 || 0) +
        Number(item.child6_11Sharing || 0) +
        Number(item.child6_11Bed || 0) +
        Number(item.child6_11OwnRoom || 0);

      if (rooms > 0 || children > 0) {
        const existing = grouped.get(item.requiredDate) || {
          rooms: 0,
          children: 0,
        };
        grouped.set(item.requiredDate, {
          rooms: existing.rooms + rooms,
          children: existing.children + children,
        });
      }
    }

    return Array.from(grouped.entries())
      .map(([date, counts]) => ({ date, ...counts }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [lineItems]);

  const uniqueContractNames = useMemo(() => {
    const names = new Set(hotelContracts.map((c) => c.contract_name));
    return Array.from(names).sort();
  }, [hotelContracts]);

  // Load contracts when hotelName or ratesTrigger changes
  useEffect(() => {
    if (hotelName) {
      void window.meridian?.listHotelRates(hotelName).then(setHotelContracts);
    } else {
      setHotelContracts([]);
    }
  }, [hotelName, ratesTrigger]);

  // Load supplements when hotelName, ratePeriod change
  useEffect(() => {
    if (hotelName && ratePeriod && hotelContracts.length > 0) {
      const match = hotelContracts.find((c) => c.contract_name === ratePeriod);
      if (match && match.id) {
        window.meridian?.getHotelRates(match.id).then((rate) => {
          setAvailableSupplements(rate.room_supplements || []);
        });
      } else {
        setAvailableSupplements([]);
      }
    } else {
      setAvailableSupplements([]);
    }
  }, [hotelName, ratePeriod, hotelContracts]);

  // Reset selected rate ID on hotel/market change
  useEffect(() => {
    setSelectedHotelRateId("");
  }, [hotelName, market]);

  // Load reference selections options
  useEffect(() => {
    if (!isAuthenticated) {
      setHotelOptions([]);
      setMarketOptions([]);
      setRoomCategoryOptions([]);
      setCustomerOptions([]);
      setTourTypeOptions([]);
      setMealBasisOptionsState([]);
      return;
    }

    if (window.meridian?.listHotels) {
      void window.meridian
        .listHotels()
        .then((refs: HotelRef[]) => {
          const names = refs.map((h) => h.name).filter(Boolean);
          setHotelOptions(names.sort((a, b) => a.localeCompare(b)));
        })
        .catch(() => setHotelOptions([]));
    }

    if (window.meridian?.listMarkets) {
      void window.meridian
        .listMarkets()
        .then((refs: MarketRef[]) =>
          setMarketOptions(refs.map((m) => m.code).filter(Boolean)),
        )
        .catch(() => setMarketOptions([]));
    }

    if (window.meridian?.listRoomCategories) {
      void window.meridian
        .listRoomCategories()
        .then((refs: RoomCategoryRef[]) =>
          setRoomCategoryOptions(refs.map((r) => r.name).filter(Boolean)),
        )
        .catch(() => setRoomCategoryOptions([]));
    }

    if (window.meridian?.listCustomers) {
      void window.meridian
        .listCustomers()
        .then((refs: CustomerRef[]) =>
          setCustomerOptions(refs.map((c) => c.name).filter(Boolean)),
        )
        .catch(() => setCustomerOptions([]));
    }

    if (window.meridian?.listTourTypes) {
      void window.meridian
        .listTourTypes()
        .then((refs: TourTypeRef[]) =>
          setTourTypeOptions(refs.map((t) => t.code).filter(Boolean)),
        )
        .catch(() => setTourTypeOptions([]));
    }

    if (window.meridian?.listMealBasis) {
      void window.meridian
        .listMealBasis()
        .then((refs: MealBasisRef[]) =>
          setMealBasisOptionsState(refs.map((b) => b.code).filter(Boolean)),
        )
        .catch(() => setMealBasisOptionsState([]));
    }
  }, [isAuthenticated, activeView, ratesTrigger]);

  // Voucher autofill listener
  useEffect(() => {
    if (!hotelName || !window.meridian?.autoFillVoucher || manualRates) return;

    const timer = window.setTimeout(async () => {
      try {
        const values = form.getValues();
        const result = await window.meridian.autoFillVoucher(
          values,
          selectedHotelRateId || undefined,
        );

        if (result.status === "matched") {
          form.setValue("rateApplicableText", result.rateApplicableText || "");
          form.setValue("matchedHotelRateId", result.matchedHotelRateId ?? "");
          if (result.billingInstructions)
            form.setValue("billingInstructions", result.billingInstructions);
        } else if (
          result.status === "multiple" &&
          result.candidateHotelRates?.length
        ) {
          form.setValue("rateApplicableText", "");
          form.setValue("matchedHotelRateId", "");
        } else {
          form.setValue("rateApplicableText", "");
        }
      } catch {
        // Ignored
      }
    }, 400);

    return () => window.clearTimeout(timer);
  }, [
    lineItems,
    hotelName,
    market,
    ratePeriod,
    form,
    selectedHotelRateId,
    manualRates,
    ratesTrigger,
  ]);

  // Auto set tour name
  useEffect(() => {
    if (!customerName || !tourType) return;
    if (form.formState.dirtyFields.tourName) return;

    const firstDate = lineItems
      .map((li) => li.requiredDate)
      .filter(Boolean)
      .sort()[0];
    let dateStr = "";
    if (firstDate) {
      const d = new Date(firstDate);
      if (!isNaN(d.getTime())) {
        const monthNames = [
          "Jan",
          "Feb",
          "Mar",
          "Apr",
          "May",
          "Jun",
          "Jul",
          "Aug",
          "Sep",
          "Oct",
          "Nov",
          "Dec",
        ];
        dateStr = ` ${monthNames[d.getMonth()]} ${d.getFullYear()}`;
      }
    }

    form.setValue("tourName", `${customerName} ${tourType}${dateStr}`.trim(), {
      shouldValidate: true,
    });
  }, [customerName, tourType, lineItems, form]);

  // Auto set voucher title
  useEffect(() => {
    if (!voucherType) return;
    if (form.formState.dirtyFields.voucherTitle) return;

    const titleMap: Record<string, string> = {
      reservation: "Hotel Reservation Voucher",
      amendment: "Amendment Voucher",
      pptp: "PPTP Voucher",
    };

    const title = titleMap[voucherType as string] || "";
    if (title) {
      form.setValue("voucherTitle", title, { shouldValidate: true });
    }
  }, [voucherType, form]);

  async function handleSave(values: VoucherFormValues) {
    if (!window.meridian) {
      addNotice("Desktop bridge unavailable; restart the application", "error");
      return;
    }

    setActionState("saving");
    try {
      const result = await window.meridian.saveVoucher(values);
      addNotice(`Draft saved successfully (${result.id.slice(0, 8)})`);
      resetForm({ ...values, id: result.id });
      await refreshVoucherRevisions(result.id);
      await refreshVoucherRegister();
    } catch (error) {
      addNotice(friendlyErrorMessage(error, "Unable to save voucher"), "error");
    } finally {
      setActionState("idle");
    }
  }

  async function handleGenerateDocx(
    values: VoucherFormValues,
    customOutputDir?: string,
  ) {
    if (!window.meridian) {
      addNotice("Desktop bridge unavailable; restart the application", "error");
      return;
    }

    setActionState("generating-docx");
    try {
      const result = window.meridian.generateDocx
        ? await window.meridian.generateDocx(values, customOutputDir)
        : await window.meridian.generateDocuments!(values);
      setGenerated(result);
      if (result.voucherId) {
        form.setValue("id", result.voucherId);
        await refreshVoucherRevisions(result.voucherId);
      }
      addNotice(
        customOutputDir
          ? "DOCX generated in custom location"
          : "DOCX generated",
      );
      await refreshDocumentHistory();
      await refreshVoucherRegister();
      await refreshToursFolderTree();
    } catch (error) {
      addNotice(
        friendlyErrorMessage(error, "Unable to generate DOCX"),
        "error",
      );
    } finally {
      setActionState("idle");
    }
  }

  async function handleGeneratePdf(
    values: VoucherFormValues,
    customOutputDir?: string,
  ) {
    if (!window.meridian) {
      addNotice("Desktop bridge unavailable; restart the application", "error");
      return;
    }

    setActionState("generating-pdf");
    try {
      const result = window.meridian.generatePdf
        ? await window.meridian.generatePdf(values, customOutputDir)
        : await window.meridian.generateDocuments!(values);
      setGenerated(result);
      if (result.voucherId) {
        form.setValue("id", result.voucherId);
        await refreshVoucherRevisions(result.voucherId);
      }
      addNotice(
        customOutputDir ? "PDF generated in custom location" : "PDF generated",
      );
      await refreshDocumentHistory();
      await refreshVoucherRegister();
      await refreshToursFolderTree();
    } catch (error) {
      addNotice(friendlyErrorMessage(error, "Unable to generate PDF"), "error");
    } finally {
      setActionState("idle");
    }
  }

  function handleClearForm() {
    resetForm(withAccountDefaults(defaultVoucher, accountProfile));
    setGenerated(null);
    addNotice("Form cleared");
  }

  return {
    form,
    resetForm,
    lastSavedValues,
    setLastSavedValues,
    currentValues,
    hasChanges,
    fields,
    append,
    remove,
    lineItems,
    hotelName,
    market,
    ratePeriod,
    customerName,
    tourType,
    voucherType,
    dailyRooms,
    uniqueContractNames,
    actionState,
    setActionState,
    generated,
    setGenerated,
    hotelOptions,
    marketOptions,
    roomCategoryOptions,
    customerOptions,
    tourTypeOptions,
    mealBasisOptionsState,
    selectedHotelRateId,
    setSelectedHotelRateId,
    ratesTrigger,
    setRatesTrigger,
    availableSupplements,
    manualRates,
    setManualRates,
    docxDropdownOpen,
    setDocxDropdownOpen,
    pdfDropdownOpen,
    setPdfDropdownOpen,
    handleSave,
    handleGenerateDocx,
    handleGeneratePdf,
    handleClearForm,
  };
}
