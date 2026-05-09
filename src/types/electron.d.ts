import type { AppApi } from "../../electron/shared/types";

declare global {
  interface Window {
    meridian: AppApi;
  }
}

export {};
