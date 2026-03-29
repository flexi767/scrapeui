import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getAllDealers, getMobileBgBackupById } from '@/lib/queries';
import { formatDate, formatMileage, formatPrice, parseJson } from '@/lib/utils';
import { MobileBgActionPanel } from '@/components/MobileBgActionPanel';

export default async function MobileBgBackupDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const backup = getMobileBgBackupById(Number(id));
  if (!backup) notFound();
  const dealers = getAllDealers().filter((dealer) => dealer.active && dealer.mobile_url);

  const phones = parseJson<string[]>(backup.phones_json, []);
  const extras = parseJson<Record<string, Array<{ label: string; alias?: string | null }>>>(backup.extras_json, {});
  const techData = parseJson<Record<string, string>>(backup.tech_data_json, {});
  const photoOrder = parseJson<string[]>(backup.photo_order_json, []);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div>
        <Link href="/mobilebg/backups" className="text-sm text-blue-300 hover:text-blue-200">← Back to backups</Link>
        <h1 className="mt-2 text-2xl font-bold text-white">{backup.make || '—'} {backup.model || ''}</h1>
        <p className="mt-1 text-sm text-gray-400">{backup.title || backup.source_title || backup.mobile_id || '—'}</p>
      </div>

      <MobileBgActionPanel
        dealers={dealers.map((dealer) => ({ slug: dealer.slug, name: dealer.name }))}
        defaultDealerSlug={backup.dealer_slug}
        mobileId={backup.mobile_id}
        backupId={backup.id}
      />

      <div className="grid gap-6 lg:grid-cols-[1.4fr_0.9fr]">
        <section className="space-y-6">
          <div className="rounded-lg border border-gray-700 bg-gray-900/40 p-4">
            <h2 className="mb-3 text-sm font-medium text-gray-200">Images</h2>
            {backup.images.length === 0 ? (
              <div className="text-sm text-gray-500">No local images stored for this backup.</div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {backup.images.map((image) => (
                  <a key={image.id} href={`/api/mobilebg-backup-images/${image.id}`} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-lg border border-gray-700 bg-gray-800">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={`/api/mobilebg-backup-images/${image.id}`}
                      alt={image.filename}
                      className="aspect-[4/3] w-full object-cover"
                    />
                    <div className="px-3 py-2 text-xs text-gray-400">{image.filename}</div>
                  </a>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-lg border border-gray-700 bg-gray-900/40 p-4">
            <h2 className="mb-3 text-sm font-medium text-gray-200">Description</h2>
            <div className="whitespace-pre-wrap text-sm text-gray-300">
              {backup.description || 'No description stored.'}
            </div>
          </div>

          <div className="rounded-lg border border-gray-700 bg-gray-900/40 p-4">
            <h2 className="mb-3 text-sm font-medium text-gray-200">Artifact Details</h2>
            <div className="space-y-2 text-sm">
              <Meta label="Backup row" value={`#${backup.id}`} />
              <Meta label="Last run" value={backup.run_id ? `#${backup.run_id}` : '—'} />
              <Meta label="Source title" value={backup.source_title || '—'} />
              <Meta label="Image files" value={backup.images.length ? backup.images.map((image) => image.filename).join(', ') : '—'} />
            </div>
            <div className="mt-4">
              <div className="mb-2 text-xs uppercase tracking-wide text-gray-500">Photo order keys</div>
              {photoOrder.length === 0 ? (
                <div className="text-sm text-gray-500">No photo order captured.</div>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {photoOrder.map((key) => (
                    <span key={key} className="rounded-full bg-gray-800 px-2 py-0.5 text-xs text-gray-300">
                      {key}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="grid gap-6 xl:grid-cols-2">
            <div className="rounded-lg border border-gray-700 bg-gray-900/40 p-4">
              <h2 className="mb-3 text-sm font-medium text-gray-200">Extras</h2>
              {Object.keys(extras).length === 0 ? (
                <div className="text-sm text-gray-500">No extras captured.</div>
              ) : (
                <div className="space-y-3">
                  {Object.entries(extras).map(([group, items]) => (
                    <div key={group}>
                      <div className="mb-1 text-xs uppercase tracking-wide text-gray-500">{group}</div>
                      <div className="flex flex-wrap gap-1.5">
                        {items.map((item, index) => (
                          <span key={`${group}-${index}`} className="rounded-full bg-gray-800 px-2 py-0.5 text-xs text-gray-300">
                            {item.label}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-lg border border-gray-700 bg-gray-900/40 p-4">
              <h2 className="mb-3 text-sm font-medium text-gray-200">Tech Data</h2>
              {Object.keys(techData).length === 0 ? (
                <div className="text-sm text-gray-500">No technical data captured.</div>
              ) : (
                <div className="space-y-2">
                  {Object.entries(techData).map(([label, value]) => (
                    <div key={label} className="flex items-start justify-between gap-4 border-b border-gray-800 pb-2 text-sm last:border-0 last:pb-0">
                      <span className="text-gray-500">{label}</span>
                      <span className="text-right text-gray-200">{value}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>

        <aside className="space-y-6">
          <div className="rounded-lg border border-gray-700 bg-gray-900/40 p-4">
            <h2 className="mb-3 text-sm font-medium text-gray-200">Summary</h2>
            <div className="space-y-2 text-sm">
              <Meta label="Dealer" value={backup.dealer_name || '—'} />
              <Meta label="Mobile ID" value={backup.mobile_id || '—'} />
              <Meta label="Price" value={formatPrice(backup.price_amount)} />
              <Meta label="Year" value={backup.year ? String(backup.year) : '—'} />
              <Meta label="Mileage" value={formatMileage(backup.mileage)} />
              <Meta label="Fuel" value={backup.fuel || '—'} />
              <Meta label="Transmission" value={backup.transmission || '—'} />
              <Meta label="Color" value={backup.color || '—'} />
              <Meta label="Engine" value={backup.engine || '—'} />
              <Meta label="Power" value={backup.power ? `${backup.power} hp` : '—'} />
              <Meta label="Category" value={backup.category || '—'} />
              <Meta label="VAT" value={backup.vat_included == null ? '—' : backup.vat_included ? 'included' : 'not included'} />
              <Meta label="Images" value={String(backup.image_count)} />
              <Meta label="Saved" value={formatDate(backup.updated_at || backup.created_at)} />
            </div>
          </div>

          <div className="rounded-lg border border-gray-700 bg-gray-900/40 p-4">
            <h2 className="mb-3 text-sm font-medium text-gray-200">Phones</h2>
            {phones.length === 0 ? (
              <div className="text-sm text-gray-500">No phone numbers captured.</div>
            ) : (
              <div className="space-y-1 text-sm text-gray-300">
                {phones.map((phone) => <div key={phone}>{phone}</div>)}
              </div>
            )}
          </div>

          <div className="rounded-lg border border-gray-700 bg-gray-900/40 p-4">
            <h2 className="mb-3 text-sm font-medium text-gray-200">Links</h2>
            <div className="space-y-2 text-sm">
              {backup.source_url ? (
                <a href={backup.source_url} target="_blank" rel="noreferrer" className="block text-blue-300 hover:text-blue-200">Original mobile.bg listing</a>
              ) : <div className="text-gray-500">No source URL stored.</div>}
              {backup.listing_id ? (
                <Link href={`/listings/${backup.mobile_id}`} className="block text-blue-300 hover:text-blue-200">Open current scrapeui listing</Link>
              ) : null}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-gray-800 pb-2 last:border-0 last:pb-0">
      <span className="text-gray-500">{label}</span>
      <span className="text-right text-gray-200">{value}</span>
    </div>
  );
}
