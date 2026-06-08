import {
  pickSocialAccountFields,
  type SocialAccountFields,
} from '@/lib/dealers/socialCredentials';
import {
  PLATFORM_CREDENTIAL_SECTIONS,
  pickPlatformAccountFields,
  type PlatformAccountFields,
  type PlatformTestService,
} from '@/lib/dealers/platformCredentials';
import { apiRequest } from '@/lib/utils';

export interface DealerCreds extends PlatformAccountFields<string | null>, SocialAccountFields<string | null> {
  id: number;
  slug: string;
  name: string;
  public_enabled: number;
  template: string;
  public_domain: string | null;
  public_content: string | null;
}

export const CONTENT_PAGES = [
  { key: 'about', label: 'About', placeholder: 'Tell visitors about your dealership. Leave blank to use the default text.' },
  { key: 'finance', label: 'Financing', placeholder: 'Describe your finance options. Leave blank to use the default text.' },
  { key: 'privacy', label: 'Privacy Policy', placeholder: 'Your privacy policy. Leave blank to use the default text.' },
  { key: 'terms', label: 'Terms & Conditions', placeholder: 'Your terms. Leave blank to use the default text.' },
] as const;

export type ContentForm = Record<(typeof CONTENT_PAGES)[number]['key'], string>;

export const EMPTY_CONTENT: ContentForm = { about: '', finance: '', privacy: '', terms: '' };

export interface PlatformTestResult {
  ok: boolean;
  reason?: string;
}

export function getCredentialForm(dealer: DealerCreds): Record<string, string> {
  return {
    ...pickPlatformAccountFields(dealer),
    ...pickSocialAccountFields(dealer),
  };
}

export function getPublicForm(dealer: DealerCreds) {
  return {
    public_enabled: dealer.public_enabled === 1,
    template: dealer.template ?? 'bold',
    public_domain: dealer.public_domain ?? '',
  };
}

export function parseContentForm(publicContent: string | null): ContentForm {
  let parsedContent: Partial<ContentForm> = {};
  if (publicContent) {
    try {
      parsedContent = JSON.parse(publicContent) as Partial<ContentForm>;
    } catch {
      parsedContent = {};
    }
  }
  return {
    about: parsedContent.about ?? '',
    finance: parsedContent.finance ?? '',
    privacy: parsedContent.privacy ?? '',
    terms: parsedContent.terms ?? '',
  };
}

export function buildPublicContentPayload(contentForm: ContentForm): string | null {
  const payload: Record<string, string> = {};
  for (const { key } of CONTENT_PAGES) {
    const value = contentForm[key].trim();
    if (value) payload[key] = value;
  }
  return Object.keys(payload).length ? JSON.stringify(payload) : null;
}

export async function fetchDealerCredentials(dealerId: number) {
  return apiRequest<DealerCreds>(`/api/dealers/${dealerId}/credentials`, 'Could not load dealer');
}

export async function patchDealerCredentials(dealerId: number, payload: Record<string, unknown>) {
  return apiRequest<unknown>(`/api/dealers/${dealerId}/credentials`, 'Save failed', {
    method: 'PATCH',
    json: payload,
  });
}

export async function testDealerCredentialLogin(dealerId: number, service: PlatformTestService) {
  const data = await apiRequest<Record<number, Record<string, PlatformTestResult>>>(
    '/api/dealers/test-logins',
    'Test failed',
    {
      method: 'POST',
      json: { ids: [dealerId] },
    },
  );
  const key = PLATFORM_CREDENTIAL_SECTIONS.find((section) => section.testService === service)?.loginResultKey;
  return key ? { key, result: data[dealerId]?.[key] } : null;
}
