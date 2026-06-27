import React from "react";
import { RefreshCw } from "lucide-react";
import logo from "../assets/logo.png";

interface LoadingScreenProps {
  themeClass: string;
}

export function LoadingScreen({ themeClass }: LoadingScreenProps) {
  return (
    <div className={`min-h-screen ${themeClass} bg-bg text-ink`}>
      <div className="app-loading-screen">
        <div className="app-loading-card">
          <div className="app-loading-logo overflow-hidden bg-cloud">
            <img
              src={logo}
              alt="Logo"
              className="h-full w-full object-contain"
            />
          </div>
          <RefreshCw className="animate-spin text-navy my-4" size={32} />
          <p className="app-loading-text">Meridian Voucher Studio</p>
          <p className="app-loading-subtext">Initializing workspace…</p>
        </div>
      </div>
    </div>
  );
}
