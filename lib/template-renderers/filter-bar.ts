import React from 'react';
import type { PublicListingFilters } from '@/lib/query-modules/public';

interface FilterBarData {
  makes?: string[];
  filters?: PublicListingFilters;
}

export function renderFilterBar(
  { backgroundColor, layout, showMake, showFuel, showYear, showPrice }: Record<string, unknown>,
  data: FilterBarData,
) {
  const makes = data.makes ?? [];
  const filters = data.filters ?? {};
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 30 }, (_, index) => currentYear - index);
  const fuelTypes = ['Бензин', 'Дизел', 'Електро', 'Хибрид', 'Газ / Бензин', 'LPG / Бензин'];
  const inputStyle = { padding: '6px 12px', borderRadius: 6, border: '1px solid #e2e8f0', fontSize: 13, background: '#fff', minWidth: 120 };
  const select = (name: string, placeholder: string, options: string[], current?: string) =>
    React.createElement('select', {
      key: name, name, defaultValue: current ?? '', style: inputStyle,
    },
      React.createElement('option', { value: '' }, placeholder),
      ...options.map((option) => React.createElement('option', { key: option, value: option }, option)),
    );

  const elements: React.ReactElement[] = [];
  if (showMake !== false) elements.push(select('make', 'Any Make', makes, filters.make));
  if (showFuel !== false) elements.push(select('fuel', 'Any Fuel', fuelTypes, filters.fuel));
  if (showYear !== false) {
    elements.push(select('yearFrom', 'Year from', years.map(String), filters.yearFrom));
    elements.push(select('yearTo', 'Year to', years.map(String), filters.yearTo));
  }
  if (showPrice !== false) {
    elements.push(React.createElement('input', { key: 'priceMax', type: 'number', name: 'priceMax', placeholder: 'Max price (€)', defaultValue: filters.priceMax ?? '', style: { ...inputStyle, minWidth: 140 } }));
  }
  elements.push(React.createElement('input', { key: 'submit', type: 'submit', value: 'Filter', style: { padding: '6px 16px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 13 } }));

  return React.createElement('form', {
    method: 'GET',
    style: { backgroundColor: backgroundColor ?? '#f8fafc', padding: '12px 16px', display: 'flex', flexDirection: layout === 'vertical' ? 'column' : 'row', gap: 8, flexWrap: 'wrap', alignItems: 'center' },
  }, ...elements);
}

