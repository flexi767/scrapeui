import type { Page } from 'playwright';

export async function acceptMobileBgCookies(page: Page): Promise<void> {
  await page.evaluate(() => {
    document.getElementById('cookiescript_injected_wrapper')?.remove();
    document.getElementById('cookiescript_injected')?.remove();
  }).catch(() => {});
}

export async function loginMobileBg(page: Page, username: string, password: string): Promise<boolean> {
  await page.goto('https://www.mobile.bg/users/login', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);
  await acceptMobileBgCookies(page);

  await page.evaluate((creds: { username: string; password: string }) => {
    const form = (document as Document & { login?: HTMLFormElement }).login;
    if (!form) throw new Error('Login form not found');
    (form.elements.namedItem('logtype') as HTMLInputElement).value = '1';
    (form.elements.namedItem('usr') as HTMLInputElement).value = creds.username;
    (form.elements.namedItem('pwd') as HTMLInputElement).value = creds.password;
    form.submit();
  }, { username, password });

  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(2000);

  const url = page.url();
  const cookies = await page.context().cookies();
  const sessionCookie = cookies.find(c => c.name === 'mobile_session_id' && c.value);
  return !!sessionCookie && !url.includes('/login');
}
