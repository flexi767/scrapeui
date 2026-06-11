'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { signIn } from 'next-auth/react';
import { toast } from 'sonner';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { slugifyDealerName } from '@/components/dealers/utils';
import { apiRequest, errorMessage } from '@/lib/utils';

export default function PublicRegisterPage() {
  const router = useRouter();
  const t = useTranslations('ui');

  const [form, setForm] = useState({
    name: '',
    slug: '',
    mobile_url: '',
    username: '',
    password: '',
    email: '',
    own: false,
    priority: 0,
  });
  const [slugManual, setSlugManual] = useState(false);
  const [saving, setSaving] = useState(false);

  function set(field: string, value: string | boolean | number) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  function handleNameChange(v: string) {
    set('name', v);
    if (!slugManual) set('slug', slugifyDealerName(v));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (
      !form.name.trim() || !form.slug.trim() ||
      !form.username.trim() || !form.password.trim() || !form.email.trim()
    ) {
      toast.error(t('register_fields_required'));
      return;
    }
    setSaving(true);
    try {
      const data = await apiRequest<{ id?: number }>('/api/dealers/self-register', t('registration_failed'), {
        method: 'POST',
        json: form,
      });
      if (!data.id) {
        toast.error(t('registration_failed'));
        return;
      }

      const signInResult = await signIn('credentials', {
        username: form.username,
        password: form.password,
        redirect: false,
      });
      if (signInResult?.error) {
        toast.success(t('account_created_please_login'));
        router.push('/login');
        return;
      }

      toast.success(t('welcome_name', { name: form.name }));
      router.push('/dashboard');
      router.refresh();
    } catch (error) {
      toast.error(errorMessage(error, t('registration_failed')));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#111827]">
      <header className="sticky top-0 z-20 border-b border-gray-700/60 bg-[#111827]/95 backdrop-blur-sm">
        <div className="mx-auto max-w-2xl px-4 py-3 flex items-center justify-between">
          <Link href="/login" className="text-sm text-gray-400 hover:text-gray-200 transition-colors">
            {t('back_to_login')}
          </Link>
          <span className="text-sm font-medium text-gray-400">{t('register_as_dealer')}</span>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-8">
        <h1 className="text-xl font-semibold text-gray-100 mb-6">{t('create_dealer_account')}</h1>

        <form onSubmit={handleSubmit} className="space-y-6">
          <section className="bg-gray-800 rounded-lg border border-gray-700 p-5 space-y-4">
            <h2 className="text-sm font-medium text-gray-300 uppercase tracking-wide">{t('dealer_info')}</h2>

            <div>
              <label className="block text-sm text-gray-400 mb-1">{t('dealer_company_name')}</label>
              <input
                className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-gray-100 text-sm focus:outline-none focus:border-blue-500"
                value={form.name}
                onChange={(e) => handleNameChange(e.target.value)}
                placeholder={t('dealer_name_placeholder')}
                required
              />
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-1">{t('slug_label')} <span className="text-gray-500 text-xs">{t('slug_hint')}</span></label>
              <input
                className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-gray-100 text-sm focus:outline-none focus:border-blue-500 font-mono"
                value={form.slug}
                onChange={(e) => { setSlugManual(true); set('slug', e.target.value); }}
                placeholder={t('slug_placeholder')}
                pattern="[a-z0-9-]+"
                required
              />
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
                {t('own_listing_inventory')}
              </label>

              <div className="flex items-center gap-2">
                <label className="text-sm text-gray-400">{t('priority_label')}</label>
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

          <section className="bg-gray-800 rounded-lg border border-gray-700 p-5 space-y-4">
            <h2 className="text-sm font-medium text-gray-300 uppercase tracking-wide">{t('account_section')}</h2>

            <div>
              <label className="block text-sm text-gray-400 mb-1">{t('username_label')}</label>
              <input
                className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-gray-100 text-sm focus:outline-none focus:border-blue-500"
                value={form.username}
                onChange={(e) => set('username', e.target.value)}
                required
              />
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-1">{t('password_label')} <span className="text-gray-500 text-xs">{t('password_hint')}</span></label>
              <input
                type="password"
                className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-gray-100 text-sm focus:outline-none focus:border-blue-500"
                value={form.password}
                onChange={(e) => set('password', e.target.value)}
                minLength={6}
                required
              />
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-1">{t('email_label')}</label>
              <input
                type="email"
                className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-gray-100 text-sm focus:outline-none focus:border-blue-500"
                value={form.email}
                onChange={(e) => set('email', e.target.value)}
                placeholder={t('email_placeholder')}
                required
              />
            </div>
          </section>

          <button
            type="submit"
            disabled={saving}
            className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-60 disabled:cursor-not-allowed text-white text-sm font-medium rounded px-4 py-2.5 transition-colors"
          >
            {saving ? t('creating_account') : t('create_account')}
          </button>
        </form>
      </main>
    </div>
  );
}
