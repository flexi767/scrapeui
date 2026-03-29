import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getMobileBgEditFormById } from '@/lib/queries';
import { formatDate, parseJson } from '@/lib/utils';

interface ParsedField {
  tag?: string | null;
  name?: string | null;
  id?: string | null;
  type?: string | null;
  value?: string | null;
  checked?: boolean | null;
  disabled?: boolean | null;
  required?: boolean | null;
  placeholder?: string | null;
  form?: string | null;
  options?: Array<{ value: string; text: string; selected: boolean }>;
}

interface ParsedForm {
  name?: string | null;
  id?: string | null;
  method?: string | null;
  action?: string | null;
}

function summarizeFieldValue(field: ParsedField): string {
  if (field.tag === 'select' && field.options?.length) {
    const selected = field.options.find((option) => option.selected);
    return selected?.text || selected?.value || field.value || '—';
  }

  if (field.type === 'checkbox' || field.type === 'radio') {
    return field.checked ? 'checked' : 'not checked';
  }

  const value = field.value?.trim();
  if (!value) return '—';
  if (value.length <= 120) return value;
  return `${value.slice(0, 117)}...`;
}

export default async function MobileBgEditFormDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const row = getMobileBgEditFormById(Number(id));
  if (!row) notFound();

  const forms = parseJson<ParsedForm[]>(row.forms_json, []);
  const fields = parseJson<ParsedField[]>(row.fields_json, []);
  const checkedBoxes = parseJson<Array<{ name?: string; value?: string }>>(row.checked_boxes_json, []);
  const checkedRadios = parseJson<Array<{ name?: string; value?: string }>>(row.checked_radios_json, []);
  const hidden = parseJson<Record<string, string>>(row.hidden_json, {});

  const visibleFields = fields.filter((field) => !['hidden', 'file', 'submit', 'button', 'image'].includes(field.type || ''));
  const keyFields = visibleFields.filter((field) =>
    ['f5', 'f6', 'f12', 'f15', 'f16', 'f18', 'f19', 'f20', 'f21', 'f22', 'f23', 'f24'].includes(field.name || ''),
  );
  const groupedFields = visibleFields.reduce<Record<string, ParsedField[]>>((acc, field) => {
    const key = field.form || 'unassigned';
    if (!acc[key]) acc[key] = [];
    acc[key].push(field);
    return acc;
  }, {});

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div>
        <Link href="/mobilebg/edit-forms" className="text-sm text-blue-300 hover:text-blue-200">← Back to edit forms</Link>
        <h1 className="mt-2 text-2xl font-bold text-white">{row.row_title || row.mobile_id || `Edit Form #${row.id}`}</h1>
        <p className="mt-1 text-sm text-gray-400">{row.dealer_name || 'Unknown dealer'} • {formatDate(row.created_at)}</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[0.85fr_1.15fr]">
        <aside className="space-y-6">
          <section className="overflow-hidden rounded-lg border border-gray-700 bg-gray-900/40">
            <div className="border-b border-gray-700 px-4 py-3">
              <h2 className="text-sm font-medium text-gray-200">Captured Screenshot</h2>
            </div>
            {row.screenshot_path ? (
              <a href={`/api/mobilebg-edit-form-screenshot/${row.id}`} target="_blank" rel="noreferrer" className="block">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`/api/mobilebg-edit-form-screenshot/${row.id}`}
                  alt={`Edit form screenshot for ${row.mobile_id || row.id}`}
                  className="w-full object-cover"
                />
              </a>
            ) : (
              <div className="px-4 py-6 text-sm text-gray-500">No screenshot captured.</div>
            )}
          </section>

          <section className="rounded-lg border border-gray-700 bg-gray-900/40 p-4">
            <h2 className="mb-3 text-sm font-medium text-gray-200">Snapshot</h2>
            <div className="space-y-2 text-sm">
              <Meta label="Mobile ID" value={row.mobile_id || '—'} />
              <Meta label="Backup" value={row.backup_id ? `#${row.backup_id}` : '—'} />
              <Meta label="Token" value={row.listing_token || '—'} />
              <Meta label="Price text" value={row.row_price_text || '—'} />
              <Meta label="Form URL" value={row.form_url || '—'} />
              <Meta label="Source URL" value={row.source_url || '—'} />
            </div>
          </section>

          <section className="rounded-lg border border-gray-700 bg-gray-900/40 p-4">
            <h2 className="mb-3 text-sm font-medium text-gray-200">Checked Options</h2>
            <div className="space-y-3">
              <OptionGroup title="Checkboxes" items={checkedBoxes.map((item) => item.value || item.name || '—')} />
              <OptionGroup title="Radios" items={checkedRadios.map((item) => item.value || item.name || '—')} />
            </div>
          </section>

          <section className="rounded-lg border border-gray-700 bg-gray-900/40 p-4">
            <h2 className="mb-3 text-sm font-medium text-gray-200">Hidden Inputs</h2>
            {Object.keys(hidden).length === 0 ? (
              <div className="text-sm text-gray-500">No hidden inputs captured.</div>
            ) : (
              <div className="space-y-2 text-sm">
                {Object.entries(hidden).map(([name, value]) => (
                  <Meta key={name} label={name} value={value || '—'} />
                ))}
              </div>
            )}
          </section>
        </aside>

        <section className="space-y-6">
          <div className="rounded-lg border border-gray-700 bg-gray-900/40 p-4">
            <h2 className="mb-3 text-sm font-medium text-gray-200">Key Fields</h2>
            {keyFields.length === 0 ? (
              <div className="text-sm text-gray-500">No key fields captured.</div>
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                {keyFields.map((field, index) => (
                  <div key={`${field.name || field.id || field.type}-${index}`} className="rounded-lg border border-gray-800 bg-gray-950/50 p-3">
                    <div className="text-xs uppercase tracking-wide text-gray-500">{field.name || field.id || field.type || 'field'}</div>
                    <div className="mt-1 text-sm font-medium text-gray-100">{summarizeFieldValue(field)}</div>
                    <div className="mt-1 text-xs text-gray-500">{field.type || field.tag || 'field'}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-lg border border-gray-700 bg-gray-900/40 p-4">
            <h2 className="mb-3 text-sm font-medium text-gray-200">Forms</h2>
            {forms.length === 0 ? (
              <div className="text-sm text-gray-500">No forms captured.</div>
            ) : (
              <div className="space-y-3">
                {forms.map((form, index) => (
                  <div key={`${form.name || form.id || 'form'}-${index}`} className="rounded-lg border border-gray-800 bg-gray-950/50 p-3">
                    <div className="text-sm font-medium text-gray-100">{form.name || form.id || `Form ${index + 1}`}</div>
                    <div className="mt-2 grid gap-2 text-sm text-gray-300 md:grid-cols-3">
                      <MetaCompact label="Method" value={form.method || 'GET'} />
                      <MetaCompact label="ID" value={form.id || '—'} />
                      <MetaCompact label="Action" value={form.action || '—'} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-lg border border-gray-700 bg-gray-900/40 p-4">
            <h2 className="mb-3 text-sm font-medium text-gray-200">Fields by Form</h2>
            <div className="space-y-4">
              {Object.entries(groupedFields).map(([formName, formFields]) => (
                <div key={formName} className="rounded-lg border border-gray-800 bg-gray-950/50 p-3">
                  <div className="mb-3 text-sm font-medium text-gray-100">{formName}</div>
                  <div className="space-y-2">
                    {formFields.map((field, index) => (
                      <div key={`${formName}-${field.name || field.id || field.type}-${index}`} className="grid gap-2 rounded border border-gray-800 px-3 py-2 md:grid-cols-[160px_120px_1fr]">
                        <div className="text-sm text-gray-300">{field.name || field.id || '—'}</div>
                        <div className="text-xs uppercase tracking-wide text-gray-500">{field.type || field.tag || 'field'}</div>
                        <div className="text-sm text-gray-100">{summarizeFieldValue(field)}</div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
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

function MetaCompact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-gray-500">{label}</div>
      <div className="mt-1 break-all text-gray-200">{value}</div>
    </div>
  );
}

function OptionGroup({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) {
    return (
      <div>
        <div className="mb-1 text-xs uppercase tracking-wide text-gray-500">{title}</div>
        <div className="text-sm text-gray-500">None selected.</div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-1 text-xs uppercase tracking-wide text-gray-500">{title}</div>
      <div className="flex flex-wrap gap-1.5">
        {items.map((item, index) => (
          <span key={`${title}-${index}`} className="rounded-full bg-gray-800 px-2 py-0.5 text-xs text-gray-300">
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}
