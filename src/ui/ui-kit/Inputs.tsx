import { ChevronDown } from "lucide-react";
import type { ComponentPropsWithoutRef } from "react";

export function Input({ className = "", ...props }: ComponentPropsWithoutRef<"input">) {
  return <input {...props} className={["app-input", className].filter(Boolean).join(" ")} />;
}

export function Select({ className = "", ...props }: ComponentPropsWithoutRef<"select">) {
  const isCompact = className.includes("app-table-control");

  return (
    <div className="app-select-shell w-full">
      <select
        {...props}
        className={[
          "app-select app-select-with-chevron w-full",
          isCompact ? "app-select-compact" : "",
          className,
          "pr-10",
        ].filter(Boolean).join(" ")}
      />
      <ChevronDown size={16} className="app-select-chevron" />
    </div>
  );
}

export function Textarea({ className = "", ...props }: ComponentPropsWithoutRef<"textarea">) {
  return <textarea {...props} className={["app-textarea", className].filter(Boolean).join(" ")} />;
}

