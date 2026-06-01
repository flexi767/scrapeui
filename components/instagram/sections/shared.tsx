import { ZoomInIcon } from "lucide-react";

export type ZoomImage = { src: string; alt: string; label: string };

export function StepHeader({
  step,
  title,
  detail,
}: {
  step: string;
  title: string;
  detail?: string;
}) {
  return (
    <div>
      <div className="text-xs font-semibold uppercase tracking-wide text-pink-300">{step}</div>
      <h2 className="mt-1 text-sm font-semibold text-white">{title}</h2>
      {detail ? <p className="mt-1 text-xs text-gray-500">{detail}</p> : null}
    </div>
  );
}

/**
 * Passive zoom affordance shown in the top-right of an image card. The card
 * itself is the clickable element; this badge only appears on hover/focus.
 */
export function ZoomBadge() {
  return (
    <span className="absolute right-2 top-2 inline-flex h-7 w-7 items-center justify-center rounded-full bg-black/65 text-white opacity-0 transition group-hover:opacity-100 group-focus:opacity-100">
      <ZoomInIcon className="h-3.5 w-3.5" />
    </span>
  );
}
