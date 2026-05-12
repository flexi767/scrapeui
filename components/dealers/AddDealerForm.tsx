import type { Dispatch, FormEvent, SetStateAction } from 'react';
import { DealerTextInput } from './DealerTextInput';
import type { DealerCreateForm } from './types';
import { slugifyDealerName } from './utils';

interface AddDealerFormProps {
  adding: boolean;
  error: string;
  form: DealerCreateForm;
  setForm: Dispatch<SetStateAction<DealerCreateForm>>;
  onSubmit: (event: FormEvent) => void;
}

export function AddDealerForm({ adding, error, form, setForm, onSubmit }: AddDealerFormProps) {
  return (
    <form onSubmit={onSubmit} className="rounded-lg border border-gray-700/60 bg-gray-800/40 p-4 space-y-3">
      <h3 className="text-sm font-medium text-gray-300">Add</h3>
      <div className="grid grid-cols-4 items-start gap-3">
        <DealerTextInput
          placeholder="Name"
          value={form.name}
          onValueChange={(value) =>
            setForm((current) => ({
              ...current,
              name: value,
              slug: slugifyDealerName(value),
            }))
          }
          required
        />
        <DealerTextInput
          placeholder="Slug"
          value={form.slug}
          onValueChange={(value) =>
            setForm((current) => ({ ...current, slug: slugifyDealerName(value) }))
          }
          required
          className="rounded border border-gray-600 bg-gray-800 px-3 py-1.5 text-sm text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none font-mono"
        />
        <DealerTextInput
          placeholder="https://dealer.mobile.bg"
          value={form.mobile_url}
          onValueChange={(value) =>
            setForm((current) => ({ ...current, mobile_url: value }))
          }
          required
          type="url"
        />
        <DealerTextInput
          placeholder="https://www.cars.bg/company/dealer"
          value={form.cars_url}
          onValueChange={(value) =>
            setForm((current) => ({ ...current, cars_url: value }))
          }
          type="url"
        />
        <div className="flex items-start justify-between gap-3">
          <button type="submit" disabled={adding} className="justify-self-start rounded bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50">{adding ? 'Adding…' : '+ Add'}</button>
          <label className="flex items-center gap-2 text-sm text-gray-300"><input type="checkbox" checked={form.own} onChange={e => setForm(f => ({ ...f, own: e.target.checked }))} /> own dealer</label>
        </div>
        <div className="flex items-start gap-2">
          <label className="text-sm text-gray-400">Priority:</label>
          <input type="number" value={form.priority} onChange={e => setForm(f => ({ ...f, priority: parseInt(e.target.value) || 0 }))} className="w-20 rounded border border-gray-600 bg-gray-800 px-2 py-1 text-sm text-white text-center focus:border-blue-500 focus:outline-none" />
        </div>
        {form.own && (
          <>
            <div className="flex flex-col gap-2">
              <DealerTextInput
                placeholder="mobile user"
                value={form.mobile_user}
                onValueChange={(value) =>
                  setForm((current) => ({ ...current, mobile_user: value }))
                }
              />
              <DealerTextInput
                placeholder="mobile password"
                value={form.mobile_password}
                onValueChange={(value) =>
                  setForm((current) => ({
                    ...current,
                    mobile_password: value,
                  }))
                }
              />
            </div>
            <div className="flex flex-col gap-2">
              <DealerTextInput
                placeholder="cars user"
                value={form.cars_user}
                onValueChange={(value) =>
                  setForm((current) => ({ ...current, cars_user: value }))
                }
              />
              <DealerTextInput
                placeholder="cars password"
                value={form.cars_password}
                onValueChange={(value) =>
                  setForm((current) => ({ ...current, cars_password: value }))
                }
              />
            </div>
          </>
        )}
      </div>
      {error && <p className="text-red-400 text-xs">{error}</p>}
    </form>
  );
}
