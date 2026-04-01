"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import {
  INGREDIENT_UNIT_OPTIONS,
  normalizeIngredientUnit,
  searchIngredientUnits,
} from "@/lib/ingredient-units";

type UnitComboboxProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
};

export function UnitCombobox({
  value,
  onChange,
  placeholder = "Unit",
}: UnitComboboxProps) {
  const [inputValue, setInputValue] = useState(value);
  const [open, setOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const rootRef = useRef<HTMLDivElement | null>(null);

  const filteredOptions = useMemo(() => searchIngredientUnits(inputValue), [inputValue]);

  useEffect(() => {
    setInputValue(value);
  }, [value]);

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
        const normalized = normalizeIngredientUnit(inputValue);
        onChange(normalized || inputValue.trim());
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [inputValue, onChange, open]);

  useEffect(() => {
    setHighlightedIndex(0);
  }, [inputValue]);

  const commitValue = (nextValue: string) => {
    setInputValue(nextValue);
    onChange(nextValue);
    setOpen(false);
  };

  return (
    <div ref={rootRef} style={S.wrap}>
      <input
        style={S.input}
        value={inputValue}
        placeholder={placeholder}
        onFocus={() => setOpen(true)}
        onChange={(event) => {
          setInputValue(event.target.value);
          setOpen(true);
        }}
        onBlur={() => {
          window.setTimeout(() => {
            const normalized = normalizeIngredientUnit(inputValue);
            const nextValue = normalized || inputValue.trim();
            setInputValue(nextValue);
            onChange(nextValue);
            setOpen(false);
          }, 100);
        }}
        onKeyDown={(event) => {
          if (!open && (event.key === "ArrowDown" || event.key === "ArrowUp")) {
            setOpen(true);
            return;
          }

          if (event.key === "ArrowDown") {
            event.preventDefault();
            setHighlightedIndex((current) => Math.min(current + 1, filteredOptions.length - 1));
          }

          if (event.key === "ArrowUp") {
            event.preventDefault();
            setHighlightedIndex((current) => Math.max(current - 1, 0));
          }

          if (event.key === "Enter" && open && filteredOptions[highlightedIndex]) {
            event.preventDefault();
            commitValue(filteredOptions[highlightedIndex].value);
          }

          if (event.key === "Escape") {
            setOpen(false);
          }
        }}
        autoComplete="off"
        spellCheck={false}
      />
      <button
        type="button"
        style={S.toggle}
        aria-label="Show unit suggestions"
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => setOpen((current) => !current)}
      >
        <ChevronDown size={14} strokeWidth={2.2} />
      </button>

      {open && filteredOptions.length > 0 && (
        <div style={S.menu} role="listbox">
          {filteredOptions.slice(0, 8).map((option, index) => (
            <button
              key={option.value}
              type="button"
              role="option"
              aria-selected={highlightedIndex === index}
              style={{
                ...S.option,
                ...(highlightedIndex === index ? S.optionActive : {}),
              }}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => commitValue(option.value)}
            >
              <span>{option.label}</span>
              {option.aliases.length > 0 ? (
                <span style={S.optionMeta}>{option.aliases[0]}</span>
              ) : null}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

const S: Record<string, React.CSSProperties> = {
  wrap: {
    position: "relative",
    width: "100%",
  },
  input: {
    border: "1.5px solid rgb(var(--warm-200))",
    borderRadius: 10,
    padding: "11px 36px 11px 14px",
    fontSize: 14,
    color: "rgb(var(--warm-900))",
    background: "white",
    outline: "none",
    width: "100%",
    boxSizing: "border-box",
  },
  toggle: {
    position: "absolute",
    top: "50%",
    right: 10,
    transform: "translateY(-50%)",
    border: "none",
    background: "transparent",
    color: "rgb(var(--warm-400))",
    cursor: "pointer",
    padding: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  menu: {
    position: "absolute",
    top: "calc(100% + 6px)",
    left: 0,
    right: 0,
    background: "white",
    border: "1px solid rgb(var(--warm-200))",
    borderRadius: 12,
    boxShadow: "0 14px 34px rgba(53, 49, 46, 0.12)",
    padding: 6,
    zIndex: 20,
    display: "flex",
    flexDirection: "column",
    gap: 2,
  },
  option: {
    border: "none",
    background: "transparent",
    borderRadius: 8,
    padding: "9px 10px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    color: "rgb(var(--warm-800))",
    cursor: "pointer",
    textAlign: "left",
    fontSize: 13,
  },
  optionActive: {
    background: "rgb(var(--terra-50))",
    color: "rgb(var(--terra-700))",
  },
  optionMeta: {
    fontSize: 11,
    color: "rgb(var(--warm-500))",
    textTransform: "lowercase",
  },
};
