import type { RefObject } from 'react';
import { tailRenderWindow } from '@/components/shared/render-window';
import type { LogEntry } from './types';

export function LogPanel({
  entries,
  panelRef,
  keyPrefix = 'log',
}: {
  entries: LogEntry[];
  panelRef: RefObject<HTMLDivElement | null>;
  keyPrefix?: string;
}) {
  const visibleEntries = tailRenderWindow(entries);

  return (
    <div
      ref={panelRef}
      className="rounded-lg border border-gray-700 bg-gray-900 p-3 space-y-1 max-h-[420px] overflow-y-auto"
    >
      {visibleEntries.hiddenCount > 0 && (
        <div className="text-xs py-0.5 font-mono text-gray-500">
          {visibleEntries.hiddenCount} older entries hidden
        </div>
      )}
      {visibleEntries.items.map((entry, index) => (
        <div
          key={`${keyPrefix}-${visibleEntries.startIndex + index}-${entry.message}`}
          className={
            entry.kind === 'error'
              ? 'text-xs py-0.5 font-mono text-red-400'
              : entry.kind === 'result'
              ? `text-xs py-0.5 font-mono ${entry.ok ? 'text-emerald-300' : 'text-red-300'}`
              : entry.kind === 'status'
              ? 'text-xs py-0.5 font-mono text-sky-300'
              : 'text-xs py-0.5 font-mono text-gray-400'
          }
        >
          {entry.kind === 'error' ? '❌ ' : entry.kind === 'result' ? (entry.ok ? '✓ ' : '✕ ') : ''}
          {entry.message}
        </div>
      ))}
    </div>
  );
}
