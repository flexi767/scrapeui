export const DEALER_TEMPLATES = ['bold', 'executive', 'atlas', 'night', 'sunset', 'pro'] as const;
export type DealerTemplate = (typeof DEALER_TEMPLATES)[number];

export const ALLOWED_TEMPLATES = new Set<string>(DEALER_TEMPLATES);
