'use client';

import { useTranslations } from 'next-intl';
import { SortHeader } from './TableControls';

export function OwnListingsTableHeader() {
  const t = useTranslations('ui');
  return (
    <thead>
      <tr className="border-b border-gray-700 bg-gray-800/60 text-xs font-medium uppercase tracking-wider text-gray-400">
        <th className="w-16 px-3 py-1.5 text-left">{t('img')}</th>
        <th className="px-3 py-1.5 text-left">{t('make_model')}</th>
        <th className="px-3 py-1.5 text-left">{t('title')}</th>
        <th className="px-3 py-1.5 text-left">
          <SortHeader label={t('dealer')} sortKey="dealer" />
        </th>
        <th className="px-2 py-1.5 text-center w-14">
          <SortHeader label={t('paid')} sortKey="ad_status" align="center" />
        </th>
        <th className="pl-1 pr-3 py-1.5 text-right">
          <SortHeader label={t('price')} sortKey="price" align="right" />
        </th>
        <th className="px-3 py-1.5 text-center">{t('orig_num')}</th>
        <th className="px-3 py-1.5 text-center">{t('price_num')}</th>
        <th className="px-3 py-1.5 text-center">{t('vat')}</th>
        <th className="px-2 py-1.5 text-center w-14">К</th>
        <th className="px-3 py-1.5 text-right">W</th>
        <th className="px-3 py-1.5 text-right">
          <SortHeader label={t('views')} sortKey="views" align="right" />
        </th>
        <th className="px-3 py-1.5 text-right">
          <SortHeader label={t('last_edit')} sortKey="last_edit" align="right" />
        </th>
        <th className="px-3 py-1.5 text-right">
          <SortHeader
            label={t('carsbg_created')}
            sortKey="carsbg_created_date"
            align="right"
          />
        </th>
        <th className="px-2 py-1.5 text-center w-12">{t('new')}</th>
        <th className="px-3 py-1.5 text-right">
          <SortHeader label={t('year')} sortKey="reg_year" align="right" />
        </th>
        <th className="px-3 py-1.5 text-center">{t('body_type')}</th>
        <th className="px-3 py-1.5 text-center">
          <SortHeader label={t('fuel')} sortKey="fuel" align="center" />
        </th>
        <th className="px-3 py-1.5 text-right">
          <SortHeader label={t('km')} sortKey="mileage" align="right" />
        </th>
      </tr>
    </thead>
  );
}
