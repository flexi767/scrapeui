'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface Config {
  id: number;
  dealerId: number | null;
  name: string;
  createdAt: string;
  updatedAt: string;
  isActive: number;
}

// ── Fork Modal ────────────────────────────────────────────────────────────────

function ForkModal({
  sourceId,
  defaultName,
  onClose,
}: {
  sourceId: number;
  defaultName: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const [name, setName] = useState(`${defaultName} (copy)`);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    if (!name.trim()) { setError('Name is required'); return; }
    setBusy(true);
    try {
      const res = await fetch(`/api/dealer-templates/${sourceId}/fork`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim() }),
      });
      if (!res.ok) { setError('Fork failed'); return; }
      router.refresh();
      onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-sm mx-4 p-6 shadow-xl">
        <h2 className="text-lg font-semibold mb-4">Fork Template</h2>
        <label className="block text-sm text-gray-400 mb-1">Config name</label>
        <input
          autoFocus
          value={name}
          onChange={(e) => { setName(e.target.value); setError(''); }}
          onKeyDown={(e) => { if (e.key === 'Enter') submit(); if (e.key === 'Escape') onClose(); }}
          className="w-full bg-gray-800 border border-gray-700 rounded-md px-3 py-2 text-sm text-white outline-none focus:border-blue-500 mb-1"
        />
        {error && <p className="text-xs text-red-400 mb-2">{error}</p>}
        <div className="flex justify-end gap-2 mt-4">
          <button onClick={onClose} disabled={busy} className="text-sm px-4 py-2 rounded-md text-gray-400 hover:text-white">Cancel</button>
          <button onClick={submit} disabled={busy} className="text-sm bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-4 py-2 rounded-md font-medium">
            {busy ? 'Forking…' : 'Fork'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Action buttons ────────────────────────────────────────────────────────────

function ActivateButton({ configId }: { configId: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const activate = async () => {
    setBusy(true);
    await fetch(`/api/dealer-templates/${configId}/activate`, { method: 'POST' });
    router.refresh();
    setBusy(false);
  };
  return (
    <button onClick={activate} disabled={busy} className="text-sm bg-gray-700 hover:bg-gray-600 disabled:opacity-50 text-gray-200 px-3 py-1.5 rounded-md">
      {busy ? '…' : 'Activate'}
    </button>
  );
}

function DeleteButton({ configId }: { configId: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const del = async () => {
    if (!confirm('Delete this config?')) return;
    setBusy(true);
    await fetch(`/api/dealer-templates/${configId}/delete`, { method: 'POST' });
    router.refresh();
    setBusy(false);
  };
  return (
    <button onClick={del} disabled={busy} className="text-sm bg-red-900/60 hover:bg-red-800 disabled:opacity-50 text-red-300 px-3 py-1.5 rounded-md">
      {busy ? '…' : 'Delete'}
    </button>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

export function TemplatesClient({ mine, bases }: { mine: Config[]; bases: Config[] }) {
  const [forkSource, setForkSource] = useState<{ id: number; name: string } | null>(null);

  return (
    <>
      {forkSource && (
        <ForkModal
          sourceId={forkSource.id}
          defaultName={forkSource.name}
          onClose={() => setForkSource(null)}
        />
      )}

      {mine.length > 0 && (
        <section className="mb-8">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3">My Configs</h2>
          <div className="space-y-2">
            {mine.map((c) => (
              <div key={c.id} className="flex items-center justify-between bg-gray-800 border border-gray-700 rounded-lg px-4 py-3">
                <div>
                  <span className="font-medium">{c.name}</span>
                  {c.isActive === 1 && (
                    <span className="ml-2 text-xs bg-green-900 text-green-300 border border-green-700 rounded px-2 py-0.5">Active</span>
                  )}
                  <div className="text-xs text-gray-500 mt-0.5">Updated {new Date(c.updatedAt).toLocaleDateString()}</div>
                </div>
                <div className="flex gap-2">
                  {c.isActive === 0 && <ActivateButton configId={c.id} />}
                  <Link href={`/templates/editor/${c.id}`} className="text-sm bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-md">Edit</Link>
                  <button
                    onClick={() => setForkSource({ id: c.id, name: c.name })}
                    className="text-sm bg-gray-700 hover:bg-gray-600 text-gray-200 px-3 py-1.5 rounded-md"
                  >
                    Fork
                  </button>
                  {c.isActive === 0 && <DeleteButton configId={c.id} />}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3">Base Templates (fork to use)</h2>
        {bases.length === 0 ? (
          <p className="text-sm text-gray-500">No base templates found. Run the seed script to add them.</p>
        ) : (
          <div className="grid grid-cols-3 gap-3">
            {bases.map((c) => (
              <div key={c.id} className="bg-gray-800 border border-gray-700 rounded-lg p-4">
                <div className="font-medium mb-3">{c.name}</div>
                <button
                  onClick={() => setForkSource({ id: c.id, name: c.name })}
                  className="text-sm w-full bg-blue-600 hover:bg-blue-700 text-white py-1.5 rounded-md"
                >
                  Use This Template
                </button>
              </div>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
