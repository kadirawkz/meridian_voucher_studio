import dotenv from "dotenv";
import { createVoucherServer } from "./server.js";

// Load environment variables
dotenv.config();

const port = process.env.VOUCHER_API_PORT || "5000";
process.env.VOUCHER_API_PORT = port;

// Ensure host binds to all interfaces in Docker
if (!process.env.VOUCHER_API_HOST) {
  process.env.VOUCHER_API_HOST = "0.0.0.0";
}

console.log("[API Standalone] Starting Voucher Express Server...");
console.log(`[API Standalone] Port: ${process.env.VOUCHER_API_PORT}`);
console.log(`[API Standalone] Host: ${process.env.VOUCHER_API_HOST}`);
console.log(
  "[API Standalone] SUPABASE_URL =",
  process.env.SUPABASE_URL || "<not set>",
);

createVoucherServer()
  .then(({ url }) => {
    console.log(`[API Standalone] Server is listening and ready at ${url}`);
  })
  .catch((error) => {
    console.error("[API Standalone] Failed to start server:", error);
    process.exit(1);
  });
