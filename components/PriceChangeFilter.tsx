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

  return (
    <div className={`flex items-center gap-2 rounded border px-3 h-8 text-sm transition-colors ${active ? 'border-blue-500 bg-blue-500/10' : 'border-gray-600 bg-gray-800'}`}>
      <span className="text-gray-400 text-xs whitespace-nowrap">Δ Price</span>
      <span className="text-xs text-gray-300 w-12 text-right">{low > 0 ? `+${low}` : low}</span>
      <div className="relative w-28 h-4 flex items-center">
        {/* Track */}
        <div className="absolute inset-x-0 h-1 rounded bg-gray-600">
          <div
            className="absolute h-1 rounded bg-blue-500"
            style={{
              left: `${((low - min) / range) * 100}%`,
              right: `${((max - high) / range) * 100}%`,
            }}
          />
        </div>
        {/* Low handle */}
        <input
          type="range"
          min={min}
          max={max}
          value={low}
          onChange={e => {
            const v = Math.min(Number(e.target.value), high);
            setLow(v);
            push(v, high);
          }}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          style={{ zIndex: low > min + (range * 0.9) ? 5 : 3 }}
        />
        {/* High handle */}
        <input
          type="range"
          min={min}
          max={max}
          value={high}
          onChange={e => {
            const v = Math.max(Number(e.target.value), low);
            setHigh(v);
            push(low, v);
          }}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          style={{ zIndex: 4 }}
        />
        {/* Thumb visuals */}
        <div
          className="absolute w-3 h-3 rounded-full bg-blue-400 border-2 border-gray-900 pointer-events-none"
          style={{ left: `calc(${((low - min) / range) * 100}% - 6px)`, zIndex: 6 }}
        />
        <div
          className="absolute w-3 h-3 rounded-full bg-blue-400 border-2 border-gray-900 pointer-events-none"
          style={{ left: `calc(${((high - min) / range) * 100}% - 6px)`, zIndex: 6 }}
        />
      </div>
      <span className="text-xs text-gray-300 w-12">{high > 0 ? `+${high}` : high}</span>
      {active && (
        <button
          onClick={() => { setLow(min); setHigh(max); push(min, max); }}
          className="text-gray-500 hover:text-white text-xs"
          title="Reset"
        >✕</button>
      )}
    </div>
  );
}
