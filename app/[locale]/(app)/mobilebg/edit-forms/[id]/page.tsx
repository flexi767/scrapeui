
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ImageWithFallback } from '@/components/ImageWithFallback';
import { getMobileBgEditFormById } from '@/lib/queries';
import { formatDate, parseJson } from '@/lib/utils';
import { getTranslations } from 'next-intl/server';

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

function summarizeFieldValue(field: ParsedField, checkedLabel: string, notCheckedLabel: string): string {
  if (field.tag === 'select' && field.options?.length) {
    const selected = field.options.find((option) => option.selected);
    return selected?.text || selected?.value || field.value || '—';
  }

  if (field.type === 'checkbox' || field.type === 'radio') {
    return field.checked ? checkedLabel : notCheckedLabel;
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
  const t = await getTranslations('ui');
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

  const checkedLabel = t('field_checked');
  const notCheckedLabel = t('field_not_checked');

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div>
        <Link href="/mobilebg/edit-forms" className="text-sm text-blue-300 hover:text-blue-200">{t('back_to_edit_forms')}</Link>
        <h1 className="mt-2 text-2xl font-bold text-white">{row.row_title || row.mobile_id || `Edit Form #${row.id}`}</h1>
        <p className="mt-1 text-sm text-gray-400">{row.dealer_name || t('unknown_dealer')} • {formatDate(row.created_at)}</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[0.85fr_1.15fr]">
        <aside className="space-y-6">
          <section className="overflow-hidden rounded-lg border border-gray-700 bg-gray-900/40">
            <div className="border-b border-gray-700 px-4 py-3">
              <h2 className="text-sm font-medium text-gray-200">{t('captured_screenshot')}</h2>
            </div>
            {row.screenshot_path ? (
              <a href={`/api/mobilebg-edit-form-screenshot/${row.id}`} target="_blank" rel="noreferrer" className="block">
                <ImageWithFallback
                  src={`/api/mobilebg-edit-form-screenshot/${row.id}`}
                  alt={`Edit form screenshot for ${row.mobile_id || row.id}`}
                  className="w-full object-cover"
                  fallbackLabel={t('screenshot_unavailable')}
                />
              </a>
            ) : (
              <div className="px-4 py-6 text-sm text-gray-500">{t('no_screenshot_captured')}</div>
            )}
          </section>

          <section className="rounded-lg border border-gray-700 bg-gray-900/40 p-4">
            <h2 className="mb-3 text-sm font-medium text-gray-200">{t('snapshot')}</h2>
            <div className="space-y-2 text-sm">
              <Meta label={t('meta_mobile_id')} value={row.mobile_id || '—'} />
              <Meta label={t('meta_backup')} value={row.backup_id ? `#${row.backup_id}` : '—'} />
              <Meta label={t('meta_token')} value={row.listing_token || '—'} />
              <Meta label={t('meta_price_text')} value={row.row_price_text || '—'} />
              <Meta label={t('meta_form_url')} value={row.form_url || '—'} />
              <Meta label={t('meta_source_url')} value={row.source_url || '—'} />
            </div>
          </section>

          <section className="rounded-lg border border-gray-700 bg-gray-900/40 p-4">
            <h2 className="mb-3 text-sm font-medium text-gray-200">{t('checked_options')}</h2>
            <div className="space-y-3">
              <OptionGroup title={t('option_group_checkboxes')} items={checkedBoxes.map((item) => item.value || item.name || '—')} noneSelectedLabel={t('none_selected')} />
              <OptionGroup title={t('option_group_radios')} items={checkedRadios.map((item) => item.value || item.name || '—')} noneSelectedLabel={t('none_selected')} />
            </div>
          </section>

          <section className="rounded-lg border border-gray-700 bg-gray-900/40 p-4">
            <h2 className="mb-3 text-sm font-medium text-gray-200">{t('hidden_inputs')}</h2>
            {Object.keys(hidden).length === 0 ? (
              <div className="text-sm text-gray-500">{t('no_hidden_inputs_captured')}</div>
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
            <h2 className="mb-3 text-sm font-medium text-gray-200">{t('key_fields')}</h2>
            {keyFields.length === 0 ? (
              <div className="text-sm text-gray-500">{t('no_key_fields_captured')}</div>
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                {keyFields.map((field, index) => (
                  <div key={`${field.name || field.id || field.type}-${index}`} className="rounded-lg border border-gray-800 bg-gray-950/50 p-3">
                    <div className="text-xs uppercase tracking-wide text-gray-500">{field.name || field.id || field.type || 'field'}</div>
                    <div className="mt-1 text-sm font-medium text-gray-100">{summarizeFieldValue(field, checkedLabel, notCheckedLabel)}</div>
                    <div className="mt-1 text-xs text-gray-500">{field.type || field.tag || 'field'}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-lg border border-gray-700 bg-gray-900/40 p-4">
            <h2 className="mb-3 text-sm font-medium text-gray-200">{t('forms')}</h2>
            {forms.length === 0 ? (
              <div className="text-sm text-gray-500">{t('no_forms_captured')}</div>
            ) : (
              <div className="space-y-3">
                {forms.map((form, index) => (
                  <div key={`${form.name || form.id || 'form'}-${index}`} className="rounded-lg border border-gray-800 bg-gray-950/50 p-3">
                    <div className="text-sm font-medium text-gray-100">{form.name || form.id || `Form ${index + 1}`}</div>
                    <div className="mt-2 grid gap-2 text-sm text-gray-300 md:grid-cols-3">
                      <MetaCompact label={t('meta_method')} value={form.method || 'GET'} />
                      <MetaCompact label={t('meta_id')} value={form.id || '—'} />
                      <MetaCompact label={t('meta_action')} value={form.action || '—'} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-lg border border-gray-700 bg-gray-900/40 p-4">
            <h2 className="mb-3 text-sm font-medium text-gray-200">{t('fields_by_form')}</h2>
            <div className="space-y-4">
              {Object.entries(groupedFields).map(([formName, formFields]) => (
                <div key={formName} className="rounded-lg border border-gray-800 bg-gray-950/50 p-3">
                  <div className="mb-3 text-sm font-medium text-gray-100">{formName}</div>
                  <div className="space-y-2">
                    {formFields.map((field, index) => (
                      <div key={`${formName}-${field.name || field.id || field.type}-${index}`} className="grid gap-2 rounded border border-gray-800 px-3 py-2 md:grid-cols-[160px_120px_1fr]">
                        <div className="text-sm text-gray-300">{field.name || field.id || '—'}</div>
                        <div className="text-xs uppercase tracking-wide text-gray-500">{field.type || field.tag || 'field'}</div>
                        <div className="text-sm text-gray-100">{summarizeFieldValue(field, checkedLabel, notCheckedLabel)}</div>
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

function OptionGroup({ title, items, noneSelectedLabel }: { title: string; items: string[]; noneSelectedLabel: string }) {
  if (items.length === 0) {
    return (
      <div>
        <div className="mb-1 text-xs uppercase tracking-wide text-gray-500">{title}</div>
        <div className="text-sm text-gray-500">{noneSelectedLabel}</div>
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
