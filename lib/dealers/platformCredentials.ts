import {
  createEmptyFields,
  createFieldMap,
  getFieldValues,
  pickNullableStringFields,
  pickStringFields,
} from './credentialFieldUtils';

export interface PlatformAccountFields<TValue = string> {
  cars_password: TValue;
  cars_url: TValue;
  cars_user: TValue;
  mobile_password: TValue;
  mobile_url: TValue;
  mobile_user: TValue;
}

export type PlatformTestService = 'carsbg' | 'mobilebg';

export interface PlatformCredentialField {
  adminOnly?: boolean;
  key: keyof PlatformAccountFields;
  label: string;
  placeholder?: string;
  type?: 'password' | 'url';
}

export interface PlatformCredentialSection {
  fields: PlatformCredentialField[];
  icon: string;
  loginResultKey: 'cars.bg' | 'mobile.bg';
  testService: PlatformTestService;
  title: string;
}

export const MOBILE_BG_CREDENTIAL_SECTION: PlatformCredentialSection = {
  title: 'Mobile.bg',
  icon: '🚗',
  testService: 'mobilebg',
  loginResultKey: 'mobile.bg',
  fields: [
    {
      key: 'mobile_url',
      label: 'Listing page URL',
      placeholder: 'https://www.mobile.bg/pcgi/mobile.cgi?act=3&slink=…',
      type: 'url',
      adminOnly: true,
    },
    { key: 'mobile_user', label: 'Username / email', placeholder: 'mobile user' },
    { key: 'mobile_password', label: 'Password', placeholder: 'mobile password', type: 'password' },
  ],
};

export const CARS_BG_CREDENTIAL_SECTION: PlatformCredentialSection = {
  title: 'Cars.bg',
  icon: '🚙',
  testService: 'carsbg',
  loginResultKey: 'cars.bg',
  fields: [
    {
      key: 'cars_url',
      label: 'Listing page URL',
      placeholder: 'https://www.cars.bg/?act=3&slink=…',
      type: 'url',
      adminOnly: true,
    },
    { key: 'cars_user', label: 'Username / email', placeholder: 'cars user' },
    { key: 'cars_password', label: 'Password', placeholder: 'cars password', type: 'password' },
  ],
};

export const PLATFORM_CREDENTIAL_SECTIONS: PlatformCredentialSection[] = [
  MOBILE_BG_CREDENTIAL_SECTION,
  CARS_BG_CREDENTIAL_SECTION,
];

export const PLATFORM_CREDENTIAL_FIELDS = PLATFORM_CREDENTIAL_SECTIONS.flatMap((section) => section.fields);

export const PLATFORM_ACCOUNT_FIELD_KEYS = PLATFORM_CREDENTIAL_FIELDS.map((field) => field.key);

export function getPlatformUrlField(section: PlatformCredentialSection) {
  return section.fields.find((field) => field.type === 'url');
}

export const PLATFORM_URL_FIELD_KEYS = PLATFORM_CREDENTIAL_FIELDS
  .filter((field) => field.type === 'url')
  .map((field) => field.key);

export const PLATFORM_ACCOUNT_COLUMNS = PLATFORM_ACCOUNT_FIELD_KEYS.join(', ');

export const PLATFORM_URL_COLUMNS = PLATFORM_URL_FIELD_KEYS.join(', ');

export const PLATFORM_ACCOUNT_FIELD_MAP = createFieldMap(PLATFORM_ACCOUNT_FIELD_KEYS);

export const PLATFORM_SELF_SERVICE_FIELD_KEYS = PLATFORM_ACCOUNT_FIELD_KEYS.filter(
  (field) => field !== 'mobile_url',
);

export const PLATFORM_SELF_SERVICE_FIELD_MAP = createFieldMap(PLATFORM_SELF_SERVICE_FIELD_KEYS);

export function createEmptyPlatformAccountFields(): PlatformAccountFields {
  return createEmptyFields(PLATFORM_ACCOUNT_FIELD_KEYS) as PlatformAccountFields;
}

export function pickPlatformAccountFields<TSource extends PlatformAccountFields<string | null | undefined>>(
  source: TSource,
): PlatformAccountFields {
  return pickStringFields(PLATFORM_ACCOUNT_FIELD_KEYS, source) as PlatformAccountFields;
}

export function pickNullablePlatformAccountFields(
  source: Partial<Record<keyof PlatformAccountFields, unknown>>,
): PlatformAccountFields<string | null> {
  return pickNullableStringFields(PLATFORM_ACCOUNT_FIELD_KEYS, source) as PlatformAccountFields<string | null>;
}

export function getPlatformAccountValues(source: PlatformAccountFields<string | null>) {
  return getFieldValues(PLATFORM_ACCOUNT_FIELD_KEYS, source);
}
