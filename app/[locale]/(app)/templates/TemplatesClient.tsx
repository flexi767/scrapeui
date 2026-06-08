'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { formatDateOnly } from '@/lib/date-format';
import { apiRequest, errorMessage } from '@/lib/utils';
import Link from 'next/link';

interface Config {
  id: number;
  dealerId: number | null;
  name: string;
  createdAt: string;
  updatedAt: string;
  isActive: number;
}

interface DealerOption {
  id: number;
  name: string;
}

// ── Fork Modal ────────────────────────────────────────────────────────────────

function ForkModal({
  sourceId,
  sourceDealerId,
  defaultName,
  dealerOptions,
  onClose,
}: {
  sourceId: number;
  sourceDealerId: number | null;
  defaultName: string;
  dealerOptions: DealerOption[];
  onClose: () => void;
}) {
  const router = useRouter();
  const t = useTranslations('ui');
  const [name, setName] = useState(`${defaultName} (copy)`);
  const [dealerId, setDealerId] = useState(
    sourceDealerId === null && dealerOptions.length === 1 ? String(dealerOptions[0].id) : '',
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const requiresDealer = sourceDealerId === null && dealerOptions.length > 0;

  const submit = async () => {
    if (!name.trim()) { setError('Name is required'); return; }
    if (requiresDealer && !dealerId) { setError('Dealer is required'); return; }
    setBusy(true);
    try {
      await apiRequest<unknown>(`/api/dealer-templates/${sourceId}/fork`, 'Fork failed', {
        method: 'POST',
        json: {
          name: name.trim(),
          ...(requiresDealer ? { dealerId: Number(dealerId) } : {}),
        },
      });
      router.refresh();
      onClose();
    } catch (error) {
      setError(errorMessage(error, 'Fork failed'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-sm mx-4 p-6 shadow-xl">
        <h2 className="text-lg font-semibold mb-4">{t('fork_template')}</h2>
        <label className="block text-sm text-gray-400 mb-1">{t('config_name')}</label>
        <input
          autoFocus
          value={name}
          onChange={(e) => { setName(e.target.value); setError(''); }}
          onKeyDown={(e) => { if (e.key === 'Enter') submit(); if (e.key === 'Escape') onClose(); }}
          className="w-full bg-gray-800 border border-gray-700 rounded-md px-3 py-2 text-sm text-white outline-none focus:border-blue-500 mb-1"
        />
        {requiresDealer && (
          <>
            <label className="block text-sm text-gray-400 mt-4 mb-1">{t('dealer')}</label>
            <select
              value={dealerId}
              onChange={(e) => { setDealerId(e.target.value); setError(''); }}
              className="w-full bg-gray-800 border border-gray-700 rounded-md px-3 py-2 text-sm text-white outline-none focus:border-blue-500 mb-1"
            >
              <option value="">{t('select_dealer')}</option>
              {dealerOptions.map((dealer) => (
                <option key={dealer.id} value={dealer.id}>
                  {dealer.name}
                </option>
              ))}
            </select>
          </>
        )}
        {error && <p className="text-xs text-red-400 mb-2">{error}</p>}
        <div className="flex justify-end gap-2 mt-4">
          <button onClick={onClose} disabled={busy} className="text-sm px-4 py-2 rounded-md text-gray-400 hover:text-white">{t('cancel')}</button>
          <button onClick={submit} disabled={busy} className="text-sm bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-4 py-2 rounded-md font-medium">
            {busy ? t('forking') : t('fork')}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Action buttons ────────────────────────────────────────────────────────────

function ActivateButton({ configId }: { configId: number }) {
  const router = useRouter();
  const t = useTranslations('ui');
  const [busy, setBusy] = useState(false);
  const activate = async () => {
    setBusy(true);
    try {
      await apiRequest<unknown>(`/api/dealer-templates/${configId}/activate`, 'Activate failed', { method: 'POST' });
      router.refresh();
    } finally {
      setBusy(false);
    }
  };
  return (
    <button onClick={activate} disabled={busy} className="text-sm bg-gray-700 hover:bg-gray-600 disabled:opacity-50 text-gray-200 px-3 py-1.5 rounded-md">
      {busy ? '…' : t('activate')}
    </button>
  );
}

function DeleteButton({ configId }: { configId: number }) {
  const router = useRouter();
  const t = useTranslations('ui');
  const [busy, setBusy] = useState(false);
  const del = async () => {
    if (!confirm('Delete this config?')) return;
    setBusy(true);
    try {
      await apiRequest<unknown>(`/api/dealer-templates/${configId}/delete`, 'Delete failed', { method: 'POST' });
      router.refresh();
    } finally {
      setBusy(false);
    }
  };
  return (
    <button onClick={del} disabled={busy} className="text-sm bg-red-900/60 hover:bg-red-800 disabled:opacity-50 text-red-300 px-3 py-1.5 rounded-md">
      {busy ? '…' : t('delete')}
    </button>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

export function TemplatesClient({
  mine,
  bases,
  dealerOptions,
}: {
  mine: Config[];
  bases: Config[];
  dealerOptions: DealerOption[];
}) {
  const t = useTranslations('ui');
  const [forkSource, setForkSource] = useState<{ id: number; dealerId: number | null; name: string } | null>(null);

  return (
    <>
      {forkSource && (
        <ForkModal
          sourceId={forkSource.id}
          sourceDealerId={forkSource.dealerId}
          defaultName={forkSource.name}
          dealerOptions={dealerOptions}
          onClose={() => setForkSource(null)}
        />
      )}

      {mine.length > 0 && (
        <section className="mb-8">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3">{t('my_configs')}</h2>
          <div className="space-y-2">
            {mine.map((c) => (
              <div key={c.id} className="flex items-center justify-between bg-gray-800 border border-gray-700 rounded-lg px-4 py-3">
                <div>
                  <span className="font-medium">{c.name}</span>
                  {c.isActive === 1 && (
                    <span className="ml-2 text-xs bg-green-900 text-green-300 border border-green-700 rounded px-2 py-0.5">{t('active')}</span>
                  )}
                  <div className="text-xs text-gray-500 mt-0.5">Updated {formatDateOnly(c.updatedAt)}</div>
                </div>
                <div className="flex gap-2">
                  {c.isActive === 0 && <ActivateButton configId={c.id} />}
                  <Link href={`/templates/editor/${c.id}`} className="text-sm bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-md">{t('edit')}</Link>
                  <button
                    onClick={() => setForkSource({ id: c.id, dealerId: c.dealerId, name: c.name })}
                    className="text-sm bg-gray-700 hover:bg-gray-600 text-gray-200 px-3 py-1.5 rounded-md"
                  >
                    {t('fork')}
                  </button>
                  {c.isActive === 0 && <DeleteButton configId={c.id} />}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3">{t('base_templates')}</h2>
        {bases.length === 0 ? (
          <p className="text-sm text-gray-500">{t('no_base_templates')}</p>
        ) : (
          <div className="grid grid-cols-3 gap-3">
            {bases.map((c) => (
              <div key={c.id} className="bg-gray-800 border border-gray-700 rounded-lg p-4">
                <div className="font-medium mb-3">{c.name}</div>
                <button
                  onClick={() => setForkSource({ id: c.id, dealerId: c.dealerId, name: c.name })}
                  className="text-sm w-full bg-blue-600 hover:bg-blue-700 text-white py-1.5 rounded-md"
                >
                  {t('use_this_template')}
                </button>
              </div>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
