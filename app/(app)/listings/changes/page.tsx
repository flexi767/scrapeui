import Link from 'next/link';
import { Suspense } from 'react';
import { ListingThumbPreview } from '@/components/ListingThumbPreview';
import ChangesFilterBar from '@/components/ChangesFilterBar';
import { ListingsPagination } from '@/components/listings/ListingsPagination';
import {
  getAllDealers,
  getMakeModels,
  getTrackedChanges,
  getTrackedChangeWindows,
  type TrackedChangeRow,
} from '@/lib/queries';
import { getListingThumbAlt, getListingThumbSrc } from '@/lib/listing-thumb';
import { formatDate, formatPrice } from '@/lib/utils';

interface SearchParams {
  make?: string;
  model?: string;
  dealer?: string | string[];
  field?: string | string[];
  search?: string;
  when?: string;
  page?: string;
}

const FIELD_OPTIONS = [
  { value: 'price', label: 'Price' },
  { value: 'vat', label: 'VAT' },
  { value: 'last_edit', label: 'Last Edit' },
  { value: 'views', label: 'Views' },
  { value: 'ad_status', label: 'Paid' },
  { value: 'kaparo', label: 'К' },
  { value: 'title', label: 'Title' },
  { value: 'description', label: 'Description' },
];

const DEFAULT_FIELD_VALUES = FIELD_OPTIONS
  .map((field) => field.value)
  .filter((value) => value !== 'views');

function toArray(value: string | string[] | undefined): string[] {
  if (Array.isArray(value)) return value.filter(Boolean);
  return value ? [value] : [];
}

function appendMultiParams(params: URLSearchParams, key: string, values: string[]) {
  values.forEach((value) => {
    if (value) params.append(key, value);
  });
}

function changedFields(change: TrackedChangeRow) {
  const result: string[] = [];
  if (change.snapshot_price != null && change.snapshot_price !== change.target_price) result.push('Price');
  if (change.snapshot_vat != null && change.snapshot_vat !== change.target_vat) result.push('VAT');
  if (change.snapshot_last_edit != null && change.snapshot_last_edit !== change.target_last_edit) result.push('Last Edit');
  if (change.snapshot_views != null && change.snapshot_views !== change.target_views) {
    result.push(change.source === 'c' ? 'Cars.bg views' : 'Views');
  }
  if (change.snapshot_ad_status != null && change.snapshot_ad_status !== change.target_ad_status) result.push('Paid');
  if (change.snapshot_kaparo != null && change.snapshot_kaparo !== change.target_kaparo) result.push('К');
  if (change.snapshot_title && change.snapshot_title !== change.target_title) result.push('Title');
  if (change.snapshot_description && change.snapshot_description !== change.target_description) result.push('Description');
  return result;
}

function getViewsLabel(change: TrackedChangeRow) {
  return change.source === 'c' ? 'Cars.bg views' : 'Views';
}

function formatWhenOption(value: string, count: number) {
  const label = formatDate(value);
  return count > 1 ? `${label} (${count})` : label;
}

function SortPreservingLink({
  label,
  href,
}: {
  label: string;
  href: string;
}) {
  return <Link href={href} className="hover:text-white">{label}</Link>;
}

