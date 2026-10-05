"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Searchable picker over the shared Bengaluru locality list. A new value
 * can only be committed by picking from the list, so the CRM and website
 * never drift. A pre-existing value that isn't in the list (legacy free
 * text) is still shown and kept until the admin changes or clears it,
 * with a hint that it isn't on the list.
 */
export function LocalityCombobox({
  value,
  onChange,
  options,
  placeholder = "Search locality…",
  id,
  className,
}: {
  value: string;
  onChange: (next: string) => void;
  options: readonly string[];
  placeholder?: string;
  id?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (q ? options.filter((o) => o.toLowerCase().includes(q)) : [...options]).slice(0, 60);
  }, [options, query]);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  const pick = (name: string) => {
    onChange(name);
    setOpen(false);
    setQuery("");
  };

  const legacy = value !== "" && !options.some((o) => o.toLowerCase() === value.toLowerCase());

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <div className="relative">
        <input
          id={id}
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-controls="locality-listbox"
          aria-autocomplete="list"
          autoComplete="off"
          className="crm-input pr-16"
          placeholder={placeholder}
          value={open ? query : value}
          onFocus={() => {
            setOpen(true);
            setActive(0);
          }}
          onChange={(e) => {
            setQuery(e.target.value);
            setActive(0);
            setOpen(true);
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setActive((a) => Math.min(a + 1, filtered.length - 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive((a) => Math.max(a - 1, 0));
            } else if (e.key === "Enter") {
              e.preventDefault();
              if (open && filtered[active]) pick(filtered[active]);
            } else if (e.key === "Escape") {
              setOpen(false);
              setQuery("");
            }
          }}
        />
        <div className="absolute inset-y-0 right-2 flex items-center gap-1 text-crm-text-muted">
          {value && (
            <button type="button" aria-label="Clear locality" onClick={() => pick("")} className="p-1 hover:text-crm-text">
              <X size={13} />
            </button>
          )}
          <ChevronDown size={14} aria-hidden="true" />
        </div>
      </div>

      {open && (
        <ul
          id="locality-listbox"
          role="listbox"
          className="absolute z-30 mt-1 max-h-60 w-full overflow-y-auto rounded-sm border border-crm-border bg-crm-card py-1 shadow-xl"
        >
          {filtered.length === 0 ? (
            <li className="px-3 py-2 text-sm text-crm-text-muted">
              No match. Add new areas from Localities in the sidebar.
            </li>
          ) : (
            filtered.map((name, i) => (
              <li
                key={name}
                role="option"
                aria-selected={name === value}
                onMouseDown={(e) => {
                  e.preventDefault();
                  pick(name);
                }}
                onMouseEnter={() => setActive(i)}
                className={cn(
                  "cursor-pointer px-3 py-2 text-sm text-crm-text",
                  i === active && "bg-crm-gold/15",
                  name === value && "font-semibold"
                )}
              >
                {name}
              </li>
            ))
          )}
        </ul>
      )}

      {legacy && !open && (
        <p className="mt-1 text-[12px] text-amber-500">Not on the locality list — kept as entered. Pick one to standardise.</p>
      )}
    </div>
  );
}
