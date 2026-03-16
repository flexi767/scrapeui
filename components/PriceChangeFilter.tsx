'use client';

import RangeFilter from './RangeFilter';

interface Props { min: number; max: number; }

const fmt = (v: number) => v > 0 ? `+${v}` : String(v);

export default function PriceChangeFilter({ min, max }: Props) {
  return <RangeFilter min={min} max={max} paramLow="pc_min" paramHigh="pc_max" label="Δ" fmt={fmt} />;
}
