/**
 * Standard car colors as used on mobile.bg (Цвят field).
 */

export const MOBILE_BG_COLORS = [
  'Бял',
  'Черен',
  'Сребрист',
  'Сив',
  'Червен',
  'Тъмночервен',
  'Оранжев',
  'Жълт',
  'Зелен',
  'Тъмнозелен',
  'Син',
  'Тъмносин',
  'Виолетов',
  'Кафяв',
  'Бежов',
  'Злат',
  'Бордо',
  'Перла',
  'Металик',
  'Друг',
] as const;

export type MobileBgColor = typeof MOBILE_BG_COLORS[number];
