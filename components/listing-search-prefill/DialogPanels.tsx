import type { SearchPrefillResponse } from './types';
import { formatCount } from '@/lib/utils';

export function LoadingPanel({ label }: { label: string }) {
  return (
    <div className="rounded-lg border border-slate-500/70 bg-slate-800/80 px-4 py-8 text-center text-sm text-slate-100/85">
      <div className="flex items-center justify-center gap-3">
        <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-slate-500 border-t-sky-300" />
        <span>{label}</span>
      </div>
    </div>
  );
}

export function ErrorPanel({ message }: { message: string }) {
  if (!message) return null;

  return (
    <div className="rounded-lg border border-red-700/40 bg-red-950/40 px-4 py-3 text-sm text-red-200">
      {message}
    </div>
  );
}

export function ListingSummaryPanel({ data }: { data: SearchPrefillResponse }) {
  return (
    <div className="rounded-lg border border-slate-500/70 bg-slate-800/85 px-4 py-3 text-sm">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <div className="font-medium text-white">
          {[data.listing.make, data.listing.model].filter(Boolean).join(' ') || 'Listing'}
        </div>
        {data.listing.mobile_id && (
          <div className="rounded-full border border-sky-500/40 bg-sky-950/40 px-2 py-0.5 text-[11px] font-medium text-sky-200">
            {data.listing.mobile_id}
          </div>
        )}
        {data.listing.title && (
          <div className="text-xs text-slate-100/75">
            {data.listing.title}
          </div>
        )}
      </div>
      <div className="mt-1 text-xs text-slate-100/75">
        {data.reference.makeCount != null ? `${formatCount(data.reference.makeCount)} listings for make` : 'No make count in reference data'}
        {data.reference.modelCount != null ? ` • ${formatCount(data.reference.modelCount)} for model` : ''}
      </div>
      <div className="mt-1 text-xs text-slate-100/65">
        {data.savedSearch.enabled
          ? `Using saved custom search values${data.savedSearch.updatedAt ? ` • updated ${data.savedSearch.updatedAt}` : ''}`
          : 'Using generated default search values'}
      </div>
    </div>
  );
}

export function MessagesPanel({ messages }: { messages: string[] }) {
  if (messages.length === 0) return null;

  return (
    <div className="rounded-lg border border-amber-700/30 bg-amber-950/30 px-4 py-3 text-sm text-amber-100">
      {messages.map((message, index) => (
        <div key={`${message}-${index}`}>{message}</div>
      ))}
    </div>
  );
}

export function FallbackNotePanel({ message }: { message: string | null | undefined }) {
  if (!message) return null;

  return (
    <div className="rounded-lg border border-amber-700/30 bg-amber-950/30 px-4 py-3 text-sm text-amber-100">
      {message}
    </div>
  );
}
