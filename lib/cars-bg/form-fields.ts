import type { Page } from 'playwright';

export async function selectCarsBgRadio(
  page: Page,
  name: string,
  value: number | string | null | undefined,
): Promise<void> {
  if (value == null) return;
  await page.evaluate(({ field, fieldValue }) => {
    const inputs = document.querySelectorAll<HTMLInputElement>(`input[name="${field}"][value="${fieldValue}"]`);
    inputs.forEach((input) => {
      input.checked = true;
      input.dispatchEvent(new Event('change', { bubbles: true }));
    });
  }, { field: name, fieldValue: String(value) });
}

export async function fillCarsBgInput(
  page: Page,
  selector: string,
  value: string | number | null | undefined,
): Promise<void> {
  if (value == null || value === '') return;
  const input = await page.$(selector);
  if (!input) return;
  await input.fill('');
  await input.type(String(value), { delay: 10 });
}

export async function fillCarsBgTextarea(
  page: Page,
  selector: string,
  value: string | null | undefined,
): Promise<void> {
  if (!value) return;
  const input = await page.$(selector);
  if (!input) return;
  await input.fill('');
  await input.type(String(value).slice(0, 32000), { delay: 5 });
}

