export const DEALER_TEMPLATES = ['bold', 'executive', 'atlas', 'night', 'sunset', 'pro'] as const;

export type TemplateName = typeof DEALER_TEMPLATES[number];

export interface Dealer {
  id: number;
  slug: string;
  name: string;
  mobile_url: string | null;
  own: number;
  active: number;
  priority: number;
  mobile_user: string | null;
  mobile_password: string | null;
  cars_url: string | null;
  cars_user: string | null;
  cars_password: string | null;
  public_enabled: number;
  template: TemplateName;
  public_domain: string | null;
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

export interface DealerEditForm {
  name: string;
  slug: string;
  mobile_url: string;
  own: boolean;
  priority: number;
  mobile_user: string;
  mobile_password: string;
  cars_url: string;
  cars_user: string;
  cars_password: string;
  public_enabled: boolean;
  template: TemplateName;
  public_domain: string;
}

export interface DealerCreateForm {
  name: string;
  slug: string;
  mobile_url: string;
  own: boolean;
  priority: number;
  mobile_user: string;
  mobile_password: string;
  cars_url: string;
  cars_user: string;
  cars_password: string;
}
