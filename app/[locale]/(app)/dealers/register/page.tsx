
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { toast } from 'sonner';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { slugifyDealerName } from '@/components/dealers/utils';
import { errorMessage, parseApiResponse } from '@/lib/utils';

export default function DealerRegisterPage() {
  const t = useTranslations('ui');
  const { data: session, status } = useSession();
  const router = useRouter();

  const [form, setForm] = useState({
    name: '',
    slug: '',
    mobile_url: '',
    username: '',
    password: '',
    own: false,
    priority: 0,
  });
  const [slugManual, setSlugManual] = useState(false);
  const [saving, setSaving] = useState(false);

  if (status === 'loading') return null;
  if (session?.user.role !== 'admin') {
    return (
      <div className="min-h-screen bg-[#111827] flex items-center justify-center">
        <p className="text-gray-400">{t('admin_access_required')}</p>
      </div>
    );
  }

  function set(field: string, value: string | boolean | number) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  function handleNameChange(v: string) {
    set('name', v);
    if (!slugManual) set('slug', slugifyDealerName(v));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim() || !form.slug.trim() || !form.username.trim() || !form.password.trim()) {
      toast.error(t('name_slug_username_password_required'));
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/dealers/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await parseApiResponse<{ id?: number }>(res, 'Failed');
      if (!data.id) {
        toast.error(t('failed'));
        return;
      }
      toast.success(t('dealer_registered', { name: form.name }));
      router.push(`/dealers/${data.id}/credentials`);
    } catch (error) {
      toast.error(errorMessage(error, 'Failed'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#111827]">
      <header className="sticky top-0 z-20 border-b border-gray-700/60 bg-[#111827]/95 backdrop-blur-sm">
        <div className="mx-auto max-w-2xl px-4 py-3 flex items-center justify-between">
          <Link href="/config" className="text-sm text-gray-400 hover:text-gray-200 transition-colors">
            ← {t('config')}
          </Link>
          <span className="text-sm font-medium text-gray-400">{t('register_dealer')}</span>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-8">
        <h1 className="text-xl font-semibold text-gray-100 mb-6">{t('register_new_dealer')}</h1>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Dealer info */}
          <section className="bg-gray-800 rounded-lg border border-gray-700 p-5 space-y-4">
            <h2 className="text-sm font-medium text-gray-300 uppercase tracking-wide">{t('dealer_info')}</h2>

            <div>
              <label className="block text-sm text-gray-400 mb-1">{t('name_required')}</label>
              <input
                className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-gray-100 text-sm focus:outline-none focus:border-blue-500"
                value={form.name}
                onChange={(e) => handleNameChange(e.target.value)}
                placeholder="M Motors"
                required
              />
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-1">{t('slug_required')} <span className="text-gray-500 text-xs">({t('used_in_public_url')})</span></label>
              <input
                className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-gray-100 text-sm focus:outline-none focus:border-blue-500 font-mono"
                value={form.slug}
                onChange={(e) => { setSlugManual(true); set('slug', e.target.value); }}
                placeholder="m-motors"
                pattern="[a-z0-9-]+"
                required
              />
              <p className="text-xs text-gray-500 mt-1">{t('slug_hint')}</p>
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-1">{t('mobilebg_listing_url')}</label>
              <input
                className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-gray-100 text-sm focus:outline-none focus:border-blue-500"
                value={form.mobile_url}
                onChange={(e) => set('mobile_url', e.target.value)}
                placeholder="https://www.mobile.bg/pcgi/mobile.cgi?act=3&slink=..."
                type="url"
              />
            </div>

            <div className="flex items-center gap-6">
              <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
                <input
                  type="checkbox"
                  className="rounded border-gray-600"
                  checked={form.own}
                  onChange={(e) => set('own', e.target.checked)}
                />
                {t('own_listing_we_manage')}
              </label>

              <div className="flex items-center gap-2">
                <label className="text-sm text-gray-400">{t('priority')}</label>
                <input
                  type="number"
                  className="w-20 bg-gray-700 border border-gray-600 rounded px-2 py-1 text-gray-100 text-sm focus:outline-none focus:border-blue-500"
                  value={form.priority}
                  onChange={(e) => set('priority', Number(e.target.value))}
                  min={0}
                />
              </div>
            </div>
          </section>

          {/* Login account */}
          <section className="bg-gray-800 rounded-lg border border-gray-700 p-5 space-y-4">
            <h2 className="text-sm font-medium text-gray-300 uppercase tracking-wide">{t('login_account')}</h2>
            <p className="text-xs text-gray-500">{t('login_account_description')}</p>

            <div>
              <label className="block text-sm text-gray-400 mb-1">{t('username_required')}</label>
              <input
                className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-gray-100 text-sm focus:outline-none focus:border-blue-500"
                value={form.username}
                onChange={(e) => set('username', e.target.value)}
                placeholder="mmotors"
                required
                autoComplete="off"
              />
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-1">{t('password_required')}</label>
              <input
                type="password"
                className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-gray-100 text-sm focus:outline-none focus:border-blue-500"
                value={form.password}
                onChange={(e) => set('password', e.target.value)}
                placeholder={t('min_6_characters')}
                required
                autoComplete="new-password"
              />
            </div>
          </section>

          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-medium rounded transition-colors"
            >
              {saving ? t('registering') : t('register_dealer')}
            </button>
            <Link href="/config" className="text-sm text-gray-400 hover:text-gray-200">
              {t('cancel')}
            </Link>
          </div>
        </form>
      </main>
    </div>
  );
}
