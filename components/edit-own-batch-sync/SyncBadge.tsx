'use client';

import { useTranslations } from 'next-intl';

export function SyncBadge({ status, error }: { status: string | null; error: string | null }) {
  const t = useTranslations('ui');

  if (status === 'running') {
    return <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] text-amber-200">{t('running')}</span>;
  }
  if (status === 'success') {
    return <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] text-emerald-200">{t('success')}</span>;
  }
  if (status === 'failed') {
    return (
      <span
        className="rounded-full bg-red-500/15 px-2 py-0.5 text-[11px] text-red-200"
        title={error || t('sync_failed')}
      >
        {t('failed')}
      </span>
    );
  }
  if (status === 'pending') {
    return <span className="rounded-full bg-blue-500/15 px-2 py-0.5 text-[11px] text-blue-200">{t('pending')}</span>;
  }
  return <span className="rounded-full bg-gray-700 px-2 py-0.5 text-[11px] text-gray-400">{t('idle')}</span>;
}
