'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

interface Props {
  backupId: number;
  initialValues: {
    title: string;
    price_amount: number | null;
    vat_included: string | null;
    year: number | null;
    mileage: number | null;
    fuel: string | null;
    power: number | null;
    engine: string | null;
    color: string | null;
    transmission: string | null;
    body_type: string | null;
    description: string | null;
  };
}

interface FormState {
  title: string;
  price_amount: string;
  vat_included: string;
  year: string;
  mileage: string;
  fuel: string;
  power: string;
  engine: string;
  color: string;
  transmission: string;
  body_type: string;
  description: string;
}

function toFormState(initialValues: Props['initialValues']): FormState {
  return {
    title: initialValues.title || '',
    price_amount: initialValues.price_amount == null ? '' : String(initialValues.price_amount),
    vat_included: initialValues.vat_included == null ? '' : String(initialValues.vat_included),
    year: initialValues.year == null ? '' : String(initialValues.year),
    mileage: initialValues.mileage == null ? '' : String(initialValues.mileage),
    fuel: initialValues.fuel || '',
    power: initialValues.power == null ? '' : String(initialValues.power),
    engine: initialValues.engine || '',
    color: initialValues.color || '',
    transmission: initialValues.transmission || '',
    body_type: initialValues.body_type || '',
    description: initialValues.description || '',
  };
}

export function MobileBgBackupEditor({ backupId, initialValues }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [form, setForm] = useState<FormState>(() => toFormState(initialValues));

  async function handleSave() {
    const res = await fetch(`/api/mobilebg/backups/${backupId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: form.title,
        price_amount: form.price_amount === '' ? null : Number(form.price_amount),
        vat_included: form.vat_included === '' ? null : form.vat_included,
        year: form.year === '' ? null : Number(form.year),
        mileage: form.mileage === '' ? null : Number(form.mileage),
        fuel: form.fuel || null,
        power: form.power === '' ? null : Number(form.power),
        engine: form.engine || null,
        color: form.color || null,
        transmission: form.transmission || null,
        body_type: form.body_type || null,
        description: form.description || null,
      }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast.error(data.error || 'Could not save backup draft');
      return;
    }

    toast.success('Backup draft saved');
    startTransition(() => {
      router.refresh();
    });
  }

  return (
    <div className="rounded-lg border border-gray-700 bg-gray-900/40 p-4">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-medium text-gray-200">Editable Draft</h2>
          <p className="mt-1 text-xs text-gray-500">These values are now the local draft source for reposts and future mobile.bg updates.</p>
        </div>
        <button
          onClick={handleSave}
          disabled={isPending}
          className="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isPending ? 'Saving…' : 'Save draft'}
        </button>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        <Field label="Title">
          <input value={form.title} onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))} className={inputClassName} />
        </Field>
        <Field label="Price (EUR)">
          <input type="number" min="0" value={form.price_amount} onChange={(e) => setForm((prev) => ({ ...prev, price_amount: e.target.value }))} className={inputClassName} />
        </Field>
        <Field label="VAT">
          <select value={form.vat_included} onChange={(e) => setForm((prev) => ({ ...prev, vat_included: e.target.value }))} className={inputClassName}>
            <option value="">—</option>
            <option value="included">има</option>
            <option value="exempt">няма</option>
            <option value="excluded">+ДДС</option>
          </select>
        </Field>
        <Field label="Year">
          <input type="number" min="1900" max="2100" value={form.year} onChange={(e) => setForm((prev) => ({ ...prev, year: e.target.value }))} className={inputClassName} />
        </Field>
        <Field label="Mileage">
          <input type="number" min="0" value={form.mileage} onChange={(e) => setForm((prev) => ({ ...prev, mileage: e.target.value }))} className={inputClassName} />
        </Field>
        <Field label="Fuel">
          <input value={form.fuel} onChange={(e) => setForm((prev) => ({ ...prev, fuel: e.target.value }))} className={inputClassName} />
        </Field>
        <Field label="Power">
          <input type="number" min="0" value={form.power} onChange={(e) => setForm((prev) => ({ ...prev, power: e.target.value }))} className={inputClassName} />
        </Field>
        <Field label="Engine">
          <input value={form.engine} onChange={(e) => setForm((prev) => ({ ...prev, engine: e.target.value }))} className={inputClassName} />
        </Field>
        <Field label="Transmission">
          <input value={form.transmission} onChange={(e) => setForm((prev) => ({ ...prev, transmission: e.target.value }))} className={inputClassName} />
        </Field>
        <Field label="Color">
          <input value={form.color} onChange={(e) => setForm((prev) => ({ ...prev, color: e.target.value }))} className={inputClassName} />
        </Field>
        <Field label="Body Type">
          <input value={form.body_type} onChange={(e) => setForm((prev) => ({ ...prev, body_type: e.target.value }))} className={inputClassName} />
        </Field>
      </div>

      <div className="mt-3">
        <Field label="Description">
          <textarea
            value={form.description}
            onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
            rows={10}
            className={`${inputClassName} min-h-44`}
          />
        </Field>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="mb-1 text-xs uppercase tracking-wide text-gray-500">{label}</div>
      {children}
    </label>
  );
}

const inputClassName = 'w-full rounded border border-gray-600 bg-gray-800 px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none';
