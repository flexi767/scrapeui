"use client";

import { useEffect, useState } from "react";
import { AdStatusBadge } from "@/components/listings/AdStatusBadge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { stopEditorPointerPropagation } from "./TableControls";

const AD_STATUS_OPTIONS = [
  { value: "none", label: "—" },
  { value: "TOP", label: "TOP" },
  { value: "VIP", label: "VIP" },
] as const;

interface OwnListingAdStatusCellProps {
  editing: boolean;
  value: string;
  /** Called with the chosen ad_status value. */
  onSelect: (next: string) => void;
}

/**
 * Ad-status cell for the editown table. When the row is being edited it renders
 * a custom dropdown (instead of a native <select>) so it can be opened
 * programmatically — the menu auto-opens the moment the row enters edit mode,
 * letting the user set TOP/VIP straight after clicking the line.
 */
export function OwnListingAdStatusCell({
  editing,
  value,
  onSelect,
}: OwnListingAdStatusCellProps) {
  const [open, setOpen] = useState(false);

  // Auto-open on entering edit mode; force-close when editing ends.
  useEffect(() => {
    setOpen(editing);
  }, [editing]);

  if (!editing) {
    return (
      <AdStatusBadge status={value ?? "none"} empty="none" className="text-xs" />
    );
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger
        onClick={stopEditorPointerPropagation}
        onMouseDown={stopEditorPointerPropagation}
        onPointerDown={stopEditorPointerPropagation}
        className="inline-flex h-8 min-w-12 items-center justify-center rounded border border-gray-500 bg-gray-700 px-2 text-sm text-white outline-none focus-visible:border-gray-300"
      >
        {value && value !== "none" ? value : "—"}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-20">
        {AD_STATUS_OPTIONS.map((opt) => (
          <DropdownMenuItem
            key={opt.value}
            onClick={() => {
              onSelect(opt.value);
              setOpen(false);
            }}
          >
            {opt.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
