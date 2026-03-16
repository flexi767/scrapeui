'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';

interface Props {
  min: number;
  max: number;
}

const TRACK_W = 96; // px

export default function PriceChangeFilter({ min: rawMin, max: rawMax }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const min = rawMin === rawMax ? rawMin - 1 : rawMin;
  const max = rawMin === rawMax ? rawMax + 1 : rawMax;

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

  const range = max - min;
  const active = low !== min || high !== max;
  const lowFrac = (low - min) / range;
  const highFrac = (high - min) / range;
  // pixel position of thumb centre within the track
  const THUMB = 6; // radius
  const lowPx = lowFrac * (TRACK_W - THUMB * 2) + THUMB;
  const highPx = highFrac * (TRACK_W - THUMB * 2) + THUMB;
  const fmt = (v: number) => v > 0 ? `+${v}` : String(v);

  return (
    <div className={`flex h-8 items-center gap-2 rounded border px-2 text-sm flex-shrink-0 transition-colors ${active ? 'border-blue-500 bg-blue-500/10' : 'border-gray-600 bg-gray-800 hover:border-gray-400'}`}>
      <span className="w-10 text-right text-xs text-gray-300 tabular-nums">{fmt(low)}</span>

      <div className="relative flex-shrink-0" style={{ width: TRACK_W, height: 20 }}>
        {/* Track */}
        <div
          className="absolute top-1/2 -translate-y-1/2 rounded bg-gray-600"
          style={{ left: THUMB, right: THUMB, height: 2 }}
        >
          <div
            className="absolute h-full rounded bg-blue-500"
            style={{
              left: `${lowFrac * 100}%`,
              right: `${(1 - highFrac) * 100}%`,
            }}
          />
        </div>

        {/* Low thumb */}
        <div
          className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 rounded-full bg-blue-400 border-2 border-gray-900 pointer-events-none"
          style={{ width: THUMB * 2, height: THUMB * 2, left: lowPx, zIndex: 6 }}
        />
        {/* High thumb */}
        <div
          className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 rounded-full bg-blue-400 border-2 border-gray-900 pointer-events-none"
          style={{ width: THUMB * 2, height: THUMB * 2, left: highPx, zIndex: 6 }}
        />

        {/* Low input */}
        <input
          type="range" min={min} max={max} step={1} value={low}
          onChange={e => { const v = Math.min(Number(e.target.value), high - 1); setLow(v); push(v, high); }}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          style={{ zIndex: lowFrac > 0.9 ? 5 : 3 }}
        />
        {/* High input */}
        <input
          type="range" min={min} max={max} step={1} value={high}
          onChange={e => { const v = Math.max(Number(e.target.value), low + 1); setHigh(v); push(low, v); }}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          style={{ zIndex: 4 }}
        />
      </div>

      <span className="w-10 text-xs text-gray-300 tabular-nums">{fmt(high)}</span>
      {active && (
        <button onClick={() => { setLow(min); setHigh(max); push(min, max); }} className="text-gray-500 hover:text-white text-xs">✕</button>
      )}
    </div>
  );
}
