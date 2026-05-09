import type { ComponentPropsWithoutRef } from "react";

export function Panel({ className = "", ...props }: ComponentPropsWithoutRef<"section">) {
  return <section {...props} className={["app-panel", className].filter(Boolean).join(" ")} />;
}

export function PanelHeader({ className = "", ...props }: ComponentPropsWithoutRef<"div">) {
  return <div {...props} className={["app-panel-header", className].filter(Boolean).join(" ")} />;
}

export function PanelBody({ className = "", ...props }: ComponentPropsWithoutRef<"div">) {
  return <div {...props} className={["app-panel-body", className].filter(Boolean).join(" ")} />;
}

