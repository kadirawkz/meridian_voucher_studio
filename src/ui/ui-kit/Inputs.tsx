import { ChevronDown } from "lucide-react";
import { forwardRef, type ComponentPropsWithoutRef } from "react";

export const Input = forwardRef<HTMLInputElement, ComponentPropsWithoutRef<"input">>(
  ({ className = "", ...props }, ref) => {
    return <input ref={ref} {...props} className={["app-input", className].filter(Boolean).join(" ")} />;
  }
);

Input.displayName = "Input";

export const Select = forwardRef<HTMLSelectElement, ComponentPropsWithoutRef<"select">>(
  ({ className = "", ...props }, ref) => {
    const isCompact = className?.includes("app-table-control");

    return (
      <div className="app-select-shell w-full">
        <select
          ref={ref}
          {...props}
          className={[
            "app-select app-select-with-chevron w-full",
            isCompact ? "app-select-compact" : "",
            className,
          ].filter(Boolean).join(" ")}
        />
        <ChevronDown size={16} className="app-select-chevron" />
      </div>
    );
  }
);

Select.displayName = "Select";

export const Textarea = forwardRef<HTMLTextAreaElement, ComponentPropsWithoutRef<"textarea">>(
  ({ className = "", ...props }, ref) => {
    return <textarea ref={ref} {...props} className={["app-textarea", className].filter(Boolean).join(" ")} />;
  }
);

Textarea.displayName = "Textarea";

