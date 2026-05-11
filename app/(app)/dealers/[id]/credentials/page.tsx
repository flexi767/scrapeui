'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { toast } from 'sonner';
import Link from 'next/link';
import { CheckCircle, XCircle, Loader2, ExternalLink } from 'lucide-react';

const TEMPLATES = ['bold', 'executive', 'atlas', 'night', 'sunset', 'pro'] as const;

interface DealerCreds {
  id: number;
  slug: string;
  name: string;
  mobile_url: string | null;
  mobile_user: string | null;
  mobile_password: string | null;
  cars_url: string | null;
  cars_user: string | null;
  cars_password: string | null;
  facebook_user: string | null;
  facebook_password: string | null;
  instagram_user: string | null;
  instagram_password: string | null;
  tiktok_user: string | null;
  tiktok_password: string | null;
  public_enabled: number;
  template: string;
  public_domain: string | null;
}

type TestStatus = 'idle' | 'testing' | 'ok' | 'fail';

interface PlatformTestResult {
  ok: boolean;
  reason?: string;
}

function StatusIcon({ status, reason }: { status: TestStatus; reason?: string }) {
  if (status === 'testing') return <Loader2 className="h-4 w-4 animate-spin text-blue-400" />;
  if (status === 'ok') return <CheckCircle className="h-4 w-4 text-green-400" aria-label="Login successful" />;
  if (status === 'fail') return <XCircle className="h-4 w-4 text-red-400" aria-label={reason ?? 'Failed'} />;
  return null;
}

