/* global console, process */

import fs from "node:fs/promises";
import path from "node:path";
import dotenv from "dotenv";

const rootDir = process.cwd();
const envPath = path.join(rootDir, ".env");
const outputDir = path.join(rootDir, "build-resources");
const outputPath = path.join(outputDir, "config.json");

dotenv.config({ path: envPath });

const publicConfig = {
  supabaseUrl: process.env.SUPABASE_URL || "",
  supabaseAnonKey: process.env.SUPABASE_ANON_KEY || "",
  voucherApiPort: Number(process.env.VOUCHER_API_PORT || 0)
};

await fs.mkdir(outputDir, { recursive: true });
await fs.writeFile(outputPath, `${JSON.stringify(publicConfig, null, 2)}\n`, "utf8");

console.log(`Wrote public config to ${path.relative(rootDir, outputPath)}`);
