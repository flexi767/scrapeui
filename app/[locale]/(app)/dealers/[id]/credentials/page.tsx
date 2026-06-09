
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { toast } from 'sonner';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { CheckCircle, XCircle, Loader2, ExternalLink } from 'lucide-react';
import {
  SOCIAL_CREDENTIAL_SECTIONS,
  type SocialCredentialField,
} from '@/lib/dealers/socialCredentials';
import {
  PLATFORM_CREDENTIAL_SECTIONS,
  type PlatformCredentialField,
  type PlatformTestService,
} from '@/lib/dealers/platformCredentials';
import { DEALER_TEMPLATES as TEMPLATES } from '@/lib/dealer-config';
import {
  buildPublicContentPayload,
  CONTENT_PAGES,
  EMPTY_CONTENT,
  fetchDealerCredentials,
  getCredentialForm,
  getPublicForm,
  parseContentForm,
  patchDealerCredentials,
  testDealerCredentialLogin,
  type ContentForm,
  type DealerCreds,
} from '@/components/dealers/credentials-api';
import { errorMessage } from '@/lib/utils';

type TestStatus = 'idle' | 'testing' | 'ok' | 'fail';

type CredentialField = PlatformCredentialField | SocialCredentialField | {
  key: string;
  label: string;
  placeholder?: string;
  type?: 'password' | 'url';
};

function StatusIcon({ status, reason }: { status: TestStatus; reason?: string }) {
  if (status === 'testing') return <Loader2 className="h-4 w-4 animate-spin text-blue-400" />;
  if (status === 'ok') return <CheckCircle className="h-4 w-4 text-green-400" aria-label="Login successful" />;
  if (status === 'fail') return <XCircle className="h-4 w-4 text-red-400" aria-label={reason ?? 'Failed'} />;
  return null;
}

function CredentialSection({
  title, icon, fields, values, onChange, onTest, testStatus, testReason, testable = true, testLoginLabel,
}: {
  title: string;
  icon: string;
  fields: CredentialField[];
  values: Record<string, string>;
  onChange: (key: string, val: string) => void;
  onTest?: () => void;
  testStatus?: TestStatus;
  testReason?: string;
  testable?: boolean;
  testLoginLabel?: string;
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
            {testLoginLabel ?? 'Test login'}
            {testStatus && testStatus !== 'testing' && (
              <StatusIcon status={testStatus} reason={testReason} />
            )}
          </button>
        )}
      </div>
      {fields.map((f) => (
        <div key={f.key}>
          <label htmlFor={`dealer-credential-${f.key}`} className="block text-xs text-gray-400 mb-1">{f.label}</label>
          <input
            id={`dealer-credential-${f.key}`}
            type={f.type ?? 'text'}
            className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-gray-100 text-sm focus:outline-none focus:border-blue-500"
            value={values[f.key] ?? ''}
            onChange={(e) => onChange(f.key, e.target.value)}
            placeholder={f.type === 'password' ? '••••••' : f.placeholder}
            autoComplete="off"
          />
        </div>
      ))}
    </section>
  );
}

function CredentialSectionWithSave({
  title,
  icon,
  fields,
  values,
  onChange,
  onSave,
  saving,
  onTest,
  testStatus,
  testReason,
  testable,
  saveLabel,
  savingLabel,
  testLoginLabel,
}: {
  title: string;
  icon: string;
  fields: CredentialField[];
  values: Record<string, string>;
  onChange: (key: string, val: string) => void;
  onSave: () => void;
  saving: boolean;
  onTest?: () => void;
  testStatus?: TestStatus;
  testReason?: string;
  testable?: boolean;
  saveLabel?: string;
  savingLabel?: string;
  testLoginLabel?: string;
}) {
  return (
    <div className="space-y-2">
      <CredentialSection
        title={title}
        icon={icon}
        fields={fields}
        values={values}
        onChange={onChange}
        onTest={onTest}
        testStatus={testStatus}
        testReason={testReason}
        testable={testable}
        testLoginLabel={testLoginLabel}
      />
      <div className="flex justify-end">
        <button
          onClick={onSave}
          disabled={saving}
          className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm rounded transition-colors"
        >
          {saving ? (savingLabel ?? 'Saving…') : (saveLabel ?? 'Save')}
        </button>
      </div>
    </div>
  );
}

