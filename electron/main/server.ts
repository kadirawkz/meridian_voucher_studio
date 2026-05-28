import express from "express";
import type { AddressInfo } from "node:net";
import type { DocumentFormat, VoucherListFilters, VoucherPayload, VoucherStatus } from "../shared/types.js";
import { generateDocuments } from "./lib/documentGenerator.js";
import { getVoucher, listVoucherDocuments, listVoucherRevisions, listVouchers, saveGeneratedDocumentRecord, saveVoucher, searchWorkspace, updateVoucherStatus } from "./lib/supabase.js";
import {
  autoFillVoucherFromHotelRates,
  getHotelRates,
  listHotelRates,
  listHotelsFromRates,
  saveHotelRates,
  getAllHotelRates,
  deleteHotelRate,
  listInactiveHotelRates,
  restoreHotelRate,
  listHotels,
  listMarkets,
  listRoomCategories,
  listCustomers,
  listTourTypes,
  saveTourType,
  deleteTourType,
  listMealBasis,
  saveMealBasis,
  deleteMealBasis,
  saveMarket,
  deleteMarket,
  saveCustomer,
  deleteCustomer,
  saveRoomCategory,
  deleteRoomCategory,
  listCurrencies,
  saveCurrency,
  deleteCurrency,
  listInactiveReferences,
  restoreReference,
} from "./lib/hotelRates.js";

