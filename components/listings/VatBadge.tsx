'use client';

import { useTranslations } from 'next-intl';

export function VatBadge({
  vat,
}: {
  vat: string | null | undefined;
}) {
  const t = useTranslations('ui');
  if (vat === "included") {
    return (
      <span className="rounded-full bg-blue-900/70 px-2 py-0.5 text-[11px] text-blue-200">
        {t('vat_included')}
      </span>
    );
  }
  if (vat === "exempt") {
    return (
      <span className="rounded-full bg-green-900/70 px-2 py-0.5 text-[11px] text-green-200">
        {t('vat_exempt')}
      </span>
    );
  }
  if (vat === "excluded") {
    return (
      <span className="rounded-full bg-red-900/70 px-2 py-0.5 text-[11px] text-red-200">
        {t('vat_excluded')}
      </span>
    );
  }
  return <span className="text-gray-600">—</span>;
}

export function KaparoBadge({
  kaparo,
  label = "К",
  empty = "dash",
}: {
  kaparo: boolean | number | null | undefined;
  label?: string;
  empty?: "dash" | "none";
}) {
  if (!kaparo) {
    return empty === "dash" ? <span className="text-gray-600">—</span> : null;
  }
  return (
    <span className="rounded-full bg-orange-900/70 px-2 py-0.5 text-[11px] text-orange-200">
      {label}
    </span>
  );
}
