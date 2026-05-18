import {
  createEmptyFields,
  createFieldMap,
  getFieldValues,
  pickNullableStringFields,
  pickStringFields,
} from './credentialFieldUtils';

export interface SocialAccountFields<TValue = string> {
  facebook_password: TValue;
  facebook_user: TValue;
  instagram_password: TValue;
  instagram_user: TValue;
  tiktok_password: TValue;
  tiktok_user: TValue;
}

export interface SocialCredentialField {
  key: keyof SocialAccountFields;
  label: string;
  placeholder?: string;
  type?: 'password';
}

export interface SocialCredentialSection {
  fields: SocialCredentialField[];
  icon: string;
  shortLabel: string;
  title: string;
}

export const SOCIAL_CREDENTIAL_SECTIONS: SocialCredentialSection[] = [
  {
    title: 'Facebook',
    shortLabel: 'fb',
    icon: '📘',
    fields: [
      { key: 'facebook_user', label: 'Email / Username', placeholder: 'facebook user' },
      { key: 'facebook_password', label: 'Password', placeholder: 'facebook password', type: 'password' },
    ],
  },
  {
    title: 'Instagram',
    shortLabel: 'ig',
    icon: '📷',
    fields: [
      { key: 'instagram_user', label: 'Username', placeholder: 'instagram user' },
      { key: 'instagram_password', label: 'Password', placeholder: 'instagram password', type: 'password' },
    ],
  },
  {
    title: 'TikTok',
    shortLabel: 'tt',
    icon: '🎵',
    fields: [
      { key: 'tiktok_user', label: 'Username', placeholder: 'tiktok user' },
      { key: 'tiktok_password', label: 'Password', placeholder: 'tiktok password', type: 'password' },
    ],
  },
];

export const SOCIAL_CREDENTIAL_FIELDS = SOCIAL_CREDENTIAL_SECTIONS.flatMap((section) => section.fields);

export const SOCIAL_ACCOUNT_FIELD_KEYS = SOCIAL_CREDENTIAL_FIELDS.map((field) => field.key);

export const SOCIAL_ACCOUNT_COLUMNS = SOCIAL_ACCOUNT_FIELD_KEYS.join(', ');

export const SOCIAL_ACCOUNT_FIELD_MAP = createFieldMap(SOCIAL_ACCOUNT_FIELD_KEYS);

export function createEmptySocialAccountFields(): SocialAccountFields {
  return createEmptyFields(SOCIAL_ACCOUNT_FIELD_KEYS) as SocialAccountFields;
}

export function pickSocialAccountFields<TSource extends SocialAccountFields<string | null | undefined>>(
  source: TSource,
): SocialAccountFields {
  return pickStringFields(SOCIAL_ACCOUNT_FIELD_KEYS, source) as SocialAccountFields;
}

export function pickNullableSocialAccountFields(
  source: Partial<Record<keyof SocialAccountFields, unknown>>,
): SocialAccountFields<string | null> {
  return pickNullableStringFields(SOCIAL_ACCOUNT_FIELD_KEYS, source) as SocialAccountFields<string | null>;
}

export function getSocialAccountValues(source: SocialAccountFields<string | null>) {
  return getFieldValues(SOCIAL_ACCOUNT_FIELD_KEYS, source);
}
