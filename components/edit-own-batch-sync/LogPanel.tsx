import type { RefObject } from 'react';
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
  return (
    <div
      ref={panelRef}
      className="rounded-lg border border-gray-700 bg-gray-900 p-3 space-y-1 max-h-[420px] overflow-y-auto"
    >
      {entries.map((entry, index) => (
        <div
          key={`${keyPrefix}-${index}-${entry.message}`}
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
