import type { ComponentPropsWithoutRef } from "react";

export function Input({ className = "", ...props }: ComponentPropsWithoutRef<"input">) {
  return <input {...props} className={["app-input", className].filter(Boolean).join(" ")} />;
}

export function Select({ className = "", ...props }: ComponentPropsWithoutRef<"select">) {
  return <select {...props} className={["app-select", className].filter(Boolean).join(" ")} />;
}

export function Textarea({ className = "", ...props }: ComponentPropsWithoutRef<"textarea">) {
  return <textarea {...props} className={["app-textarea", className].filter(Boolean).join(" ")} />;
}

