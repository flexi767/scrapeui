'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { toast } from 'sonner';
import Link from 'next/link';
import { slugifyDealerName } from '@/components/dealers/utils';

export default function DealerRegisterPage() {
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
        <p className="text-gray-400">Admin access required.</p>
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
      toast.error('Name, slug, username and password are required');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/dealers/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json() as { error?: string; id?: number };
      if (!res.ok) { toast.error(data.error ?? 'Failed'); return; }
      toast.success(`Dealer "${form.name}" registered`);
      router.push(`/dealers/${data.id}/credentials`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#111827]">
      <header className="sticky top-0 z-20 border-b border-gray-700/60 bg-[#111827]/95 backdrop-blur-sm">
        <div className="mx-auto max-w-2xl px-4 py-3 flex items-center justify-between">
          <Link href="/config" className="text-sm text-gray-400 hover:text-gray-200 transition-colors">
            ← Config
          </Link>
          <span className="text-sm font-medium text-gray-400">Register Dealer</span>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-8">
        <h1 className="text-xl font-semibold text-gray-100 mb-6">Register New Dealer</h1>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Dealer info */}
          <section className="bg-gray-800 rounded-lg border border-gray-700 p-5 space-y-4">
            <h2 className="text-sm font-medium text-gray-300 uppercase tracking-wide">Dealer Info</h2>

            <div>
              <label className="block text-sm text-gray-400 mb-1">Name *</label>
              <input
                className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-gray-100 text-sm focus:outline-none focus:border-blue-500"
                value={form.name}
                onChange={(e) => handleNameChange(e.target.value)}
                placeholder="M Motors"
                required
              />
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-1">Slug * <span className="text-gray-500 text-xs">(used in public URL)</span></label>
              <input
                className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-gray-100 text-sm focus:outline-none focus:border-blue-500 font-mono"
                value={form.slug}
                onChange={(e) => { setSlugManual(true); set('slug', e.target.value); }}
                placeholder="m-motors"
                pattern="[a-z0-9-]+"
                required
              />
              <p className="text-xs text-gray-500 mt-1">Lowercase letters, numbers, dashes only</p>
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-1">Mobile.bg listing URL</label>
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
                Own listing (we manage this dealer)
              </label>

              <div className="flex items-center gap-2">
                <label className="text-sm text-gray-400">Priority</label>
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
            <h2 className="text-sm font-medium text-gray-300 uppercase tracking-wide">Login Account</h2>
            <p className="text-xs text-gray-500">A user account will be created for the dealer to log in and manage their credentials.</p>

            <div>
              <label className="block text-sm text-gray-400 mb-1">Username *</label>
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
              <label className="block text-sm text-gray-400 mb-1">Password *</label>
              <input
                type="password"
                className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-gray-100 text-sm focus:outline-none focus:border-blue-500"
                value={form.password}
                onChange={(e) => set('password', e.target.value)}
                placeholder="Min 6 characters"
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
              {saving ? 'Registering…' : 'Register Dealer'}
            </button>
            <Link href="/config" className="text-sm text-gray-400 hover:text-gray-200">
              Cancel
            </Link>
          </div>
        </form>
      </main>
    </div>
  );
}
