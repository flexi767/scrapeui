import type { SearchField, SearchPrefillResponse } from './types';

export function submitMobileBgSearchForm(
  formConfig: SearchPrefillResponse['form'] | null | undefined,
  fields: SearchField[],
) {
  if (!formConfig || typeof document === 'undefined') return;
  const form = document.createElement('form');
  form.method = formConfig.method;
  form.action = formConfig.action;
  form.target = '_blank';
  form.acceptCharset = 'windows-1251';

  for (const field of fields) {
    const input = document.createElement('input');
    input.type = 'hidden';
    input.name = field.name;
    input.value = field.value;
    form.appendChild(input);
  }

  document.body.appendChild(form);
  form.submit();
  form.remove();
}