function CredentialSection({
  title, icon, fields, values, onChange, onTest, testStatus, testReason, testable = true,
}: {
  title: string;
  icon: string;
  fields: { key: string; label: string; type?: string; placeholder?: string }[];
  values: Record<string, string>;
  onChange: (key: string, val: string) => void;
  onTest?: () => void;
  testStatus?: TestStatus;
  testReason?: string;
  testable?: boolean;
}) {
  return (
    <section className="bg-gray-800 rounded-lg border border-gray-700 p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-200">
          <span className="text-base">{icon}</span> {title}
        </h2>
        {testable && onTest && (
          <button
            type="button"
            onClick={onTest}
            disabled={testStatus === 'testing'}
            className="flex items-center gap-1.5 px-3 py-1 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 text-xs text-gray-300 rounded transition-colors"
          >
            {testStatus === 'testing' ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
            Test login
            {testStatus && testStatus !== 'testing' && (
              <StatusIcon status={testStatus} reason={testReason} />
            )}
          </button>
        )}
      </div>
      {fields.map((f) => (
        <div key={f.key}>
          <label className="block text-xs text-gray-400 mb-1">{f.label}</label>
          <input
            type={f.type ?? 'text'}
            className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-gray-100 text-sm focus:outline-none focus:border-blue-500"
            value={values[f.key] ?? ''}
            onChange={(e) => onChange(f.key, e.target.value)}
            placeholder={f.placeholder}
            autoComplete="off"
          />
        </div>
      ))}
    </section>
  );
}

export default function DealerCredentialsPage() {
  const { data: session, status: sessionStatus } = useSession();
  const params = useParams();
  const dealerId = Number(params.id);

  const [dealer, setDealer] = useState<DealerCreds | null>(null);
  const [form, setForm] = useState<Record<string, string>>({});
  const [publicForm, setPublicForm] = useState({ public_enabled: false, template: 'bold', public_domain: '' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [testStatus, setTestStatus] = useState<Record<string, TestStatus>>({});
  const [testReason, setTestReason] = useState<Record<string, string>>({});

  const isAdmin = session?.user.role === 'admin';

  const load = useCallback(async () => {
    const res = await fetch(`/api/dealers/${dealerId}/credentials`);
    if (!res.ok) { toast.error('Could not load dealer'); return; }
    const data = await res.json() as DealerCreds;
    setDealer(data);
    setForm({
      mobile_user: data.mobile_user ?? '',
      mobile_password: data.mobile_password ?? '',
      cars_url: data.cars_url ?? '',
      cars_user: data.cars_user ?? '',
      cars_password: data.cars_password ?? '',
      facebook_user: data.facebook_user ?? '',
      facebook_password: data.facebook_password ?? '',
      instagram_user: data.instagram_user ?? '',
      instagram_password: data.instagram_password ?? '',
      tiktok_user: data.tiktok_user ?? '',
      tiktok_password: data.tiktok_password ?? '',
      mobile_url: data.mobile_url ?? '',
    });
    setPublicForm({
      public_enabled: data.public_enabled === 1,
      template: data.template ?? 'bold',
      public_domain: data.public_domain ?? '',
    });
    setLoading(false);
  }, [dealerId]);

  useEffect(() => { if (sessionStatus !== 'loading') load(); }, [load, sessionStatus]);

  if (sessionStatus === 'loading' || loading) {
    return (
      <div className="min-h-screen bg-[#111827] flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    );
  }

  // Access check: dealer user must own this dealer, admin can see all
  if (!isAdmin && session?.user.dealerId !== dealerId) {
    return (
      <div className="min-h-screen bg-[#111827] flex items-center justify-center">
        <p className="text-gray-400">Access denied.</p>
      </div>
    );
  }

  async function saveSection(keys: string[], sectionName: string) {
    const payload: Record<string, string | null> = {};
    for (const k of keys) payload[k] = form[k] || null;
    setSaving(sectionName);
    try {
      const res = await fetch(`/api/dealers/${dealerId}/credentials`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json() as { error?: string };
      if (!res.ok) { toast.error(data.error ?? 'Save failed'); return; }
      toast.success(`${sectionName} saved`);
    } finally {
      setSaving(null);
    }
  }

  async function savePublic() {
    setSaving('public');
    try {
      const res = await fetch(`/api/dealers/${dealerId}/credentials`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          public_enabled: publicForm.public_enabled,
          template: publicForm.template,
          public_domain: publicForm.public_domain || null,
        }),
      });
      const data = await res.json() as { error?: string };
      if (!res.ok) { toast.error(data.error ?? 'Save failed'); return; }
      toast.success('Public page settings saved');
      await load();
    } finally {
      setSaving(null);
    }
  }

  async function testLogin(service: 'mobilebg' | 'carsbg') {
    setTestStatus((s) => ({ ...s, [service]: 'testing' }));
    try {
      const res = await fetch('/api/dealers/test-logins', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: [dealerId] }),
      });
      const data = await res.json() as Record<number, Record<string, PlatformTestResult>>;
      const result = data[dealerId];
      const key = service === 'mobilebg' ? 'mobile.bg' : 'cars.bg';
      const r = result?.[key];
      if (r?.ok) {
        setTestStatus((s) => ({ ...s, [service]: 'ok' }));
        toast.success(`${key} login OK`);
      } else {
        setTestStatus((s) => ({ ...s, [service]: 'fail' }));
        setTestReason((s) => ({ ...s, [service]: r?.reason ?? 'Login failed' }));
        toast.error(`${key} login failed: ${r?.reason ?? 'unknown'}`);
      }
    } catch {
      setTestStatus((s) => ({ ...s, [service]: 'fail' }));
      toast.error('Test failed');
    }
  }

  const f = form;
  const setField = (key: string, val: string) => setForm((prev) => ({ ...prev, [key]: val }));
  const publicUrl = dealer ? `/d/${dealer.slug}` : null;

  return (
    <div className="min-h-screen bg-[#111827]">
      <header className="sticky top-0 z-20 border-b border-gray-700/60 bg-[#111827]/95 backdrop-blur-sm">
        <div className="mx-auto max-w-2xl px-4 py-3 flex items-center justify-between">
          <Link href={isAdmin ? '/config' : '/'} className="text-sm text-gray-400 hover:text-gray-200 transition-colors">
            ← {isAdmin ? 'Config' : 'Home'}
          </Link>
          <span className="text-sm font-medium text-gray-200">{dealer?.name ?? '…'} — Settings</span>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-8 space-y-6">

        {/* Mobile.bg */}
        <div className="space-y-2">
          <CredentialSection
            title="Mobile.bg"
            icon="🚗"
            fields={[
              ...(isAdmin ? [{ key: 'mobile_url', label: 'Listing page URL', placeholder: 'https://www.mobile.bg/pcgi/mobile.cgi?act=3&slink=…' }] : []),
              { key: 'mobile_user', label: 'Username / email' },
              { key: 'mobile_password', label: 'Password', type: 'password', placeholder: '••••••' },
            ]}
            values={f}
            onChange={setField}
            onTest={() => testLogin('mobilebg')}
            testStatus={testStatus.mobilebg}
            testReason={testReason.mobilebg}
          />
          <div className="flex justify-end">
            <button
              onClick={() => saveSection(['mobile_url', 'mobile_user', 'mobile_password'], 'Mobile.bg')}
              disabled={saving === 'Mobile.bg'}
              className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm rounded transition-colors"
            >
              {saving === 'Mobile.bg' ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>

        {/* Cars.bg */}
        <div className="space-y-2">
          <CredentialSection
            title="Cars.bg"
            icon="🚙"
            fields={[
              ...(isAdmin ? [{ key: 'cars_url', label: 'Listing page URL', placeholder: 'https://www.cars.bg/?act=3&slink=…' }] : []),
              { key: 'cars_user', label: 'Username / email' },
              { key: 'cars_password', label: 'Password', type: 'password', placeholder: '••••••' },
            ]}
            values={f}
            onChange={setField}
            onTest={() => testLogin('carsbg')}
            testStatus={testStatus.carsbg}
            testReason={testReason.carsbg}
          />
          <div className="flex justify-end">
            <button
              onClick={() => saveSection(['cars_url', 'cars_user', 'cars_password'], 'Cars.bg')}
              disabled={saving === 'Cars.bg'}
              className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm rounded transition-colors"
            >
              {saving === 'Cars.bg' ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>

        {/* Facebook */}
        <div className="space-y-2">
          <CredentialSection
            title="Facebook"
            icon="📘"
            fields={[
              { key: 'facebook_user', label: 'Email / Username' },
              { key: 'facebook_password', label: 'Password', type: 'password', placeholder: '••••••' },
            ]}
            values={f}
            onChange={setField}
            testable={false}
          />
          <div className="flex justify-end">
            <button
              onClick={() => saveSection(['facebook_user', 'facebook_password'], 'Facebook')}
              disabled={saving === 'Facebook'}
              className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm rounded transition-colors"
            >
              {saving === 'Facebook' ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>

        {/* Instagram */}
        <div className="space-y-2">
          <CredentialSection
            title="Instagram"
            icon="📷"
            fields={[
              { key: 'instagram_user', label: 'Username' },
              { key: 'instagram_password', label: 'Password', type: 'password', placeholder: '••••••' },
            ]}
            values={f}
            onChange={setField}
            testable={false}
          />
          <div className="flex justify-end">
            <button
              onClick={() => saveSection(['instagram_user', 'instagram_password'], 'Instagram')}
              disabled={saving === 'Instagram'}
              className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm rounded transition-colors"
            >
              {saving === 'Instagram' ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>

        {/* TikTok */}
        <div className="space-y-2">
          <CredentialSection
            title="TikTok"
            icon="🎵"
            fields={[
              { key: 'tiktok_user', label: 'Username' },
              { key: 'tiktok_password', label: 'Password', type: 'password', placeholder: '••••••' },
            ]}
            values={f}
            onChange={setField}
            testable={false}
          />
          <div className="flex justify-end">
            <button
              onClick={() => saveSection(['tiktok_user', 'tiktok_password'], 'TikTok')}
              disabled={saving === 'TikTok'}
              className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm rounded transition-colors"
            >
              {saving === 'TikTok' ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>

        {/* Public page — admin only */}
        {isAdmin && (
          <div className="space-y-2">
            <section className="bg-gray-800 rounded-lg border border-gray-700 p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-200">
                  <span className="text-base">🌐</span> Public Page
                </h2>
                {publicUrl && publicForm.public_enabled && (
                  <a
                    href={publicUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300"
                  >
                    Preview <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>

              <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
                <input
                  type="checkbox"
                  className="rounded border-gray-600"
                  checked={publicForm.public_enabled}
                  onChange={(e) => setPublicForm((p) => ({ ...p, public_enabled: e.target.checked }))}
                />
                Enable public listing page
              </label>

              {publicForm.public_enabled && (
                <>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Public URL</label>
                    <div className="text-sm text-blue-400 bg-gray-700/50 rounded px-3 py-2 font-mono">
                      {typeof window !== 'undefined' ? window.location.origin : ''}/d/{dealer?.slug}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Template</label>
                    <select
                      className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-gray-100 text-sm focus:outline-none focus:border-blue-500"
                      value={publicForm.template}
                      onChange={(e) => setPublicForm((p) => ({ ...p, template: e.target.value }))}
                    >
                      {TEMPLATES.map((t) => (
                        <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Custom domain <span className="text-gray-500">(optional)</span></label>
                    <input
                      className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-gray-100 text-sm focus:outline-none focus:border-blue-500"
                      value={publicForm.public_domain}
                      onChange={(e) => setPublicForm((p) => ({ ...p, public_domain: e.target.value }))}
                      placeholder="cars.example.com"
                    />
                  </div>
                </>
              )}
            </section>
            <div className="flex justify-end">
              <button
                onClick={savePublic}
                disabled={saving === 'public'}
                className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm rounded transition-colors"
              >
                {saving === 'public' ? 'Saving…' : 'Save public settings'}
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
