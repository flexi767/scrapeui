import { createEmptyPlatformAccountFields, pickPlatformAccountFields } from '@/lib/dealers/platformCredentials';
import { createEmptySocialAccountFields, pickSocialAccountFields } from '@/lib/dealers/socialCredentials';
import type { Dealer, DealerCreateForm, DealerEditForm } from './types';
import { hasHttpProtocol } from './utils';

export function createEmptyDealerForm(): DealerCreateForm {
  return {
    name: '',
    slug: '',
    ...createEmptyPlatformAccountFields(),
    own: false,
    priority: 0,
    ...createEmptySocialAccountFields(),
  };
}

export function createEmptyDealerEditForm(): DealerEditForm {
  return {
    ...createEmptyDealerForm(),
    public_enabled: false,
    template: 'bold',
    public_domain: '',
  };
}

export function dealerToEditForm(dealer: Dealer): DealerEditForm {
  return {
    name: dealer.name,
    slug: dealer.slug,
    own: Boolean(dealer.own),
    priority: dealer.priority || 0,
    ...pickPlatformAccountFields(dealer),
    ...pickSocialAccountFields(dealer),
    public_enabled: dealer.public_enabled === 1,
    template: dealer.template,
    public_domain: dealer.public_domain || '',
  };
}

export function validateDealerUrls(form: Pick<DealerCreateForm, 'mobile_url' | 'cars_url'>) {
  if (!hasHttpProtocol(form.mobile_url)) {
    return 'Mobile URL must start with http:// or https://';
  }

  if (form.cars_url.trim() && !hasHttpProtocol(form.cars_url)) {
    return 'Cars URL must start with http:// or https://';
  }

  return null;
}
