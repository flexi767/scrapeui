'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Label } from '@/components/ui/label';
import { formatPrice } from '@/lib/utils';
import { getPriceWithVat } from '@/lib/vat';

interface ListingSummary {
  id: number;
  mobile_id: string;
  make: string;
  model: string;
  current_price: number | null;
  vat: string | null;
}

export function LinkedCarsSelector({
  selected,
  onChange,
}: {
  selected: number[];
  onChange: (ids: number[]) => void;
}) {
  const t = useTranslations('ui');
  const [listings, setListings] = useState<ListingSummary[]>([]);

  useEffect(() => {
    fetch('/api/listings?summaries=1')
      .then((r) => r.json())
      .then(setListings);
  }, []);

  function toggle(id: number) {
    if (selected.includes(id)) onChange(selected.filter((x) => x !== id));
    else onChange([...selected, id]);
  }

  return (
    <div className="space-y-2">
      <Label>{t('linked_cars')}</Label>
      <div className="max-h-48 overflow-y-auto rounded-md border border-gray-600 bg-gray-800 p-2">
        {listings.length === 0 ? (
          <p className="text-sm text-gray-400">{t('no_listings_available')}</p>
        ) : (
          <div className="grid grid-cols-3 gap-1">
            {listings.map((l) => (
              <label
                key={l.id}
                className={`flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-gray-700 ${
                  selected.includes(l.id) ? 'bg-gray-700' : ''
                }`}
              >
                <input
                  type="checkbox"
                  checked={selected.includes(l.id)}
                  onChange={() => toggle(l.id)}
                  className="shrink-0"
                />
                <span className="truncate">
                  {l.make} {l.model}
                </span>
                <span className="ml-auto shrink-0 text-right text-xs text-gray-400">
                  <span className="block">{formatPrice(l.current_price)}</span>
                  {getPriceWithVat(l.current_price, l.vat) != null && (
                    <span className="block text-[10px] text-emerald-300/85">
                      {formatPrice(getPriceWithVat(l.current_price, l.vat))}
                    </span>
                  )}
                </span>
              </label>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
