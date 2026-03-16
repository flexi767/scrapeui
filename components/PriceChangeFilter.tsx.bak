'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';

interface Props {
  min: number;
  max: number;
}

export default function PriceChangeFilter({ min: rawMin, max: rawMax }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const min = rawMin === rawMax ? rawMin - 10 : rawMin;
  const max = rawMin === rawMax ? rawMax + 10 : rawMax;

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

  const active = low !== min || high !== max;
  const range = max - min;
  const lowPct = ((low - min) / range) * 100;
  const highPct = ((high - min) / range) * 100;
  const fmt = (v: number) => v > 0 ? `+${v}` : String(v);

  return (
    <>
      <style>{`
        .pc-thumb {
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
        .pc-thumb::-webkit-slider-thumb {
          -webkit-appearance: none;
          pointer-events: all;
          width: 2px;
          height: 12px;
          background: #60a5fa;
          cursor: ew-resize;
          border-radius: 0;
        }
        .pc-thumb::-moz-range-thumb {
          pointer-events: all;
          width: 2px;
          height: 12px;
          background: #60a5fa;
          cursor: ew-resize;
          border-radius: 0;
          border: none;
        }
        .pc-thumb::-webkit-slider-runnable-track { background: transparent; }
        .pc-thumb::-moz-range-track { background: transparent; }
      `}</style>
      <div className={`flex h-8 items-center gap-1.5 rounded border px-2 text-xs transition-colors ${active ? 'border-blue-500 bg-blue-500/10' : 'border-gray-600 bg-gray-800 hover:border-gray-400'}`}>
        <span className="text-gray-500 text-[11px]">Δ</span>
        <span className="w-9 text-right text-gray-300 tabular-nums">{fmt(low)}</span>

        {/* Single track with two overlaid inputs */}
        <div className="relative flex-shrink-0" style={{ width: 80, height: 12 }}>
          {/* Track background */}
          <div className="absolute top-1/2 -translate-y-1/2 rounded" style={{ left: 1, right: 1, height: 2, background: '#4b5563' }}>
            {/* Active fill */}
            <div className="absolute h-full rounded bg-blue-500"
              style={{ left: `${lowPct}%`, right: `${100 - highPct}%` }} />
          </div>
          {/* Low handle */}
          <input type="range" min={min} max={max} step={1} value={low}
            onChange={e => { const v = Math.min(Number(e.target.value), high - 1); setLow(v); push(v, high); }}
            className="pc-thumb"
            style={{ zIndex: lowPct > 90 ? 5 : 3 }}
          />
          {/* High handle */}
          <input type="range" min={min} max={max} step={1} value={high}
            onChange={e => { const v = Math.max(Number(e.target.value), low + 1); setHigh(v); push(low, v); }}
            className="pc-thumb"
            style={{ zIndex: 4 }}
          />
        </div>

        <span className="w-9 text-gray-300 tabular-nums">{fmt(high)}</span>
        {active && (
          <button onClick={() => { setLow(min); setHigh(max); push(min, max); }} className="text-gray-500 hover:text-white leading-none">✕</button>
        )}
      </div>
    </>
  );
}
