'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';

interface Props {
  min: number;
  max: number;
}

export default function PriceChangeFilter({ min, max }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const paramMin = searchParams.get('pc_min');
  const paramMax = searchParams.get('pc_max');

  const [low, setLow] = useState(paramMin !== null ? Number(paramMin) : min);
  const [high, setHigh] = useState(paramMax !== null ? Number(paramMax) : max);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setLow(paramMin !== null ? Number(paramMin) : min);
    setHigh(paramMax !== null ? Number(paramMax) : max);
  }, [paramMin, paramMax, min, max]);

  const push = useCallback((lo: number, hi: number) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      const p = new URLSearchParams(searchParams.toString());
      p.delete('page');
      if (lo === min) p.delete('pc_min'); else p.set('pc_min', String(lo));
      if (hi === max) p.delete('pc_max'); else p.set('pc_max', String(hi));
      router.push(`/?${p.toString()}`);
    }, 300);
  }, [searchParams, router, min, max]);

  const range = max - min || 1;
  const active = low !== min || high !== max;
  const lowPct = ((low - min) / range) * 100;
  const highPct = ((high - min) / range) * 100;
  const fmt = (v: number) => v > 0 ? `+${v}` : String(v);

  return (
    <div className={`flex h-8 items-center gap-1.5 rounded border px-2 text-sm transition-colors ${active ? 'border-blue-500 bg-blue-500/10' : 'border-gray-600 bg-gray-800 hover:border-gray-400'}`}>
      {/* Low value label */}
      <span className="w-10 text-right text-xs text-gray-300 tabular-nums flex-shrink-0">{fmt(low)}</span>

      {/* Track container — fixed width, no overflow */}
      <div className="relative w-24 flex-shrink-0" style={{ height: '20px' }}>
        {/* Background track */}
        <div className="absolute top-1/2 left-0 right-0 h-1 -translate-y-1/2 rounded bg-gray-600">
          <div
            className="absolute h-1 rounded bg-blue-500"
            style={{ left: `${lowPct}%`, right: `${100 - highPct}%` }}
          />
        </div>
        {/* Thumb visuals (pointer-events-none, just decorative) */}
        <div
          className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-blue-400 border-2 border-gray-900 pointer-events-none"
          style={{ left: `${lowPct}%`, zIndex: 6 }}
        />
        <div
          className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-blue-400 border-2 border-gray-900 pointer-events-none"
          style={{ left: `${highPct}%`, zIndex: 6 }}
        />
        {/* Low range input */}
        <input
          type="range" min={min} max={max} step={1} value={low}
          onChange={e => { const v = Math.min(Number(e.target.value), high - 1); setLow(v); push(v, high); }}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          style={{ zIndex: lowPct > 90 ? 5 : 3 }}
        />
        {/* High range input */}
        <input
          type="range" min={min} max={max} step={1} value={high}
          onChange={e => { const v = Math.max(Number(e.target.value), low + 1); setHigh(v); push(low, v); }}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          style={{ zIndex: 4 }}
        />
      </div>

      {/* High value label */}
      <span className="w-10 text-xs text-gray-300 tabular-nums flex-shrink-0">{fmt(high)}</span>

      {active && (
        <button onClick={() => { setLow(min); setHigh(max); push(min, max); }} className="text-gray-500 hover:text-white text-xs leading-none flex-shrink-0">✕</button>
      )}
    </div>
  );
}
