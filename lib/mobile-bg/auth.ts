import type { Page } from 'playwright';

export async function acceptMobileBgCookies(page: Page): Promise<void> {
  await page.evaluate(() => {
    document.getElementById('cookiescript_injected_wrapper')?.remove();
    document.getElementById('cookiescript_injected')?.remove();
  }).catch(() => {});
}

export async function loginMobileBg(page: Page, username: string, password: string): Promise<boolean> {
  const hasSession = async () => {
    const url = page.url();
    const cookies = await page.context().cookies();
    const sessionCookie = cookies.find((cookie) => cookie.name === 'mobile_session_id' && cookie.value);
    return !!sessionCookie && !url.includes('/login');
  };

  const submitLogin = async () => {
    await page.waitForSelector('form[name="login"], input[name="usr"], input[name="pwd"]', { timeout: 6000 });

    await page.evaluate((creds: { username: string; password: string }) => {
      const form =
        (document as Document & { login?: HTMLFormElement }).login ||
        Array.from(document.forms).find(
          (candidate) =>
            candidate.querySelector('input[name="usr"], input[name="username"]') &&
            candidate.querySelector('input[name="pwd"], input[type="password"]'),
        ) ||
        null;

      if (!form) throw new Error('Login form not found');

      const userInput =
        (form.elements.namedItem('usr') as HTMLInputElement | null) ||
        (form.querySelector('input[name="usr"], input[name="username"]') as HTMLInputElement | null);
      const passwordInput =
        (form.elements.namedItem('pwd') as HTMLInputElement | null) ||
        (form.querySelector('input[name="pwd"], input[type="password"]') as HTMLInputElement | null);
      const logtypeInput =
        (form.elements.namedItem('logtype') as HTMLInputElement | null) ||
        (document.querySelector('input[name="logtype"]') as HTMLInputElement | null);

      if (!userInput || !passwordInput) throw new Error('Login inputs not found');

      if (logtypeInput) logtypeInput.value = '1';
      userInput.value = creds.username;
      passwordInput.value = creds.password;

      userInput.dispatchEvent(new Event('input', { bubbles: true }));
      passwordInput.dispatchEvent(new Event('input', { bubbles: true }));
      userInput.dispatchEvent(new Event('change', { bubbles: true }));
      passwordInput.dispatchEvent(new Event('change', { bubbles: true }));

      form.submit();
    }, { username, password });

    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1500);
  };

  for (let attempt = 0; attempt < 3; attempt += 1) {
    await page.goto('https://www.mobile.bg/users/login', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);
    await acceptMobileBgCookies(page);

    if (await hasSession()) return true;

    try {
      await submitLogin();
    } catch (error) {
      if (attempt === 2) throw error;
      await page.waitForTimeout(1000);
      continue;
    }

    if (await hasSession()) return true;
  }

  return hasSession();
}
