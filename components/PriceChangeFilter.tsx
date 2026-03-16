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
  const fmt = (v: number) => v > 0 ? `+${v}` : String(v);

  return (
    <>
      <style>{`
        .pc-range {
          -webkit-appearance: none;
          appearance: none;
          width: 80px;
          height: 4px;
          background: transparent;
          outline: none;
          cursor: pointer;
        }
        .pc-range::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 2px;
          height: 12px;
          background: #60a5fa;
          cursor: ew-resize;
          border-radius: 0;
        }
        .pc-range::-moz-range-thumb {
          width: 2px;
          height: 12px;
          background: #60a5fa;
          cursor: ew-resize;
          border-radius: 0;
          border: none;
        }
        .pc-range::-webkit-slider-runnable-track {
          height: 2px;
          background: #4b5563;
          border-radius: 1px;
        }
        .pc-range::-moz-range-track {
          height: 2px;
          background: #4b5563;
          border-radius: 1px;
        }
      `}</style>
      <div className={`flex h-8 items-center gap-1.5 rounded border px-2 text-xs transition-colors ${active ? 'border-blue-500 bg-blue-500/10' : 'border-gray-600 bg-gray-800 hover:border-gray-400'}`}>
        <span className="text-gray-500 text-[11px]">Δ</span>
        <span className="w-9 text-right text-gray-300 tabular-nums">{fmt(low)}</span>
        <input
          type="range" min={min} max={max} step={1} value={low}
          onChange={e => { const v = Math.min(Number(e.target.value), high - 1); setLow(v); push(v, high); }}
          className="pc-range"
        />
        <input
          type="range" min={min} max={max} step={1} value={high}
          onChange={e => { const v = Math.max(Number(e.target.value), low + 1); setHigh(v); push(low, v); }}
          className="pc-range"
        />
        <span className="w-9 text-gray-300 tabular-nums">{fmt(high)}</span>
        {active && (
          <button onClick={() => { setLow(min); setHigh(max); push(min, max); }} className="text-gray-500 hover:text-white leading-none">✕</button>
        )}
      </div>
    </>
  );
}
