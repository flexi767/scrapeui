import Link from 'next/link';
import { ListingThumbPreview } from '@/components/ListingThumbPreview';
import ListingSearchPrefillButton from '@/components/ListingSearchPrefillButton';
import { AdStatusBadge } from './AdStatusBadge';
import { ListingPriceCell } from './ListingPriceCell';
import { KaparoBadge, VatBadge } from './VatBadge';
import { getListingThumbAlt, getListingThumbSrc } from '@/lib/listing-thumb';
import { formatDateOnly } from '@/lib/date-format';
import { listingHref } from '@/lib/listing-url';
import { formatCount, formatDate } from '@/lib/utils';
import type { ListingRow } from '@/lib/query-modules/types';

interface Props {
  row: ListingRow;
  currentParams: URLSearchParams;
  statuses: string[];
  basePath: string;
}

export function ListingTableRow({ row, currentParams, statuses, basePath }: Props) {
  const thumb = getListingThumbSrc(row);
  const thumbAlt = getListingThumbAlt(row);
  const listingSlug = row.mobile_id || row.cars_id || String(row.id);

  return (
    <tr className="group transition-colors hover:bg-gray-800/40">
      {/* Thumbnail */}
      <td className="px-3 py-1">
        <div className="flex items-start gap-2">
          <ListingSearchPrefillButton listingId={row.id} />
          <ListingThumbPreview
            src={thumb}
            href={`/listings/${listingSlug}`}
            alt={thumbAlt}
            previewAlt={`${thumbAlt} preview`}
          />
        </div>
      </td>

      {/* Make + Model */}
      <td className="px-2 py-1.5 whitespace-nowrap">
        {row.make ? (
          <Link
            href={listingHref(basePath, currentParams, { make: row.make }, ['make', 'model'])}
            className="block font-medium text-white no-underline hover:text-white hover:no-underline"
          >
            {row.make}
          </Link>
        ) : <div className="font-medium text-white">—</div>}
        {row.model ? (
          <Link
            href={listingHref(basePath, currentParams, { make: row.make ?? '', model: row.model }, ['make', 'model'])}
            className="block text-xs text-gray-400 no-underline hover:text-white hover:no-underline"
          >
            {row.model}
          </Link>
        ) : <div className="text-xs text-gray-400">—</div>}
      </td>

      {/* Title */}
      <td className="max-w-[200px] px-2 py-1.5">
        <Link
          href={`/listings/${listingSlug}`}
          className="block whitespace-normal break-words text-xs text-gray-400 no-underline hover:text-gray-300 hover:no-underline"
        >
          {row.title}
        </Link>
      </td>

      {/* Dealer */}
      <td className="px-2 py-1.5 text-gray-400">
        <div className="flex items-center gap-1.5">
          {row.dealer_slug ? (
            <Link
              href={listingHref(basePath, currentParams, { dealer: row.dealer_slug }, ['dealer'])}
              className="whitespace-nowrap text-gray-400 no-underline hover:text-white hover:no-underline"
            >
              {row.dealer_name ?? '—'}
            </Link>
          ) : <span className="whitespace-nowrap text-gray-400">{row.dealer_name ?? '—'}</span>}
          {row.source === 'c' && (
            <span className="rounded bg-purple-900/70 px-1 py-0.5 text-[10px] text-purple-200">cars</span>
          )}
        </div>
      </td>

      {/* Ad Status */}
      <td className="px-2 py-1 text-center">
        <Link href={statuses.includes(row.ad_status || 'none') ? listingHref(basePath, currentParams, {}) : listingHref(basePath, currentParams, { status: row.ad_status || 'none' })}>
          <AdStatusBadge status={row.ad_status} />
        </Link>
      </td>

      {/* Price */}
      <td className="pl-1 pr-3 py-1 text-right">
        <ListingPriceCell
          price={row.current_price}
          vat={row.vat}
          priceChange={row.price_change}
          carsPrice={row.cars_price}
          historyHref={row.mobile_id ? `/listings/${row.mobile_id}/history` : null}
        />
      </td>

      {/* VAT */}
      <td className="px-3 py-1 text-center">
        <Link href={listingHref(basePath, currentParams, { vat: row.vat || 'null' }, ['vat'])}>
          <VatBadge vat={row.vat} />
        </Link>
      </td>

      {/* Капаро */}
      <td className="px-2 py-1 text-center">
        <Link href={listingHref(basePath, currentParams, { kaparo: row.kaparo ? 'yes' : 'no' }, ['kaparo'])}>
          <KaparoBadge kaparo={row.kaparo} />
        </Link>
      </td>

      {/* Views */}
      <td className="px-3 py-1 text-right text-xs text-gray-300">
        <div>{formatCount(row.views)}</div>
        {row.cars_total_views != null && (
          <div className="text-[11px] text-orange-200/85">
            {row.cars_total_views.toLocaleString('en-US')}
          </div>
        )}
      </td>

      {/* Last Edit */}
      <td className="w-20 px-2 py-1 text-right text-xs text-gray-400">
        <span className="inline-block whitespace-pre-line leading-tight">
          {formatDate(row.last_edit).replace(/,\s+/, '\n')}
        </span>
      </td>

      {/* cars.bg created */}
      <td className="w-20 px-2 py-1 text-right text-xs text-gray-400">
        {formatDateOnly(row.carsbg_created_date)}
      </td>

      {/* New */}
      <td className="px-2 py-1 text-center">
        {row.is_new ? (
          <span className="rounded-full bg-emerald-800/70 px-2 py-0.5 text-[11px] text-emerald-200">new</span>
        ) : (
          <span className="text-gray-600">—</span>
        )}
      </td>

      {/* Reg Year */}
      <td className="px-3 py-1.5 text-right text-gray-400 text-xs">
        <div>{row.reg_month ?? '—'}</div>
        <div>
          {row.reg_year ? (
            <Link href={listingHref(basePath, currentParams, { year: row.reg_year })} className="text-gray-400 hover:text-white">
              {row.reg_year}
            </Link>
          ) : <span className="text-gray-600">—</span>}
        </div>
      </td>

      {/* Category */}
      <td className="w-16 px-2 py-1.5 text-gray-400 text-xs">
        {row.body_type ? (
          <Link href={listingHref(basePath, currentParams, { category: row.body_type }, ['category'])}>
            <span className="block whitespace-normal wrap-break-word leading-tight text-xs text-gray-400 hover:text-gray-400">{row.body_type}</span>
          </Link>
        ) : <span className="text-gray-600">—</span>}
      </td>

      {/* Fuel */}
      <td className="w-20 px-2 py-1.5 text-xs text-gray-400">
        {row.fuel ? (
          <Link href={listingHref(basePath, currentParams, { fuel: row.fuel }, ['fuel'])}>
            <span className="block whitespace-normal break-words leading-tight text-xs text-gray-400 hover:text-gray-400">{row.fuel}</span>
          </Link>
        ) : <span className="text-gray-600">—</span>}
      </td>

      {/* Mileage */}
      <td className="px-2 py-1.5 text-right text-gray-400 text-xs whitespace-nowrap">
        {formatCount(row.mileage)}
      </td>
    </tr>
  );
}
