'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { apiRequest, errorMessage } from '@/lib/utils';
import { PAGE_KEYS, type PageKey } from '@/lib/page-permissions';

const PAGE_LABELS: Record<PageKey, string> = {
  listings: 'Listings',
  editown: 'Edit Own',
  mobilebg: 'Mobile.bg',
  tasks: 'Tasks',
  expenses: 'Expenses',
  templates: 'Templates',
  translations: 'Translations',
  config: 'Config',
  mapping: 'Mapping',
  kb: 'Knowledge Base',
  files: 'Files',
  dealers: 'Dealers',
};

export function PermissionsForm({
  userId,
  username,
  initialGrantedPageKeys,
}: {
  userId: number;
  username: string;
  initialGrantedPageKeys: string[];
}) {
  const router = useRouter();
  const [granted, setGranted] = useState<Set<string>>(new Set(initialGrantedPageKeys));
  const [saving, setSaving] = useState(false);

  function toggle(key: PageKey) {
    setGranted((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }

  async function handleSave() {
    setSaving(true);
    try {
      await apiRequest(`/api/users/${userId}/permissions`, 'Failed to save permissions', {
        method: 'PUT',
        json: { pageKeys: Array.from(granted) },
      });
      toast.success(`Permissions updated for ${username}`);
      router.refresh();
    } catch (error) {
      toast.error(errorMessage(error, 'Failed to save permissions'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm text-gray-300 opacity-60">
        <input type="checkbox" checked readOnly className="rounded border-gray-600" />
        Dashboard <span className="text-xs text-gray-500">(always visible)</span>
      </div>

      {PAGE_KEYS.map((key) => (
        <label key={key} className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
          <input
            type="checkbox"
            className="rounded border-gray-600"
            checked={granted.has(key)}
            onChange={() => toggle(key)}
          />
          {PAGE_LABELS[key]}
        </label>
      ))}

      <button
        type="button"
        onClick={handleSave}
        disabled={saving}
        className="bg-blue-600 hover:bg-blue-500 disabled:opacity-60 disabled:cursor-not-allowed text-white text-sm font-medium rounded px-4 py-2 transition-colors"
      >
        {saving ? 'Saving…' : 'Save permissions'}
      </button>
    </div>
  );
}
