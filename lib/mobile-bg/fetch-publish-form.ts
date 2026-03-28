import type { Page } from 'playwright';

export interface FormFieldSelect {
  type: 'select';
  options: { value: string; label: string; selected: boolean }[];
  current: string;
}

export interface FormFieldRadioCheckbox {
  type: 'radio' | 'checkbox';
  options: { value: string; checked: boolean; label: string }[];
}

export interface FormFieldInput {
  type: string;
  current: string;
}

export type FormField = FormFieldSelect | FormFieldRadioCheckbox | FormFieldInput;
export type PublishFormFields = Record<string, FormField>;

export async function fetchPublishForm(page: Page, mobileId?: string | null): Promise<PublishFormFields> {
  const formUrl = mobileId
    ? `https://www.mobile.bg/pcgi/mobile.cgi?pubtype=1&act=6&subact=4&actions=1&adv=${mobileId}`
    : `https://www.mobile.bg/pcgi/mobile.cgi?pubtype=1&act=6&subact=4&actions=1`;

  await page.goto(formUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(2000);

  return page.evaluate(() => {
    const result: Record<string, unknown> = {};

    document.querySelectorAll('select[name]').forEach((sel) => {
      const s = sel as HTMLSelectElement;
      const name = s.getAttribute('name')!;
      result[name] = {
        type: 'select',
        options: Array.from(s.options).map((opt) => ({
          value: opt.value,
          label: opt.text.trim(),
          selected: opt.selected,
        })),
        current: s.value,
      };
    });

    document.querySelectorAll('input[name]').forEach((inp) => {
      const i = inp as HTMLInputElement;
      const name = i.getAttribute('name')!;
      const type = i.type || 'text';
      if (type === 'submit' || type === 'button' || type === 'image') return;
      if (type === 'radio') {
        if (!result[name]) result[name] = { type: 'radio', options: [] };
        (result[name] as { options: unknown[] }).options.push({
          value: i.value,
          checked: i.checked,
          label: i.closest('label')?.textContent?.trim() || i.value,
        });
        return;
      }
      if (type === 'checkbox') {
        if (!result[name]) result[name] = { type: 'checkbox', options: [] };
        (result[name] as { options: unknown[] }).options.push({
          value: i.value,
          checked: i.checked,
          label: i.closest('label')?.textContent?.trim() || i.value,
        });
        return;
      }
      result[name] = { type, current: i.value };
    });

    document.querySelectorAll('textarea[name]').forEach((ta) => {
      const t = ta as HTMLTextAreaElement;
      result[t.getAttribute('name')!] = { type: 'textarea', current: t.value };
    });

    return result as Record<string, unknown>;
  }) as PublishFormFields;
}
