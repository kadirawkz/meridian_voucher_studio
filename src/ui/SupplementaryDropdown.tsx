import React, { useState, useRef, useEffect } from "react";
import { ChevronDown, Check } from "lucide-react";
import { createPortal } from "react-dom";

interface SupplementaryDropdownProps {
  value: string[];
  onChange: (val: string[]) => void;
  options: { name: string; label: string }[];
}

export function SupplementaryDropdown({
  value,
  onChange,
  options,
}: SupplementaryDropdownProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState({ top: 0, left: 0 });

  const updateCoords = () => {
    if (ref.current) {
      const rect = ref.current.getBoundingClientRect();
      setCoords({
        top: rect.bottom + window.scrollY,
        left: rect.left + window.scrollX,
      });
    }
  };

  const handleToggle = () => {
    if (!open) {
      updateCoords();
    }
    setOpen(!open);
  };

  useEffect(() => {
    if (!open) return;

    window.addEventListener("scroll", updateCoords, true);
    window.addEventListener("resize", updateCoords);
    return () => {
      window.removeEventListener("scroll", updateCoords, true);
      window.removeEventListener("resize", updateCoords);
    };
  }, [open]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        // Ensure we aren't clicking inside the portal dropdown itself
        const portalDropdowns = document.querySelectorAll(".app-portal-supplementary");
        let clickedInsidePortal = false;
        portalDropdowns.forEach((dropdown) => {
          if (dropdown.contains(event.target as Node)) {
            clickedInsidePortal = true;
          }
        });

        if (!clickedInsidePortal) {
          setOpen(false);
        }
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const display =
    value.length > 0 ? value.map((v) => v.slice(0, 2)).join(", ") : "Select";

  return (
    <div className="relative w-full" ref={ref}>
      <div
        className="app-select-shell w-full animate-in fade-in duration-100"
        data-open={open}
      >
        <button
          type="button"
          onClick={handleToggle}
          className="app-select app-select-with-chevron w-full app-select-compact app-table-control text-left truncate pr-8 cursor-pointer select-none bg-surface"
          title={value.join(", ")}
        >
          {display}
        </button>
        <ChevronDown size={16} className="app-select-chevron" />
      </div>
      {open && createPortal(
        <div
          className="app-portal-supplementary fixed w-56 bg-surface border border-line shadow-lg rounded-app z-[99999] max-h-56 overflow-y-auto dropdown-scrollbar p-1 animate-in fade-in slide-in-from-top-1 duration-150"
          style={{
            top: `${coords.top}px`,
            left: `${coords.left}px`,
          }}
        >
          {options.length === 0 ? (
            <div className="p-3 text-xs text-steel text-center select-none font-medium">
              No supplements
            </div>
          ) : (
            options.map((opt) => {
              const isSelected = value.includes(opt.name);
              return (
                <div
                  key={opt.name}
                  onClick={() => {
                    if (isSelected)
                      onChange(value.filter((v) => v !== opt.name));
                    else onChange([...value, opt.name]);
                  }}
                  className="flex items-center gap-2 px-3 py-2 hover:bg-cloud cursor-pointer text-xs rounded transition-colors select-none text-ink font-medium"
                >
                  <div
                    className={`h-4 w-4 rounded border flex items-center justify-center transition-all shrink-0 ${
                      isSelected
                        ? "border-navy bg-navy text-white animate-in zoom-in-95 duration-100"
                        : "border-line bg-surface text-transparent"
                    }`}
                  >
                    {isSelected && (
                      <Check size={11} strokeWidth={3} className="shrink-0" />
                    )}
                  </div>
                  <span className="truncate" title={opt.label}>
                    {opt.label}
                  </span>
                </div>
              );
            })
          )}
        </div>,
        document.body
      )}
    </div>
  );
}
