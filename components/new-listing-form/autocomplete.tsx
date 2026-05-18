"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { formatCount } from "@/lib/utils";

export interface AutocompleteOption {
  value: string;
  count?: number | null;
}

export function normalizeAutocompleteValue(value: string) {
  return value.trim().toLowerCase();
}

export function sortMakeOptions(options: AutocompleteOption[]) {
  return [...options].sort((a, b) => {
    const aHasCount = a.count != null ? 1 : 0;
    const bHasCount = b.count != null ? 1 : 0;
    if (aHasCount !== bHasCount) return bHasCount - aHasCount;
    if (aHasCount && bHasCount && (a.count ?? 0) !== (b.count ?? 0)) {
      return (b.count ?? 0) - (a.count ?? 0);
    }
    return a.value.localeCompare(b.value, "bg");
  });
}

function filterAutocompleteOptions(
  options: AutocompleteOption[],
  query: string,
  {
    hideLowCountOnEmpty = false,
  }: {
    hideLowCountOnEmpty?: boolean;
  } = {},
) {
  const normalizedQuery = normalizeAutocompleteValue(query);
  const hasVisibleCounts = options.some((option) => option.count != null);
  const visibleBase =
    !normalizedQuery && hideLowCountOnEmpty && hasVisibleCounts
      ? options.filter((option) => (option.count ?? 0) >= 5)
      : options;

  if (!normalizedQuery) return visibleBase;
  return visibleBase.filter((option) =>
    normalizeAutocompleteValue(option.value).includes(normalizedQuery),
  );
}

export function getSelectedOptionCount(
  options: AutocompleteOption[],
  value: string,
): number | null {
  const normalizedValue = normalizeAutocompleteValue(value);
  if (!normalizedValue) return null;
  const match = options.find(
    (option) => normalizeAutocompleteValue(option.value) === normalizedValue,
  );
  return match?.count ?? null;
}

export function AutocompleteInput({
  value,
  onChange,
  options,
  placeholder,
  emptyLabel,
  hideLowCountOnEmpty = false,
  open,
  focusWhenOpen = false,
  trailingText,
  onArrowLeft,
  onOpenChange,
}: {
  value: string;
  onChange: (value: string) => void;
  options: AutocompleteOption[];
  placeholder?: string;
  emptyLabel: string;
  hideLowCountOnEmpty?: boolean;
  open: boolean;
  focusWhenOpen?: boolean;
  trailingText?: string | null;
  onArrowLeft?: () => void;
  onOpenChange: (open: boolean) => void;
}) {
  const [isTyping, setIsTyping] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const shouldSelectAllOnFocusRef = useRef(false);
  const openRef = useRef(open);

  useEffect(() => {
    openRef.current = open;
  }, [open]);

  useEffect(() => {
    if (!open || !focusWhenOpen) return;
    window.requestAnimationFrame(() => {
      if (inputRef.current && document.activeElement !== inputRef.current) {
        inputRef.current.focus();
      }
    });
  }, [focusWhenOpen, open]);

  const visibleOptions = useMemo(
    () =>
      filterAutocompleteOptions(options, isTyping ? value : "", {
        hideLowCountOnEmpty,
      }),
    [hideLowCountOnEmpty, isTyping, options, value],
  );

  function selectOption(option: AutocompleteOption) {
    onChange(option.value);
    setIsTyping(false);
    onOpenChange(false);
    inputRef.current?.blur();
  }

  const selectedIndex =
    visibleOptions.length > 0
      ? Math.min(highlightedIndex, visibleOptions.length - 1)
      : 0;

  return (
    <div className="relative">
      <input
        ref={inputRef}
        value={value}
        onKeyDown={(event) => {
          if (event.key === "ArrowLeft" && onArrowLeft) {
            event.preventDefault();
            onArrowLeft();
            return;
          }

          if (event.key === "ArrowDown") {
            event.preventDefault();
            if (!open) onOpenChange(true);
            if (visibleOptions.length > 0) {
              setHighlightedIndex((current) =>
                current >= visibleOptions.length - 1 ? 0 : current + 1,
              );
            }
            return;
          }

          if (event.key === "ArrowUp") {
            event.preventDefault();
            if (!open) onOpenChange(true);
            if (visibleOptions.length > 0) {
              setHighlightedIndex((current) =>
                current <= 0 ? visibleOptions.length - 1 : current - 1,
              );
            }
            return;
          }

          if (event.key === "Escape" && open) {
            event.preventDefault();
            onOpenChange(false);
            return;
          }

          if (event.key !== "Enter") return;
          if (!open || visibleOptions.length === 0) return;
          event.preventDefault();
          selectOption(visibleOptions[selectedIndex] ?? visibleOptions[0]);
        }}
        onChange={(event) => {
          onChange(event.target.value);
          setIsTyping(true);
          setHighlightedIndex(0);
          shouldSelectAllOnFocusRef.current = false;
          onOpenChange(true);
        }}
        onFocus={() => {
          setIsTyping(false);
          setHighlightedIndex(0);
          shouldSelectAllOnFocusRef.current = true;
          onOpenChange(true);
          window.requestAnimationFrame(() => {
            if (
              shouldSelectAllOnFocusRef.current &&
              inputRef.current &&
              document.activeElement === inputRef.current
            ) {
              inputRef.current.select();
            }
          });
        }}
        onBlur={() => {
          shouldSelectAllOnFocusRef.current = false;
          window.setTimeout(() => {
            if (openRef.current) onOpenChange(false);
          }, 120);
        }}
        placeholder={placeholder}
        className="h-10 w-full rounded border border-gray-700 bg-gray-900 px-3 py-2 pr-14 text-sm text-white focus:border-sky-500 focus:outline-none"
      />
      {trailingText ? (
        <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-500">
          {trailingText}
        </div>
      ) : null}
      {open ? (
        <div className="saved-search-autocomplete-scroll absolute left-0 right-0 top-[calc(100%+0.35rem)] z-30 max-h-64 overflow-y-scroll overscroll-contain rounded-md border border-gray-700 bg-gray-900 shadow-xl [scrollbar-gutter:stable]">
          {visibleOptions.length === 0 ? (
            <div className="px-3 py-2 text-xs text-gray-500">{emptyLabel}</div>
          ) : (
            visibleOptions.map((option, index) => (
              <button
                key={option.value}
                type="button"
                onMouseEnter={() => setHighlightedIndex(index)}
                onMouseDown={(event) => {
                  event.preventDefault();
                  selectOption(option);
                }}
                className={`flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm text-gray-200 ${
                  selectedIndex === index ? "bg-gray-800" : "hover:bg-gray-800"
                }`}
              >
                <span>{option.value}</span>
                {option.count != null && (
                  <span className="text-xs text-gray-500">
                    {formatCount(option.count)}
                  </span>
                )}
              </button>
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}
