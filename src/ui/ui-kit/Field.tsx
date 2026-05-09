import type { ReactNode } from "react";

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: ReactNode }) {
  return (
    <label className="space-y-2">
      <span className="app-label">{label}</span>
      {children}
      {hint ? <div className="text-xs text-steel">{hint}</div> : null}
    </label>
  );
}

