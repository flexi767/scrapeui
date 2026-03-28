const CARS_BG_BASE_URL = 'https://www.cars.bg';

async function hideCarsBgErrorOverlay(page) {
  await page.evaluate(() => {
    [
      '#jsErrorMessage',
      '.page-error-opacity',
      '.page-error-message',
      '.overlay-backdrop',
      '.mdc-dialog',
      '.mdc-dialog-scrim',
      '.js-menu-overlay-backdrop',
      '.mdc-snackbar',
    ].forEach((sel) => document.querySelectorAll(sel).forEach((el) => {
      el.style.display = 'none';
      el.style.visibility = 'hidden';
      el.style.opacity = '0';
      if (typeof el.remove === 'function') el.remove();
    }));
  }).catch(() => {});
}

async function acceptCarsBgConsent(page) {
  try {
    const selectors = [
      '#cookiescript_accept',
      'button',
      'a',
      'input[type="button"]',
      'input[type="submit"]',
      '[role="button"]',
    ];
    for (const sel of selectors) {
      const nodes = page.locator(sel);
      const count = await nodes.count().catch(() => 0);
      for (let i = 0; i < Math.min(count, 25); i++) {
        const el = nodes.nth(i);
        const txt = ((await el.textContent().catch(() => '')) || '').trim().toUpperCase();
        const val = ((await el.getAttribute('value').catch(() => '')) || '').trim().toUpperCase();
        const aria = ((await el.getAttribute('aria-label').catch(() => '')) || '').trim().toUpperCase();
        const blob = `${txt} ${val} ${aria}`;
        if (
          blob.includes('ПРИЕМАМ') ||
          blob.includes('ПРИЕМИ') ||
          blob.includes('ПРИЕМАМ ВСИЧКИ') ||
          blob.includes('ACCEPT') ||
          blob.includes('AGREE') ||
          blob.includes('ALLOW ALL')
        ) {
          await el.click({ timeout: 3000 }).catch(() => {});
          await page.waitForTimeout(500);
          return true;
        }
      }
    }
  } catch (_) {}
  return false;
}

async function prepareCarsBgPage(page) {
  await page.waitForLoadState('domcontentloaded').catch(() => {});
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(800);
  const accepted = await acceptCarsBgConsent(page);
  if (accepted) {
    await page.waitForLoadState('networkidle').catch(() => {});
    await page.waitForTimeout(500);
  }
  await hideCarsBgErrorOverlay(page);
}

async function loginToCarsBg(page, username, password) {
  await page.goto(CARS_BG_BASE_URL, { waitUntil: 'domcontentloaded' });
  await prepareCarsBgPage(page);

  const menuButton = await page.waitForSelector('button[data-action="toggleMenu"]', { timeout: 20000 }).catch(() => null);
  if (!menuButton) return false;

  await menuButton.click().catch(() => {});
  await page.waitForTimeout(800);
  await prepareCarsBgPage(page);

  const drawerLocator = page.locator('aside, nav, .mdc-drawer');
  const menuText = await drawerLocator.first().innerText().catch(() => '');
  if (menuText.includes('Моите обяви')) {
    await page.click('button[data-action="toggleMenu"]').catch(() => {});
    return true;
  }

  const loginEntry = page.locator('a.mdc-list-item', { hasText: 'Вход / Регистрация' }).first();
  if (await loginEntry.count()) {
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'domcontentloaded' }).catch(() => {}),
      loginEntry.click(),
    ]);
  } else {
    const fallbackLink = await page.$('a[href*="login"], a[href*="signin"]');
    if (fallbackLink) {
      await Promise.all([
        page.waitForNavigation({ waitUntil: 'domcontentloaded' }).catch(() => {}),
        fallbackLink.click(),
      ]);
    }
  }

  await prepareCarsBgPage(page);

  await page.evaluate(() => {
    const sheet = document.getElementById('bottomSheet');
    if (sheet) {
      sheet.classList.remove('bottom-sheet-show');
      const closeBtn = sheet.querySelector('.btn-close');
      if (closeBtn) closeBtn.dispatchEvent(new Event('click'));
    }
    const drawer = document.getElementById('navigationDrawer');
    if (drawer) drawer.classList.remove('mdc-drawer--open');
    const drawerScrim = document.querySelector('.mdc-drawer-scrim');
    if (drawerScrim) drawerScrim.classList.remove('mdc-drawer-scrim--open');
    const firm = document.getElementById('firm_login_conteiner');
    const priv = document.getElementById('private_login_conteiner');
    if (firm) firm.style.display = 'block';
    if (priv) priv.style.display = 'none';
    const typeField = document.getElementById('typeId');
    if (typeField) typeField.value = '2';
    const businessTab = document.getElementById('businessTab');
    const personTab = document.getElementById('personTab');
    if (businessTab) businessTab.classList.add('mdc-tab--active');
    if (personTab) personTab.classList.remove('mdc-tab--active');
  });

  const usernameLocator = page.locator('#usernameLoginForm, input[name="username"]');
  const passwordLocator = page.locator('input[name="password_firm"], input[name="password"]');

  try {
    await usernameLocator.first().waitFor({ timeout: 20000, state: 'attached' });
    await passwordLocator.first().waitFor({ timeout: 20000, state: 'attached' });
  } catch {
    return false;
  }

  await usernameLocator.first().fill('');
  await usernameLocator.first().type(username, { delay: 40 });
  await passwordLocator.first().fill('');
  await passwordLocator.first().type(password, { delay: 40 });

  const submitBtn = await page.$('button[type="submit"], input[type="submit"], a[data-action="loginFirm"]');
  if (submitBtn) {
    await Promise.all([
      page.waitForLoadState('networkidle').catch(() => {}),
      page.evaluate((btn) => btn.click(), submitBtn),
    ]);
  } else {
    await page.evaluate(() => document.getElementById('loginForm')?.submit());
    await page.waitForLoadState('networkidle').catch(() => {});
  }

  await page.waitForTimeout(2000);
  await page.goto(`${CARS_BG_BASE_URL}/my-offers.php`, { waitUntil: 'domcontentloaded' }).catch(() => {});
  await prepareCarsBgPage(page);
  const bodyText = await page.textContent('body').catch(() => '');
  return bodyText.includes('Моите обяви') || bodyText.includes('Добави обява');
}

module.exports = {
  CARS_BG_BASE_URL,
  hideCarsBgErrorOverlay,
  acceptCarsBgConsent,
  prepareCarsBgPage,
  loginToCarsBg,
};
