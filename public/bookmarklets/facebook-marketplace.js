(() => {
  const scrapeuiOrigin = "__SCRAPEUI_ORIGIN__";
  const panelId = "scrapeui-fb-marketplace-panel";
  const runtimeKey = "__scrapeuiFbMarketplaceBookmarklet";
  const pendingKey = "scrapeui.fbMarketplace.pendingListing";
  const createVehicleUrl = "https://www.facebook.com/marketplace/create/vehicle";

  const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const visible = (el) => Boolean(el && el.offsetWidth > 0 && el.offsetHeight > 0);
  const text = (el) => (el?.textContent || "").replace(/\s+/g, " ").trim();
  const isCreateForm = () => location.href.includes("/marketplace/create");

  const previousRuntime = window[runtimeKey];
  if (previousRuntime?.cleanup) previousRuntime.cleanup();

  const cleanupTasks = [];
  const addCleanup = (task) => cleanupTasks.push(task);

  let panel = document.getElementById(panelId);
  if (panel) {
    panel.remove();
    panel = null;
  }

  panel = document.createElement("div");
  panel.id = panelId;
  panel.innerHTML = renderPanelHtml();
  document.body.appendChild(panel);
  addCleanup(() => panel?.remove());

  const closeButton = panel.querySelector(".suimp-close");
  const chooseButton = panel.querySelector(".suimp-primary");
  const createButton = panel.querySelector(".suimp-secondary");
  const logEl = panel.querySelector(".suimp-log");

  function log(message) {
    logEl.textContent += `${new Date().toLocaleTimeString()} ${message}\n`;
    logEl.scrollTop = logEl.scrollHeight;
  }

  function renderPanelHtml() {
    return `
      <style>${panelStyles()}</style>
      <div class="suimp-head">
        <div>
          <div class="suimp-title">scrapeui Marketplace</div>
          <div class="suimp-muted">Choose a scrapeui listing in the popup, then review before publishing.</div>
        </div>
        <button class="suimp-close" type="button" title="Close">x</button>
      </div>
      <div class="suimp-body">
        <div class="suimp-status">Ready to open your scrapeui listing picker.</div>
        <div class="suimp-actions">
          <button class="suimp-secondary" type="button">Create form</button>
          <button class="suimp-primary" type="button">Choose listing</button>
        </div>
        <div class="suimp-log"></div>
      </div>
    `;
  }

  function panelStyles() {
    return `
      #scrapeui-fb-marketplace-panel {
        position: fixed;
        z-index: 2147483647;
        right: 18px;
        top: 72px;
        width: 390px;
        max-height: calc(100vh - 96px);
        overflow: hidden;
        border: 1px solid #334155;
        border-radius: 8px;
        background: #0f172a;
        color: #e5e7eb;
        box-shadow: 0 18px 44px rgba(0,0,0,.45);
        font: 13px/1.4 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }
      #scrapeui-fb-marketplace-panel * { box-sizing: border-box; }
      .suimp-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 12px; border-bottom: 1px solid #1f2937; }
      .suimp-title { font-weight: 700; color: #fff; }
      .suimp-close { border: 0; background: transparent; color: #94a3b8; cursor: pointer; font-size: 18px; line-height: 1; }
      .suimp-body { padding: 12px; display: grid; gap: 10px; }
      .suimp-status { border: 1px solid #1f2937; border-radius: 6px; background: #020617; color: #cbd5e1; padding: 10px; }
      .suimp-muted { color: #94a3b8; font-size: 12px; }
      .suimp-actions { display: flex; gap: 8px; }
      .suimp-primary, .suimp-secondary { border: 1px solid #2563eb; border-radius: 6px; padding: 8px 10px; cursor: pointer; font-weight: 600; }
      .suimp-primary { flex: 1; background: #2563eb; color: #fff; }
      .suimp-secondary { background: #111827; color: #dbeafe; }
      .suimp-primary:disabled { opacity: .5; cursor: not-allowed; }
      .suimp-log { max-height: 180px; overflow: auto; white-space: pre-wrap; border: 1px solid #1f2937; border-radius: 6px; background: #020617; padding: 8px; color: #cbd5e1; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12px; }
    `;
  }

  function setNativeValue(el, value) {
    const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
    if (setter) setter.call(el, value);
    else el.value = value;
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function findTextField(labelText) {
    const candidates = Array.from(document.querySelectorAll("input:not([type=hidden]):not([type=file]):not([type=checkbox]):not([type=search]), textarea"));
    for (const el of candidates) {
      let node = el.parentElement;
      for (let depth = 0; depth < 5 && node; depth += 1) {
        if (text(node).includes(labelText)) return el;
        node = node.parentElement;
      }
    }
    return null;
  }

  async function fillByLabel(labelText, value) {
    if (value == null || value === "") return false;
    const el = findTextField(labelText);
    if (!el) {
      log(`Missing field: ${labelText}`);
      return false;
    }
    el.scrollIntoView({ block: "center" });
    el.focus();
    setNativeValue(el, String(value));
    await delay(250);
    log(`Filled ${labelText}`);
    return true;
  }

  async function fillCombobox(labelText, value) {
    if (!value) return false;
    await dismissOpenDropdown();

    const combo = findCombobox(labelText);
    if (!combo) {
      log(`Missing dropdown: ${labelText}`);
      return false;
    }

    combo.scrollIntoView({ block: "center" });
    combo.click();
    await delay(900);

    const option = findDropdownOption(value);
    if (option) {
      option.click();
      await delay(450);
      log(`Selected ${labelText}: ${value}`);
      return true;
    }

    log(`No option matched ${labelText}: ${value}`);
    return false;
  }

  async function dismissOpenDropdown() {
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    await delay(200);
  }

  function findCombobox(labelText) {
    return Array.from(document.querySelectorAll('label[role="combobox"], [role="combobox"]'))
      .find((el) => visible(el) && text(el).includes(labelText));
  }

  function findDropdownOption(value) {
    const wanted = String(value).toLowerCase();
    for (const root of getDropdownRoots()) {
      const exact = getVisibleDropdownOptions(root).find((option) => text(option).toLowerCase() === wanted);
      const partial = exact || getVisibleDropdownOptions(root).find((option) => {
        const optionText = text(option).toLowerCase();
        return optionText.length < 90 && optionText.includes(wanted);
      });
      if (partial) return partial;
    }
    return null;
  }

  function getDropdownRoots() {
    const roots = Array.from(document.querySelectorAll('[role="listbox"]')).filter(visible);
    return roots.length > 0 ? roots : [document];
  }

  function getVisibleDropdownOptions(root) {
    return Array.from(root.querySelectorAll('[role="option"], li, div[tabindex="0"]')).filter(visible);
  }

  async function fillLocation(locationValue) {
    if (!locationValue) return;
    const input = document.querySelector('[aria-label="Местоположение"]') || findTextField("Местоположение");
    if (!input) {
      log("Missing location field");
      return;
    }
    input.scrollIntoView({ block: "center" });
    input.focus();
    setNativeValue(input, locationValue);
    await delay(1400);
    const option = Array.from(document.querySelectorAll('[role="option"]')).find(visible);
    if (option) option.click();
    else input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    log(`Filled location: ${locationValue}`);
  }

  async function uploadPhotos(listing) {
    const urls = (listing.photoUrls || []).slice(0, 10);
    if (urls.length === 0) return;
    const input = document.querySelector('input[type="file"]');
    if (!input) {
      log("Missing photo upload input");
      return;
    }
    const dt = new DataTransfer();
    let index = 1;
    for (const url of urls) {
      try {
        const response = await fetch(url, { mode: "cors" });
        if (!response.ok) throw new Error(`${response.status}`);
        const blob = await response.blob();
        const ext = (blob.type.split("/")[1] || "jpg").replace("jpeg", "jpg");
        dt.items.add(new File([blob], `scrapeui-${listing.backupId}-${index}.${ext}`, { type: blob.type || "image/jpeg" }));
        index += 1;
      } catch (error) {
        log(`Photo failed: ${url} (${error.message || error})`);
      }
    }
    if (dt.files.length === 0) return;
    input.files = dt.files;
    dispatchInputEvents(input);
    log(`Attached ${dt.files.length} photos`);
    await delay(2500);
  }

  async function fillListing(listing) {
    chooseButton.disabled = true;
    try {
      if (!isCreateForm()) {
        navigateToCreateFormWithPendingListing(listing);
        return;
      }

      log(`Filling backup #${listing.backupId}`);
      await uploadPhotos(listing);
      await fillCombobox("Марка", listing.make);
      await fillByLabel("Модел", listing.model);
      await fillByLabel("Цена", listing.price);
      await fillByLabel("Описание", listing.description);
      await fillLocation(listing.location);
      await fillCombobox("Тип превозно средство", listing.vehicleType);
      document.querySelector('h1, h2, [role="heading"]')?.click();
      await delay(500);
      await fillCombobox("Година", listing.year);
      window.scrollBy(0, 420);
      await delay(500);
      await fillByLabel("Пробег", listing.mileage);
      await fillCombobox("Тип каросерия", listing.bodyType);
      await fillCombobox("Тип гориво", listing.fuel);
      if (!(await fillCombobox("Цвят на екстериора", listing.color))) await fillCombobox("Цвят", listing.color);
      if (!(await fillCombobox("Скоростна кутия", listing.transmission))) await fillCombobox("Трансмисия", listing.transmission);
      await fillCombobox("Състояние", listing.condition);
      enableCheckboxByLabel("Без повреди", listing.noDamage);

      log("Done. Review the Facebook form and publish manually.");
    } finally {
      chooseButton.disabled = false;
    }
  }

  function dispatchInputEvents(el) {
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function enableCheckboxByLabel(labelText, shouldEnable) {
    if (!shouldEnable) return;
    const checkbox = document.querySelector(`input[aria-label*="${labelText}"], [role="checkbox"][aria-label*="${labelText}"]`);
    const checked = checkbox?.checked || checkbox?.getAttribute("aria-checked") === "true";
    if (checkbox && !checked) {
      checkbox.click();
      log(`Enabled ${labelText}`);
    }
  }

  function navigateToCreateFormWithPendingListing(listing) {
    savePendingListing(listing);
    log("Opening Facebook Marketplace create form. Click the bookmarklet again after it loads to continue filling.");
    location.href = createVehicleUrl;
  }

  function savePendingListing(listing) {
    try {
      sessionStorage.setItem(pendingKey, JSON.stringify(listing));
    } catch {
      /* If storage is blocked, navigation still happens; the user can reselect. */
    }
  }

  function getPendingListing() {
    try {
      const raw = sessionStorage.getItem(pendingKey);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  function openPicker() {
    const pickerUrl = `${scrapeuiOrigin}/facebook-marketplace/picker?openerOrigin=${encodeURIComponent(location.origin)}`;
    log("Opening scrapeui listing picker...");
    const popup = window.open(pickerUrl, "scrapeuiFacebookMarketplacePicker", "popup,width=520,height=720");
    if (!popup) log("Popup blocked. Allow popups for this Facebook tab, then click Choose listing again.");
  }

  function handlePickerMessage(event) {
    if (event.origin !== scrapeuiOrigin) return;
    if (event.data?.type !== "scrapeui:facebook-marketplace-listing") return;
    const listing = event.data.listing;
    if (!listing) return;
    log(`Received backup #${listing.backupId}`);
    void fillListing(listing);
  }

  function cleanup() {
    while (cleanupTasks.length > 0) cleanupTasks.pop()?.();
    if (window[runtimeKey]?.cleanup === cleanup) delete window[runtimeKey];
  }

  function listen(target, eventName, handler) {
    target.addEventListener(eventName, handler);
    addCleanup(() => target.removeEventListener(eventName, handler));
  }

  window[runtimeKey] = { cleanup };

  listen(closeButton, "click", cleanup);
  listen(createButton, "click", () => {
    location.href = createVehicleUrl;
  });
  listen(chooseButton, "click", openPicker);
  listen(window, "message", handlePickerMessage);

  const pending = getPendingListing();
  if (pending) {
    if (isCreateForm()) {
      sessionStorage.removeItem(pendingKey);
      log(`Continuing pending backup #${pending.backupId}`);
      void fillListing(pending);
    } else {
      log(`Pending backup #${pending.backupId} is ready. Opening the Facebook create form.`);
      navigateToCreateFormWithPendingListing(pending);
    }
  } else {
    if (!isCreateForm()) log("This tab is not on the create form yet. I will navigate after you choose a listing.");
    openPicker();
  }
})();
