"use client";

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
  /** When true, auto-open the menu on entering edit mode (set only when the
   *  edit was started by clicking the status cell itself). */
  autoOpen: boolean;
  /** Called with the chosen ad_status value. */
  onSelect: (next: string) => void;
}

/**
 * Ad-status cell for the editown table. When the row is being edited it renders
 * a custom dropdown (instead of a native <select>) so it can be opened
 * programmatically — the menu auto-opens only when the row was put into edit
 * mode by clicking the status cell (autoOpen), so editing other fields doesn't
 * pop it open.
 */
export function OwnListingAdStatusCell({
  editing,
  value,
  autoOpen,
  onSelect,
}: OwnListingAdStatusCellProps) {
  if (!editing) {
    return (
      <AdStatusBadge status={value ?? "none"} empty="none" className="text-xs" />
    );
  }

  // Uncontrolled: the menu mounts fresh each time the row enters edit mode, so
  // defaultOpen reads autoOpen once (true only when the status cell was clicked).
  // No effect/state-sync needed.
  return (
    <DropdownMenu defaultOpen={autoOpen}>
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
            onClick={() => onSelect(opt.value)}
          >
            {opt.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
