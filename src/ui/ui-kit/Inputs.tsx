import { ChevronDown } from "lucide-react";
import React, {
  forwardRef,
  useState,
  useRef,
  useEffect,
  type ComponentPropsWithoutRef,
} from "react";

export const Input = forwardRef<
  HTMLInputElement,
  ComponentPropsWithoutRef<"input">
>(({ className = "", ...props }, ref) => {
  return (
    <input
      ref={ref}
      {...props}
      className={["app-input", className].filter(Boolean).join(" ")}
    />
  );
});

Input.displayName = "Input";

export const Select = forwardRef<
  HTMLSelectElement,
  ComponentPropsWithoutRef<"select">
>(({ className = "", children, value, onChange, ...props }, ref) => {
  const isCompact = className?.includes("app-table-control");
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const selectRef = useRef<HTMLSelectElement | null>(null);

  // Extract options from children React nodes
  const options = React.Children.toArray(children)
    .map((child) => {
      if (React.isValidElement(child) && child.type === "option") {
        return {
          value: String(child.props.value),
          label: String(child.props.children || child.props.value),
          disabled: !!child.props.disabled,
        };
      }
      return null;
    })
    .filter(
      (opt): opt is { value: string; label: string; disabled: boolean } =>
        opt !== null,
    );

  const [selectedValue, setSelectedValue] = useState<string>("");

  useEffect(() => {
    if (value !== undefined) {
      setSelectedValue(String(value));
    } else if (selectRef.current) {
      setSelectedValue(selectRef.current.value);
    }
  }, [value]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selectedOption =
    options.find((opt) => opt.value === selectedValue) || options[0];
  const displayLabel = selectedOption ? selectedOption.label : "Select";

  const handleSelectOption = (optValue: string) => {
    setSelectedValue(optValue);
    setIsOpen(false);

    if (selectRef.current) {
      selectRef.current.value = optValue;
      // Trigger synthetic change event for React and React Hook Form bindings
      const event = new Event("change", { bubbles: true });
      selectRef.current.dispatchEvent(event);
    }

    if (onChange) {
      const synthEvent = {
        target: {
          value: optValue,
          name: props.name || "",
        },
        currentTarget: {
          value: optValue,
          name: props.name || "",
        },
      } as unknown as React.ChangeEvent<HTMLSelectElement>;
      onChange(synthEvent);
    }
  };

  return (
    <div className="relative w-full" ref={containerRef}>
      <select
        ref={(node) => {
          selectRef.current = node;
          if (typeof ref === "function") ref(node);
          else if (ref) ref.current = node;
        }}
        value={selectedValue}
        onChange={(e) => {
          setSelectedValue(e.target.value);
          if (onChange) onChange(e);
        }}
        className="sr-only"
        {...props}
      >
        {children}
      </select>

      <div className="app-select-shell w-full" data-open={isOpen}>
        <button
          type="button"
          disabled={props.disabled}
          onClick={() => !props.disabled && setIsOpen(!isOpen)}
          className={[
            "app-select app-select-with-chevron w-full text-left truncate pr-8 select-none bg-surface flex items-center justify-between border border-line transition-all cursor-pointer",
            isCompact
              ? "app-select-compact h-9 leading-[2.25rem] py-0"
              : "py-2.5 min-h-[42px]",
            props.disabled
              ? "opacity-50 cursor-not-allowed"
              : "hover:border-steel",
            className,
          ]
            .filter(Boolean)
            .join(" ")}
        >
          <span className="truncate">{displayLabel}</span>
        </button>
        <ChevronDown
          size={16}
          className={`app-select-chevron pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-steel transition-transform duration-200 ${
            isOpen ? "rotate-180 text-navy" : ""
          }`}
        />
      </div>

      {isOpen && !props.disabled && (
        <div className="absolute top-full left-0 mt-1 w-full bg-surface border border-line shadow-2xl rounded-app z-[200] max-h-60 overflow-y-auto dropdown-scrollbar p-1 animate-in fade-in slide-in-from-top-1 duration-150">
          {options.length === 0 ? (
            <div className="p-3 text-xs text-steel text-center select-none font-medium">
              No options available
            </div>
          ) : (
            options.map((opt) => {
              const isSelected = opt.value === selectedValue;
              return (
                <button
                  type="button"
                  key={opt.value}
                  disabled={opt.disabled}
                  onClick={() => handleSelectOption(opt.value)}
                  className={[
                    "flex w-full items-center justify-between px-3 py-2 text-xs font-semibold rounded transition-colors select-none text-left",
                    isSelected
                      ? "bg-navy text-white font-bold"
                      : "text-ink hover:bg-cloud hover:text-navy cursor-pointer",
                    opt.disabled ? "opacity-50 cursor-not-allowed" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                >
                  <span className="truncate">{opt.label}</span>
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
});

Select.displayName = "Select";

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  ComponentPropsWithoutRef<"textarea">
>(({ className = "", ...props }, ref) => {
  return (
    <textarea
      ref={ref}
      {...props}
      className={["app-textarea", className].filter(Boolean).join(" ")}
    />
  );
});

Textarea.displayName = "Textarea";