export default function DealerCredentialsPage() {
  const t = useTranslations('ui');
  const { data: session, status: sessionStatus } = useSession();
  const params = useParams();
  const dealerId = Number(params.id);

  const [dealer, setDealer] = useState<DealerCreds | null>(null);
  const [form, setForm] = useState<Record<string, string>>({});
  const [publicForm, setPublicForm] = useState({ public_enabled: false, template: 'bold', public_domain: '' });
  const [contentForm, setContentForm] = useState<ContentForm>(EMPTY_CONTENT);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [testStatus, setTestStatus] = useState<Record<string, TestStatus>>({});
  const [testReason, setTestReason] = useState<Record<string, string>>({});
  const [dealerUser, setDealerUser] = useState<{ id: number; username: string } | null>(null);

  const isAdmin = session?.user.role === 'admin';

  const load = useCallback(async () => {
    try {
      const data = await fetchDealerCredentials(dealerId);
      setDealer(data);
      setForm(getCredentialForm(data));
      setPublicForm(getPublicForm(data));
      setContentForm(parseContentForm(data.public_content));
    } catch (error) {
      toast.error(errorMessage(error, 'Could not load dealer'));
    } finally {
      setLoading(false);
    }
  }, [dealerId]);

  useEffect(() => { if (sessionStatus !== 'loading') load(); }, [load, sessionStatus]);

  useEffect(() => {
    if (sessionStatus !== 'loading' && session?.user.role === 'admin') {
      fetch(`/api/dealers/${dealerId}/user`)
        .then((r) => r.ok ? r.json() : null)
        .then((data) => { if (data) setDealerUser(data as { id: number; username: string }); })
        .catch(() => { /* no user linked — silently ignore */ });
    }
  }, [dealerId, sessionStatus, session?.user.role]);

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
        <p className="text-gray-400">{t('access_denied')}</p>
      </div>
    );
  }

  async function saveSection(keys: string[], sectionName: string) {
    const payload: Record<string, string | null> = {};
    for (const k of keys) payload[k] = form[k] || null;
    setSaving(sectionName);
    try {
      await patchDealerCredentials(dealerId, payload);
      toast.success(`${sectionName} saved`);
    } catch (error) {
      toast.error(errorMessage(error, 'Save failed'));
    } finally {
      setSaving(null);
    }
  }

  async function savePublic() {
    setSaving('public');
    try {
      await patchDealerCredentials(dealerId, {
        public_enabled: publicForm.public_enabled,
        template: publicForm.template,
        public_domain: publicForm.public_domain || null,
      });
      toast.success(t('public_page_settings_saved'));
      await load();
    } catch (error) {
      toast.error(errorMessage(error, 'Save failed'));
    } finally {
      setSaving(null);
    }
  }

  async function saveContent() {
    setSaving('content');
    try {
      await patchDealerCredentials(dealerId, {
        public_content: buildPublicContentPayload(contentForm),
      });
      toast.success(t('page_content_saved'));
      await load();
    } catch (error) {
      toast.error(errorMessage(error, 'Save failed'));
    } finally {
      setSaving(null);
    }
  }

  async function testLogin(service: PlatformTestService) {
    setTestStatus((s) => ({ ...s, [service]: 'testing' }));
    try {
      const test = await testDealerCredentialLogin(dealerId, service);
      if (!test) return;
      const r = test.result;
      if (r?.ok) {
        setTestStatus((s) => ({ ...s, [service]: 'ok' }));
        toast.success(`${test.key} login OK`);
      } else {
        setTestStatus((s) => ({ ...s, [service]: 'fail' }));
        setTestReason((s) => ({ ...s, [service]: r?.reason ?? 'Login failed' }));
        toast.error(`${test.key} login failed: ${r?.reason ?? 'unknown'}`);
      }
    } catch (error) {
      setTestStatus((s) => ({ ...s, [service]: 'fail' }));
      toast.error(errorMessage(error, 'Test failed'));
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
            ← {isAdmin ? t('config') : t('home')}
          </Link>
          <span className="text-sm font-medium text-gray-200">{dealer?.name ?? '…'} — {t('settings')}</span>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-8 space-y-6">
        {isAdmin && dealerUser && (
          <Link
            href={`/dealers/${dealerId}/users/${dealerUser.id}/permissions`}
            className="text-sm text-blue-400 hover:text-blue-300 underline"
          >
            Manage page permissions for {dealerUser.username}
          </Link>
        )}

        {PLATFORM_CREDENTIAL_SECTIONS.map((section) => (
          <CredentialSectionWithSave
            key={section.title}
            title={section.title}
            icon={section.icon}
            fields={section.fields.filter((field) => isAdmin || !field.adminOnly)}
            values={f}
            onChange={setField}
            onSave={() => saveSection(section.fields.map((field) => field.key), section.title)}
            saving={saving === section.title}
            onTest={() => testLogin(section.testService)}
            testStatus={testStatus[section.testService]}
            testReason={testReason[section.testService]}
            saveLabel={t('save')}
            savingLabel={t('saving')}
            testLoginLabel={t('test_login')}
          />
        ))}

        {SOCIAL_CREDENTIAL_SECTIONS.map((section) => (
          <CredentialSectionWithSave
            key={section.title}
            title={section.title}
            icon={section.icon}
            fields={section.fields}
            values={f}
            onChange={setField}
            onSave={() => saveSection(section.fields.map((field) => field.key), section.title)}
            saving={saving === section.title}
            testable={false}
            saveLabel={t('save')}
            savingLabel={t('saving')}
          />
        ))}

        {/* Public page — admin only */}
        {isAdmin && (
          <div className="space-y-2">
            <section className="bg-gray-800 rounded-lg border border-gray-700 p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-200">
                  <span className="text-base">🌐</span> {t('public_page')}
                </h2>
                {publicUrl && publicForm.public_enabled && (
                  <a
                    href={publicUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300"
                  >
                    {t('preview')} <ExternalLink className="h-3 w-3" />
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
                {t('enable_public_listing_page')}
              </label>

              {publicForm.public_enabled && (
                <>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">{t('public_url')}</label>
                    <div className="text-sm text-blue-400 bg-gray-700/50 rounded px-3 py-2 font-mono">
                      {typeof window !== 'undefined' ? window.location.origin : ''}/d/{dealer?.slug}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs text-gray-400 mb-1">{t('template')}</label>
                    <select
                      className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-gray-100 text-sm focus:outline-none focus:border-blue-500"
                      value={publicForm.template}
                      onChange={(e) => setPublicForm((p) => ({ ...p, template: e.target.value }))}
                    >
                      {TEMPLATES.map((tmpl) => (
                        <option key={tmpl} value={tmpl}>{tmpl.charAt(0).toUpperCase() + tmpl.slice(1)}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs text-gray-400 mb-1">{t('custom_domain')} <span className="text-gray-500">({t('optional')})</span></label>
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
                {saving === 'public' ? t('saving') : t('save_public_settings')}
              </button>
            </div>
          </div>
        )}

        {/* Page content — editable per-dealer copy for the public inner pages */}
        {publicForm.public_enabled && (
          <div className="space-y-2">
            <section className="bg-gray-800 rounded-lg border border-gray-700 p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-200">
                  <span className="text-base">📝</span> {t('page_content')}
                </h2>
                {publicUrl && (
                  <a
                    href={`${publicUrl}/about`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300"
                  >
                    {t('view_pages')} <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>
              <p className="text-xs text-gray-500">
                {t('page_content_description')}
              </p>
              {CONTENT_PAGES.map((page) => (
                <div key={page.key}>
                  <label htmlFor={`dealer-content-${page.key}`} className="block text-xs text-gray-400 mb-1">{page.label}</label>
                  <textarea
                    id={`dealer-content-${page.key}`}
                    rows={5}
                    className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-gray-100 text-sm focus:outline-none focus:border-blue-500 resize-y"
                    value={contentForm[page.key]}
                    onChange={(e) => setContentForm((c) => ({ ...c, [page.key]: e.target.value }))}
                    placeholder={page.placeholder}
                  />
                </div>
              ))}
            </section>
            <div className="flex justify-end">
              <button
                onClick={saveContent}
                disabled={saving === 'content'}
                className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm rounded transition-colors"
              >
                {saving === 'content' ? t('saving') : t('save_page_content')}
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
