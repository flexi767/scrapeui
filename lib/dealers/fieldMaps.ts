import {
  PLATFORM_ACCOUNT_FIELD_MAP,
  PLATFORM_SELF_SERVICE_FIELD_MAP,
} from './platformCredentials';
import { SOCIAL_ACCOUNT_FIELD_MAP } from './socialCredentials';

export const DEALER_CORE_FIELD_MAP: Record<string, string> = {
  active: 'active',
  name: 'name',
  own: 'own',
  priority: 'priority',
  slug: 'slug',
};

export const DEALER_PUBLIC_FIELD_MAP: Record<string, string> = {
  public_domain: 'public_domain',
  public_enabled: 'public_enabled',
  template: 'template',
};

export const DEALER_ADMIN_FIELD_MAP: Record<string, string> = {
  ...DEALER_CORE_FIELD_MAP,
  ...PLATFORM_ACCOUNT_FIELD_MAP,
  ...SOCIAL_ACCOUNT_FIELD_MAP,
  ...DEALER_PUBLIC_FIELD_MAP,
};

export const DEALER_SELF_SERVICE_CREDENTIAL_FIELD_MAP: Record<string, string> = {
  ...PLATFORM_SELF_SERVICE_FIELD_MAP,
  ...SOCIAL_ACCOUNT_FIELD_MAP,
};

export const DEALER_ADMIN_CREDENTIAL_FIELD_MAP: Record<string, string> = {
  ...DEALER_SELF_SERVICE_CREDENTIAL_FIELD_MAP,
  mobile_url: 'mobile_url',
  ...DEALER_PUBLIC_FIELD_MAP,
};
