'use client';

import { useEffect, useRef, useState } from 'react';

export interface MultiSelectOption {
  value: string;
  label: string;
  badge?: string;
}

interface MultiSelectDropdownProps {
  buttonText: string;
  clearLabel: string;
  options: MultiSelectOption[];
  selectedValues: string[];
  onToggle: (value: string) => void;
  onClear: () => void;
  active?: boolean;
  showClear?: boolean;
  minWidthClassName?: string;
}

export default function MultiSelectDropdown({
  buttonText,
  clearLabel,
  options,
  selectedValues,
  onToggle,
  onClear,
  active: activeOverride,
  showClear,
  minWidthClassName = 'min-w-[160px]',
}: MultiSelectDropdownProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const active = activeOverride ?? selectedValues.length > 0;
  const canClear = showClear ?? selectedValues.length > 0;

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  function clearSelection() {
    onClear();
    setOpen(false);
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className={`flex h-8 items-center gap-1.5 rounded border px-3 text-sm text-white transition-colors ${
          active
            ? 'border-blue-500 bg-blue-500/10'
            : 'border-gray-600 bg-gray-800 hover:border-gray-400'
        }`}
      >
        {buttonText}
        <span className="text-gray-400">{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div className={`absolute left-0 top-9 z-30 ${minWidthClassName} rounded border border-gray-600 bg-gray-800 py-1 shadow-lg`}>
          {options.map((option) => (
            <label key={option.value} className="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-sm text-gray-200 hover:bg-gray-700">
              <input
                type="checkbox"
                checked={selectedValues.includes(option.value)}
                onChange={() => onToggle(option.value)}
                className="accent-blue-500"
              />
              <span>{option.label}</span>
              {option.badge && (
                <span className="ml-auto rounded-full bg-emerald-700 px-1.5 text-[10px] text-emerald-100">
                  {option.badge}
                </span>
              )}
            </label>
          ))}
          {canClear && (
            <button
              type="button"
              onClick={clearSelection}
              className="w-full px-3 py-1.5 text-left text-xs text-gray-400 hover:text-white"
            >
              {clearLabel}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