export async function createVoucherServer(): Promise<{ url: string; close: () => Promise<void> }> {
  const app = express();
  app.disable("x-powered-by");
  app.use(express.json({ limit: "1mb" }));

  app.get("/health", (_request, response) => {
    response.json({ ok: true });
  });

  app.post("/api/vouchers", async (request, response) => {
    try {
      const result = await saveVoucher(request.body as VoucherPayload);
      response.json(result);
    } catch (error) {
      response.status(500).send(error instanceof Error ? error.message : "Unable to save voucher");
    }
  });

  app.post("/api/vouchers/generate", async (request, response) => {
    try {
      const body = request.body as VoucherPayload | { voucher: VoucherPayload; format?: DocumentFormat; customOutputDir?: string };
      const voucher = "voucher" in body ? body.voucher : body;
      const format = "voucher" in body ? body.format : "pdf";
      const customOutputDir = "voucher" in body ? (body as { customOutputDir?: string }).customOutputDir : undefined;



      const savedVoucher = await saveVoucher(voucher, "generated");
      const result = await generateDocuments({ ...voucher, id: savedVoucher.id }, format ?? "pdf", customOutputDir);
      const documentRecord = await saveGeneratedDocumentRecord(savedVoucher.id, format ?? "pdf", result);
      response.json(documentRecord);
    } catch (error) {
      response.status(500).send(error instanceof Error ? error.message : "Unable to generate documents");
    }
  });

  app.get("/api/voucher-documents", async (_request, response) => {
    try {
      const result = await listVoucherDocuments();
      response.json(result);
    } catch (error) {
      response.status(500).send(error instanceof Error ? error.message : "Unable to load document history");
    }
  });

  app.get("/api/vouchers", async (request, response) => {
    try {
      const filters: VoucherListFilters = {
        status: typeof request.query.status === "string" ? (request.query.status as VoucherListFilters["status"]) : "all",
        dateFrom: typeof request.query.dateFrom === "string" ? request.query.dateFrom : "",
        dateTo: typeof request.query.dateTo === "string" ? request.query.dateTo : "",
        query: typeof request.query.query === "string" ? request.query.query : ""
      };
      const result = await listVouchers(filters);
      response.json(result);
    } catch (error) {
      response.status(500).send(error instanceof Error ? error.message : "Unable to load vouchers");
    }
  });

  app.get("/api/vouchers/:id", async (request, response) => {
    try {
      const result = await getVoucher(request.params.id);
      response.json(result);
    } catch (error) {
      response.status(500).send(error instanceof Error ? error.message : "Unable to load voucher");
    }
  });

  app.get("/api/vouchers/:id/revisions", async (request, response) => {
    try {
      const result = await listVoucherRevisions(request.params.id);
      response.json(result);
    } catch (error) {
      response.status(500).send(error instanceof Error ? error.message : "Unable to load voucher revisions");
    }
  });

  app.patch("/api/vouchers/:id/status", async (request, response) => {
    try {
      const voucherId = request.params.id;
      const status = (request.body as { status?: VoucherStatus }).status;

      if (!status) {
        response.status(400).send("Voucher status is required");
        return;
      }

      const result = await updateVoucherStatus(voucherId, status);
      response.json(result);
    } catch (error) {
      response.status(500).send(error instanceof Error ? error.message : "Unable to update voucher status");
    }
  });

  app.get("/api/search", async (request, response) => {
    try {
      const query = typeof request.query.q === "string" ? request.query.q : "";
      const result = await searchWorkspace(query);
      response.json(result);
    } catch (error) {
      response.status(500).send(error instanceof Error ? error.message : "Unable to search workspace");
    }
  });

  /* ---------- Reference Data endpoints ---------- */

  app.get("/api/reference/hotels", async (_request, response) => {
    try {
      const result = await listHotels();
      response.json(result);
    } catch (error) {
      response.status(500).send(error instanceof Error ? error.message : "Unable to load hotels");
    }
  });

  app.get("/api/reference/markets", async (_request, response) => {
    try {
      const result = await listMarkets();
      response.json(result);
    } catch (error) {
      response.status(500).send(error instanceof Error ? error.message : "Unable to load markets");
    }
  });

  app.post("/api/reference/markets", async (request, response) => {
    try {
      await saveMarket(request.body);
      response.json({ success: true });
    } catch (error) {
      response.status(500).send(error instanceof Error ? error.message : "Unable to save market");
    }
  });

  app.delete("/api/reference/markets/:id", async (request, response) => {
    try {
      await deleteMarket(request.params.id);
      response.json({ success: true });
    } catch (error) {
      response.status(500).send(error instanceof Error ? error.message : "Unable to delete market");
    }
  });

  app.get("/api/reference/room-categories", async (_request, response) => {
    try {
      const result = await listRoomCategories();
      response.json(result);
    } catch (error) {
      response.status(500).send(error instanceof Error ? error.message : "Unable to load room categories");
    }
  });

  app.post("/api/reference/room-categories", async (request, response) => {
    try {
      await saveRoomCategory(request.body);
      response.json({ success: true });
    } catch (error) {
      response.status(500).send(error instanceof Error ? error.message : "Unable to save room category");
    }
  });

  app.delete("/api/reference/room-categories/:id", async (request, response) => {
    try {
      await deleteRoomCategory(request.params.id);
      response.json({ success: true });
    } catch (error) {
      response.status(500).send(error instanceof Error ? error.message : "Unable to delete room category");
    }
  });

  app.get("/api/reference/customers", async (_request, response) => {
    try {
      const result = await listCustomers();
      response.json(result);
    } catch (error) {
      response.status(500).send(error instanceof Error ? error.message : "Unable to load customers");
    }
  });

  app.post("/api/reference/customers", async (request, response) => {
    try {
      await saveCustomer(request.body);
      response.json({ success: true });
    } catch (error) {
      response.status(500).send(error instanceof Error ? error.message : "Unable to save customer");
    }
  });

  app.delete("/api/reference/customers/:id", async (request, response) => {
    try {
      await deleteCustomer(request.params.id);
      response.json({ success: true });
    } catch (error) {
      response.status(500).send(error instanceof Error ? error.message : "Unable to delete customer");
    }
  });

  app.get("/api/reference/tour-types", async (_request, response) => {
    try {
      const result = await listTourTypes();
      response.json(result);
    } catch (error) {
      response.status(500).send(error instanceof Error ? error.message : "Unable to load tour types");
    }
  });

  app.post("/api/reference/tour-types", async (request, response) => {
    try {
      await saveTourType(request.body);
      response.json({ success: true });
    } catch (error) {
      response.status(500).send(error instanceof Error ? error.message : "Unable to save tour type");
    }
  });

  app.delete("/api/reference/tour-types/:id", async (request, response) => {
    try {
      await deleteTourType(request.params.id);
      response.json({ success: true });
    } catch (error) {
      response.status(500).send(error instanceof Error ? error.message : "Unable to delete tour type");
    }
  });

  app.get("/api/reference/meal-basis", async (_request, response) => {
    try {
      const result = await listMealBasis();
      response.json(result);
    } catch (error) {
      response.status(500).send(error instanceof Error ? error.message : "Unable to load meal basis options");
    }
  });

  app.post("/api/reference/meal-basis", async (request, response) => {
    try {
      await saveMealBasis(request.body);
      response.json({ success: true });
    } catch (error) {
      response.status(500).send(error instanceof Error ? error.message : "Unable to save meal basis option");
    }
  });

  app.delete("/api/reference/meal-basis/:id", async (request, response) => {
    try {
      await deleteMealBasis(request.params.id);
      response.json({ success: true });
    } catch (error) {
      response.status(500).send(error instanceof Error ? error.message : "Unable to delete meal basis option");
    }
  });

  app.get("/api/reference/currencies", async (_request, response) => {
    try {
      const result = await listCurrencies();
      response.json(result);
    } catch (error) {
      response.status(500).send(error instanceof Error ? error.message : "Unable to load currencies");
    }
  });

  app.post("/api/reference/currencies", async (request, response) => {
    try {
      await saveCurrency(request.body);
      response.json({ success: true });
    } catch (error) {
      response.status(500).send(error instanceof Error ? error.message : "Unable to save currency");
    }
  });

  app.delete("/api/reference/currencies/:id", async (request, response) => {
    try {
      await deleteCurrency(request.params.id);
      response.json({ success: true });
    } catch (error) {
      response.status(500).send(error instanceof Error ? error.message : "Unable to delete currency");
    }
  });

  /* ---------- Soft-Delete Archive & Restore endpoints ---------- */

  app.get("/api/reference/:table/inactive", async (request, response) => {
    try {
      const result = await listInactiveReferences(request.params.table);
      response.json(result);
    } catch (error) {
      response.status(500).send(error instanceof Error ? error.message : "Unable to load inactive references");
    }
  });

  app.patch("/api/reference/:table/:id/restore", async (request, response) => {
    try {
      await restoreReference(request.params.table, request.params.id);
      response.json({ success: true });
    } catch (error) {
      response.status(500).send(error instanceof Error ? error.message : "Unable to restore reference");
    }
  });

  /* ---------- Rate Master endpoints ---------- */

  app.post("/api/rate-master", async (request, response) => {
    try {
      const result = await saveHotelRates(request.body);
      response.json(result);
    } catch (error) {
      response.status(500).send(error instanceof Error ? error.message : "Unable to save rate master data");
    }
  });

  app.get("/api/rate-master", async (request, response) => {
    try {
      const hotelName = typeof request.query.hotelName === "string" ? request.query.hotelName : undefined;
      const result = await listHotelRates(hotelName);
      response.json(result);
    } catch (error) {
      response.status(500).send(error instanceof Error ? error.message : "Unable to load rate master contracts");
    }
  });

  app.get("/api/rate-master/all", async (_request, response) => {
    try {
      const result = await getAllHotelRates();
      response.json(result);
    } catch (error) {
      response.status(500).send(error instanceof Error ? error.message : "Unable to load rate master contracts");
    }
  });

  app.get("/api/rate-master/inactive", async (_request, response) => {
    try {
      const result = await listInactiveHotelRates();
      response.json(result);
    } catch (error) {
      response.status(500).send(error instanceof Error ? error.message : "Unable to load inactive rate master contracts");
    }
  });

  app.patch("/api/rate-master/:id/restore", async (request, response) => {
    try {
      await restoreHotelRate(request.params.id);
      response.json({ success: true });
    } catch (error) {
      response.status(500).send(error instanceof Error ? error.message : "Unable to restore rate master contract");
    }
  });

  app.get("/api/rate-master/hotels", async (_request, response) => {
    try {
      const result = await listHotelsFromRates();
      response.json(result);
    } catch (error) {
      response.status(500).send(error instanceof Error ? error.message : "Unable to load hotels");
    }
  });

  app.get("/api/rate-master/:id", async (request, response) => {
    try {
      const result = await getHotelRates(request.params.id);
      response.json(result);
    } catch (error) {
      response.status(500).send(error instanceof Error ? error.message : "Unable to load rate master contract");
    }
  });

  app.delete("/api/rate-master/:id", async (request, response) => {
    try {
      await deleteHotelRate(request.params.id);
      response.json({ success: true });
    } catch (error) {
      response.status(500).send(error instanceof Error ? error.message : "Unable to delete rate master contract");
    }
  });

  app.post("/api/rate-master/auto-fill", async (request, response) => {
    try {
      const { voucher, contractId } = request.body as { voucher: VoucherPayload; contractId?: string };
      const result = await autoFillVoucherFromHotelRates(voucher, contractId);
      response.json(result);
    } catch (error) {
      response.status(500).send(error instanceof Error ? error.message : "Unable to auto-fill voucher");
    }
  });

  const configuredPort = Number(process.env.VOUCHER_API_PORT || 0);

  return new Promise((resolve) => {
    const server = app.listen(configuredPort, "127.0.0.1", () => {
      const address = server.address() as AddressInfo;
      resolve({
        url: `http://127.0.0.1:${address.port}`,
        close: () =>
          new Promise((closeResolve, closeReject) => {
            server.close((error) => (error ? closeReject(error) : closeResolve()));
          })
      });
    });
  });
}
