'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useRef, useState } from 'react';

interface Props {
  min: number;
  max: number;
  paramLow: string;   // URL param name for lower bound
  paramHigh: string;  // URL param name for upper bound
  label?: string;     // short label shown before the slider
  fmt?: (v: number) => string;
  basePath?: string;
}

export default function RangeFilter({ min: rawMin, max: rawMax, paramLow, paramHigh, label, fmt, basePath = '/listings' }: Props) {
  const searchParams = useSearchParams();

  const min = rawMin === rawMax ? rawMin - 10 : rawMin;
  const max = rawMin === rawMax ? rawMax + 10 : rawMax;

  const pLow = searchParams.get(paramLow);
  const pHigh = searchParams.get(paramHigh);
  const initialLow = pLow !== null ? Number(pLow) : min;
  const initialHigh = pHigh !== null ? Number(pHigh) : max;
  const resetKey = `${paramLow}:${paramHigh}:${min}:${max}:${pLow ?? ''}:${pHigh ?? ''}`;

  return (
    <RangeFilterInner
      key={resetKey}
      min={min}
      max={max}
      initialLow={initialLow}
      initialHigh={initialHigh}
      paramLow={paramLow}
      paramHigh={paramHigh}
      label={label}
      fmt={fmt}
      searchParamsString={searchParams.toString()}
      basePath={basePath}
    />
  );
}

interface InnerProps {
  min: number;
  max: number;
  initialLow: number;
  initialHigh: number;
  paramLow: string;
  paramHigh: string;
  label?: string;
  fmt?: (v: number) => string;
  searchParamsString: string;
  basePath: string;
}

function RangeFilterInner({ min, max, initialLow, initialHigh, paramLow, paramHigh, label, fmt, searchParamsString, basePath }: InnerProps) {
  const router = useRouter();
  const [low, setLow] = useState(initialLow);
  const [high, setHigh] = useState(initialHigh);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const push = useCallback((lo: number, hi: number) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      const p = new URLSearchParams(searchParamsString);
      p.delete('page');
      if (lo === min) p.delete(paramLow); else p.set(paramLow, String(lo));
      if (hi === max) p.delete(paramHigh); else p.set(paramHigh, String(hi));
      router.push(`${basePath}?${p.toString()}`);
    }, 300);
  }, [searchParamsString, router, min, max, paramLow, paramHigh, basePath]);

  const active = low !== min || high !== max;
  const range = max - min;
  const lowPct = ((low - min) / range) * 100;
  const highPct = ((high - min) / range) * 100;
  const display = fmt ?? ((v: number) => String(v));

  return (
    <>
      <style>{`
        .rf-thumb {
          -webkit-appearance: none;
          appearance: none;
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          background: transparent;
          pointer-events: none;
          outline: none;
        }
        .rf-thumb::-webkit-slider-thumb {
          -webkit-appearance: none;
          pointer-events: all;
          width: 2px;
          height: 12px;
          background: #60a5fa;
          cursor: ew-resize;
          border-radius: 0;
        }
        .rf-thumb::-moz-range-thumb {
          pointer-events: all;
          width: 2px;
          height: 12px;
          background: #60a5fa;
          cursor: ew-resize;
          border-radius: 0;
          border: none;
        }
        .rf-thumb::-webkit-slider-runnable-track { background: transparent; }
        .rf-thumb::-moz-range-track { background: transparent; }
      `}</style>
      <div className={`flex h-8 items-center gap-1.5 rounded border px-2 text-xs transition-colors ${active ? 'border-blue-500 bg-blue-500/10' : 'border-gray-600 bg-gray-800 hover:border-gray-400'}`}>
        {label && <span className="text-gray-500 text-[11px]">{label}</span>}
        <span className="text-right text-gray-300 tabular-nums">{display(low)}</span>

        <div className="relative flex-shrink-0" style={{ width: 80, height: 12 }}>
          <div className="absolute top-1/2 -translate-y-1/2 rounded" style={{ left: 1, right: 1, height: 2, background: '#4b5563' }}>
            <div className="absolute h-full rounded bg-blue-500"
              style={{ left: `${lowPct}%`, right: `${100 - highPct}%` }} />
          </div>
          <input type="range" min={min} max={max} step={1} value={low}
            onChange={e => { const v = Math.min(Number(e.target.value), high - 1); setLow(v); push(v, high); }}
            className="rf-thumb" style={{ zIndex: lowPct > 90 ? 5 : 3 }}
          />
          <input type="range" min={min} max={max} step={1} value={high}
            onChange={e => { const v = Math.max(Number(e.target.value), low + 1); setHigh(v); push(low, v); }}
            className="rf-thumb" style={{ zIndex: 4 }}
          />
        </div>

        <span className="text-gray-300 tabular-nums">{display(high)}</span>
        {active && (
          <button onClick={() => { setLow(min); setHigh(max); push(min, max); }} className="text-gray-500 hover:text-white leading-none">✕</button>
        )}
      </div>
    </>
  );
}
