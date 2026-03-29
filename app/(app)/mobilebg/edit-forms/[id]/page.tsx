import { notFound } from 'next/navigation';
import { getMobileBgEditFormById } from '@/lib/queries';
import { formatDate, parseJson } from '@/lib/utils';

export default async function MobileBgEditFormDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const row = getMobileBgEditFormById(Number(id));
  if (!row) notFound();

  const forms = parseJson<Array<Record<string, unknown>>>(row.forms_json, []);
  const fields = parseJson<Array<Record<string, unknown>>>(row.fields_json, []);
  const checkedBoxes = parseJson<Array<Record<string, unknown>>>(row.checked_boxes_json, []);
  const checkedRadios = parseJson<Array<Record<string, unknown>>>(row.checked_radios_json, []);
  const hidden = parseJson<Record<string, string>>(row.hidden_json, {});

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">{row.row_title || row.mobile_id || `Edit Form #${row.id}`}</h1>
        <p className="mt-1 text-sm text-gray-400">{row.dealer_name || 'Unknown dealer'} • {formatDate(row.created_at)}</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <aside className="space-y-6">
          <section className="rounded-lg border border-gray-700 bg-gray-900/40 p-4">
            <h2 className="mb-3 text-sm font-medium text-gray-200">Snapshot</h2>
            <div className="space-y-2 text-sm">
              <Meta label="Mobile ID" value={row.mobile_id || '—'} />
              <Meta label="Token" value={row.listing_token || '—'} />
              <Meta label="Price text" value={row.row_price_text || '—'} />
              <Meta label="Form URL" value={row.form_url || '—'} />
              <Meta label="Source URL" value={row.source_url || '—'} />
            </div>
          </section>

          <section className="rounded-lg border border-gray-700 bg-gray-900/40 p-4">
            <h2 className="mb-3 text-sm font-medium text-gray-200">Selections</h2>
            <div className="space-y-3 text-sm">
              <div>
                <div className="mb-1 text-xs uppercase tracking-wide text-gray-500">Checked boxes</div>
                <pre className="overflow-x-auto rounded bg-gray-950/60 p-3 text-xs text-gray-300">{JSON.stringify(checkedBoxes, null, 2)}</pre>
              </div>
              <div>
                <div className="mb-1 text-xs uppercase tracking-wide text-gray-500">Checked radios</div>
                <pre className="overflow-x-auto rounded bg-gray-950/60 p-3 text-xs text-gray-300">{JSON.stringify(checkedRadios, null, 2)}</pre>
              </div>
              <div>
                <div className="mb-1 text-xs uppercase tracking-wide text-gray-500">Hidden inputs</div>
                <pre className="overflow-x-auto rounded bg-gray-950/60 p-3 text-xs text-gray-300">{JSON.stringify(hidden, null, 2)}</pre>
              </div>
            </div>
          </section>
        </aside>

        <section className="space-y-6">
          <div className="rounded-lg border border-gray-700 bg-gray-900/40 p-4">
            <h2 className="mb-3 text-sm font-medium text-gray-200">Forms</h2>
            <pre className="overflow-x-auto rounded bg-gray-950/60 p-3 text-xs text-gray-300">{JSON.stringify(forms, null, 2)}</pre>
          </div>

          <div className="rounded-lg border border-gray-700 bg-gray-900/40 p-4">
            <h2 className="mb-3 text-sm font-medium text-gray-200">Fields</h2>
            <pre className="overflow-x-auto rounded bg-gray-950/60 p-3 text-xs text-gray-300">{JSON.stringify(fields, null, 2)}</pre>
          </div>
        </section>
      </div>
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-gray-800 pb-2 last:border-0 last:pb-0">
      <span className="text-gray-500">{label}</span>
      <span className="max-w-[65%] text-right break-all text-gray-200">{value}</span>
    </div>
  );
}
