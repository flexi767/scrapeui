'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useRef, useState, useEffect } from 'react';

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
    }, 400);
  }, [searchParams, router, min, max]);

  const active = low !== min || high !== max;
  const fmt = (v: number) => v > 0 ? `+${v}` : String(v);

  return (
    <div className={`flex h-8 items-center gap-1 rounded border px-2 text-xs transition-colors ${active ? 'border-blue-500 bg-blue-500/10' : 'border-gray-600 bg-gray-800 hover:border-gray-400'}`}>
      <span className="text-gray-500">Δ</span>
      <input
        type="number"
        value={low}
        min={min}
        max={high}
        onChange={e => { const v = Number(e.target.value); setLow(v); push(v, high); }}
        className="w-14 bg-transparent text-center text-gray-300 tabular-nums outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
        placeholder={fmt(min)}
      />
      <span className="text-gray-600">—</span>
      <input
        type="number"
        value={high}
        min={low}
        max={max}
        onChange={e => { const v = Number(e.target.value); setHigh(v); push(low, v); }}
        className="w-14 bg-transparent text-center text-gray-300 tabular-nums outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
        placeholder={fmt(max)}
      />
      {active && (
        <button onClick={() => { setLow(min); setHigh(max); push(min, max); }} className="ml-0.5 text-gray-500 hover:text-white leading-none">✕</button>
      )}
    </div>
  );
}
