import type { PlatformAccountFields } from '@/lib/dealers/platformCredentials';
import type { SocialAccountFields } from '@/lib/dealers/socialCredentials';

export const DEALER_TEMPLATES = ['bold', 'executive', 'atlas', 'night', 'sunset', 'pro'] as const;

export type TemplateName = typeof DEALER_TEMPLATES[number];

export interface Dealer extends PlatformAccountFields<string | null>, SocialAccountFields<string | null> {
  id: number;
  slug: string;
  name: string;
  own: number;
  active: number;
  priority: number;
  public_enabled: number;
  template: TemplateName;
  public_domain: string | null;
  active_template_config_id: number | null;
}

export interface LoginResult {
  ok: boolean;
  reason?: string;
}

export interface DealerLoginResult {
  'mobile.bg'?: LoginResult;
  'cars.bg'?: LoginResult;
  error?: string;
}

export interface DealerEditForm extends PlatformAccountFields, SocialAccountFields {
  name: string;
  slug: string;
  own: boolean;
  priority: number;
  public_enabled: boolean;
  template: TemplateName;
  public_domain: string;
}

export interface DealerCreateForm extends PlatformAccountFields, SocialAccountFields {
  name: string;
  slug: string;
  own: boolean;
  priority: number;
}
