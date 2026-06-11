'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
import { apiRequest, errorMessage } from '@/lib/utils';
import { PAGE_KEYS, type PageKey } from '@/lib/page-keys';

export function PermissionsForm({
  userId,
  username,
  initialGrantedPageKeys,
}: {
  userId: number;
  username: string;
  initialGrantedPageKeys: string[];
}) {
  const t = useTranslations('ui');
  const router = useRouter();
  const [granted, setGranted] = useState<Set<string>>(new Set(initialGrantedPageKeys));
  const [saving, setSaving] = useState(false);

  const PAGE_LABELS: Record<PageKey, string> = {
    listings: t('page_listings'),
    editown: t('page_editown'),
    mobilebg: t('page_mobilebg'),
    tasks: t('page_tasks'),
    expenses: t('page_expenses'),
    templates: t('page_templates'),
    translations: t('page_translations'),
    config: t('page_config'),
    mapping: t('page_mapping'),
    kb: t('page_kb'),
    files: t('page_files'),
    dealers: t('page_dealers'),
  };

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
      toast.success(t('permissions_updated_for', { username }));
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
        {t('dashboard_always_visible')}
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
        {saving ? t('saving') : t('save_permissions')}
      </button>
    </div>
  );
}