export default async function ListingsChangesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const make = sp.make ?? '';
  const model = sp.model ?? '';
  const dealerSlugs = toArray(sp.dealer);
  const requestedFields = toArray(sp.field);
  const fields = requestedFields.length > 0 ? requestedFields : DEFAULT_FIELD_VALUES;
  const search = sp.search ?? '';
  const when = sp.when ?? '';
  const page = parseInt(sp.page ?? '1', 10);

  const windows = getTrackedChangeWindows();
  const selectedWindow = when ? windows.find((window) => window.value === when) ?? null : null;
  const { data: rows, total } = getTrackedChanges({
    make,
    model,
    dealerSlugs,
    fields,
    search,
    whenStart: selectedWindow?.start ?? null,
    whenEnd: selectedWindow?.end ?? null,
    page,
    limit: 50,
  });

  const makeModels = getMakeModels();
  const makes = Object.keys(makeModels).sort();
  const allDealers = getAllDealers();
  const totalPages = Math.ceil(total / 50);

  const currentParams = new URLSearchParams();
  if (make) currentParams.set('make', make);
  if (model) currentParams.set('model', model);
  appendMultiParams(currentParams, 'dealer', dealerSlugs);
  appendMultiParams(currentParams, 'field', requestedFields);
  if (search) currentParams.set('search', search);
  if (when) currentParams.set('when', when);

  const whenOptions = windows.map((window) => ({
    value: window.value,
    label: formatWhenOption(window.value, window.count),
  }));

  return (
    <div className="min-h-screen bg-[#111827]">
      <header className="sticky top-0 z-20 border-b border-gray-700/60 bg-[#111827]/95 backdrop-blur-sm">
        <div className="mx-auto max-w-[1600px] px-4 py-3">
          <Suspense>
            <ChangesFilterBar
              makes={makes}
              makeModels={makeModels}
              allDealers={allDealers}
              fieldOptions={FIELD_OPTIONS}
              defaultFieldValues={DEFAULT_FIELD_VALUES}
              whenOptions={whenOptions}
              total={total}
            />
          </Suspense>
        </div>
      </header>

      <main className="mx-auto max-w-[1600px] px-4 py-4">
        <div className="overflow-x-auto rounded-lg border border-gray-700/60">
          <table className="w-full min-w-[1200px] text-sm">
            <thead>
              <tr className="border-b border-gray-700 bg-gray-800/60 text-xs font-medium uppercase tracking-wider text-gray-400">
                <th className="w-24 px-3 py-1.5 text-left">Img</th>
                <th className="px-3 py-1.5 text-left">Make / Model</th>
                <th className="px-3 py-1.5 text-left">Title</th>
                <th className="px-3 py-1.5 text-left">Dealer</th>
                <th className="px-3 py-1.5 text-left">Fields</th>
                <th className="px-3 py-1.5 text-left">Values</th>
                <th className="px-3 py-1.5 text-right">When</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700/50">
              {rows.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-16 text-center text-gray-500">
                    No tracked changes found
                  </td>
                </tr>
              )}
              {rows.map((row) => {
                const thumb = getListingThumbSrc(row);
                const thumbAlt = getListingThumbAlt(row);
                const listingSlug = row.mobile_id || row.cars_id || String(row.listing_id);
                const fields = changedFields(row);

                return (
                  <tr key={row.id} className="group transition-colors hover:bg-gray-800/40 align-top">
                    <td className="px-3 py-1">
                      <ListingThumbPreview
                        src={thumb}
                        href={`/listings/${listingSlug}`}
                        alt={thumbAlt}
                        previewAlt={`${thumbAlt} preview`}
                      />
                    </td>

                    <td className="px-2 py-1.5 whitespace-nowrap">
                      <Link href={`/listings/changes?${new URLSearchParams([...Array.from(currentParams.entries()).filter(([key]) => key !== 'make' && key !== 'model' && key !== 'page'), ['make', row.make ?? '']]).toString()}`} className="block font-medium text-white no-underline hover:text-white hover:no-underline">
                        {row.make || '—'}
                      </Link>
                      <Link href={`/listings/changes?${new URLSearchParams([...Array.from(currentParams.entries()).filter(([key]) => key !== 'make' && key !== 'model' && key !== 'page'), ['make', row.make ?? ''], ['model', row.model ?? '']]).toString()}`} className="block text-xs text-gray-400 no-underline hover:text-white hover:no-underline">
                        {row.model || '—'}
                      </Link>
                    </td>

                    <td className="max-w-[220px] px-2 py-1.5">
                      <Link href={`/listings/${listingSlug}`} className="block whitespace-normal break-words text-xs text-gray-400 no-underline hover:text-gray-300 hover:no-underline">
                        {row.title || row.current_title || '—'}
                      </Link>
                    </td>

                    <td className="px-2 py-1.5 text-gray-400">
                      {row.dealer_slug ? (
                        <SortPreservingLink
                          label={row.dealer_name ?? '—'}
                          href={`/listings/changes?${new URLSearchParams([...Array.from(currentParams.entries()).filter(([key]) => key !== 'dealer' && key !== 'page'), ['dealer', row.dealer_slug]]).toString()}`}
                        />
                      ) : (
                        <span>{row.dealer_name ?? '—'}</span>
                      )}
                    </td>

                    <td className="px-3 py-1.5">
                      <div className="flex flex-wrap gap-1.5">
                        {fields.map((label) => (
                          <Link
                            key={label}
                            href={`/listings/changes?${new URLSearchParams([...Array.from(currentParams.entries()).filter(([key]) => key !== 'field' && key !== 'page'), ['field', label === 'Last Edit' ? 'last_edit' : label === 'Paid' ? 'ad_status' : label === 'К' ? 'kaparo' : label.toLowerCase()]]).toString()}`}
                            className="rounded-full bg-gray-800 px-2 py-0.5 text-[11px] text-gray-300 hover:text-white"
                          >
                            {label}
                          </Link>
                        ))}
                      </div>
                    </td>

                    <td className="px-3 py-1.5 text-xs text-gray-300">
                      <div className="space-y-1">
                        {row.snapshot_price != null && row.snapshot_price !== row.target_price ? <div>Price: {formatPrice(row.snapshot_price)} → {formatPrice(row.target_price)}</div> : null}
                        {row.snapshot_vat != null && row.snapshot_vat !== row.target_vat ? <div>VAT: {row.snapshot_vat || '—'} → {row.target_vat || '—'}</div> : null}
                        {row.snapshot_last_edit != null && row.snapshot_last_edit !== row.target_last_edit ? <div>Last Edit: {formatDate(row.snapshot_last_edit)} → {formatDate(row.target_last_edit)}</div> : null}
                        {row.snapshot_views != null && row.snapshot_views !== row.target_views ? <div>{getViewsLabel(row)}: {row.snapshot_views.toLocaleString('en-US')} → {(row.target_views ?? 0).toLocaleString('en-US')}</div> : null}
                        {row.snapshot_ad_status != null && row.snapshot_ad_status !== row.target_ad_status ? <div>Paid: {row.snapshot_ad_status} → {row.target_ad_status || 'none'}</div> : null}
                        {row.snapshot_kaparo != null && row.snapshot_kaparo !== row.target_kaparo ? <div>К: {row.snapshot_kaparo ? 'yes' : 'no'} → {row.target_kaparo ? 'yes' : 'no'}</div> : null}
                        {row.snapshot_title && row.snapshot_title !== row.target_title ? <div className="line-clamp-2">Title: {row.snapshot_title} → {row.target_title || '—'}</div> : null}
                        {row.snapshot_description && row.snapshot_description !== row.target_description ? <div className="line-clamp-3 whitespace-pre-wrap text-gray-400">Description: {row.snapshot_description}</div> : null}
                      </div>
                    </td>

                    <td className="w-24 px-2 py-1 text-right text-xs text-gray-400">
                      <span className="inline-block whitespace-pre-line leading-tight">
                        {formatDate(row.recorded_at)}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <ListingsPagination
          page={page}
          totalPages={totalPages}
          currentParams={currentParams}
          basePath="/listings/changes"
        />
      </main>
    </div>
  );
}
