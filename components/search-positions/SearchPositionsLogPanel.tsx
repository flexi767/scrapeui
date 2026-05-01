import type { Ref } from 'react';
import type { SearchPositionLogEntry } from '@/components/search-positions/types';

interface SearchPositionsLogPanelProps {
  logs: SearchPositionLogEntry[];
  logRef: Ref<HTMLDivElement>;
}

export function SearchPositionsLogPanel({ logs, logRef }: SearchPositionsLogPanelProps) {
  if (logs.length === 0) return null;

  return (
    <div
      ref={logRef}
      className="max-h-[600px] space-y-1 overflow-y-auto rounded-lg border border-gray-700 bg-gray-900 p-3"
    >
      {logs.map((entry, index) => (
        <div
          key={`${index}-${entry.message}`}
          className={
            entry.kind === 'error'
              ? 'py-0.5 font-mono text-xs text-red-400'
              : entry.kind === 'result'
                ? `py-0.5 font-mono text-xs ${entry.found ? 'text-emerald-300' : 'text-amber-300'}`
                : entry.kind === 'status'
                  ? 'py-0.5 font-mono text-xs text-sky-300'
                  : 'py-0.5 font-mono text-xs text-gray-400'
          }
        >
          {entry.kind === 'error' ? '❌ ' : entry.kind === 'result' ? (entry.found ? '✓ ' : '• ') : ''}
          {entry.message}
        </div>
      ))}
    </div>
  );
}
