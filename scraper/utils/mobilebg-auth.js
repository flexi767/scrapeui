async function acceptMobileBgCookies(page) {
  await page.evaluate(() => {
    document.getElementById('cookiescript_injected_wrapper')?.remove();
    document.getElementById('cookiescript_injected')?.remove();
  }).catch(() => {});
}

async function loginMobileBg(page, username, password) {
  await page.goto('https://www.mobile.bg/users/login', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);
  await acceptMobileBgCookies(page);

  await page.evaluate((creds) => {
    const form = document.login;
    if (!form) throw new Error('Login form not found');
    form.logtype.value = '1';
    form.usr.value = creds.username;
    form.pwd.value = creds.password;
    form.submit();
  }, { username, password });

  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(2000);

  const url = page.url();
  const cookies = await page.context().cookies();
  const sessionCookie = cookies.find((c) => c.name === 'mobile_session_id' && c.value);
  return !!sessionCookie && !url.includes('/login');
}

module.exports = {
  acceptMobileBgCookies,
  loginMobileBg,
};
