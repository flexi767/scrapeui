(() => {
  const existing = document.getElementById("scrapeui-fb-marketplace-panel");
  if (existing) {
    existing.style.display = existing.style.display === "none" ? "block" : "none";
    return;
  }

  const scriptUrl = new URL(document.currentScript?.src || location.href);
  const apiBase = scriptUrl.origin;
  const state = { listings: [], selected: null };
  const pendingKey = "scrapeui.fbMarketplace.pendingListing";
  const createVehicleUrl = "https://www.facebook.com/marketplace/create/vehicle";

  const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const visible = (el) => Boolean(el && el.offsetWidth > 0 && el.offsetHeight > 0);
  const text = (el) => (el?.textContent || "").replace(/\s+/g, " ").trim();
  const isCreateForm = () => location.href.includes("/marketplace/create");

  const panel = document.createElement("div");
  panel.id = "scrapeui-fb-marketplace-panel";
  panel.innerHTML = renderPanelHtml();
  document.body.appendChild(panel);

  const closeButton = panel.querySelector(".suimp-close");
  const searchInput = panel.querySelector(".suimp-search");
  const listEl = panel.querySelector(".suimp-list");
  const fillButton = panel.querySelector(".suimp-primary");
  const createButton = panel.querySelector(".suimp-secondary");
  const logEl = panel.querySelector(".suimp-log");

  function log(message) {
    logEl.textContent += `${new Date().toLocaleTimeString()} ${message}\n`;
    logEl.scrollTop = logEl.scrollHeight;
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, (ch) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    })[ch]);
  }

  function renderList() {
    const items = getVisibleListings();

    listEl.innerHTML = "";
    if (items.length === 0) {
      listEl.innerHTML = '<div class="suimp-muted" style="padding:10px">No listings found.</div>';
      return;
    }

    for (const listing of items) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "suimp-item";
      button.dataset.active = state.selected?.backupId === listing.backupId ? "true" : "false";
      button.innerHTML = renderListingItemHtml(listing);
      button.addEventListener("click", () => selectListing(listing));
      listEl.appendChild(button);
    }
  }

  function getVisibleListings() {
    const query = searchInput.value.trim().toLowerCase();
    return state.listings
      .filter((listing) => listingMatchesQuery(listing, query))
      .slice(0, 80);
  }

  function listingMatchesQuery(listing, query) {
    if (!query) return true;
    return [
      listing.title,
      listing.make,
      listing.model,
      listing.year,
      listing.price,
      listing.mileage,
    ].filter(Boolean).join(" ").toLowerCase().includes(query);
  }

  function selectListing(listing) {
    state.selected = listing;
    updateFillButton();
    renderList();
    log(`Selected backup #${listing.backupId}`);
  }

  function updateFillButton() {
    fillButton.disabled = !state.selected;
  }

  function renderPanelHtml() {
    return `
      <style>${panelStyles()}</style>
      <div class="suimp-head">
        <div>
          <div class="suimp-title">scrapeui Marketplace</div>
          <div class="suimp-muted">Choose a listing, fill this Facebook tab, review, then publish manually.</div>
        </div>
        <button class="suimp-close" type="button" title="Close">x</button>
      </div>
      <div class="suimp-body">
        <input class="suimp-search" placeholder="Search existing listings" />
        <div class="suimp-list"><div class="suimp-muted" style="padding:10px">Loading listings...</div></div>
        <div class="suimp-actions">
          <button class="suimp-secondary" type="button">Create form</button>
          <button class="suimp-primary" type="button" disabled>Fill selected</button>
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
      .suimp-search { width: 100%; border: 1px solid #334155; border-radius: 6px; background: #111827; color: #fff; padding: 8px 10px; outline: none; }
      .suimp-list { max-height: 280px; overflow: auto; border: 1px solid #1f2937; border-radius: 6px; background: #020617; }
      .suimp-item { display: grid; grid-template-columns: 58px minmax(0, 1fr); gap: 10px; align-items: center; width: 100%; min-height: 64px; border: 0; border-bottom: 1px solid #111827; background: transparent; color: #cbd5e1; text-align: left; padding: 8px 10px; cursor: pointer; }
      .suimp-item:hover, .suimp-item[data-active="true"] { background: #1d4ed8; color: #fff; }
      .suimp-thumb { width: 58px; height: 46px; border-radius: 5px; object-fit: cover; background: #111827; border: 1px solid #1f2937; flex: none; }
      .suimp-thumb-placeholder { display: grid; place-items: center; color: #64748b; font-size: 11px; }
      .suimp-item-main { min-width: 0; }
      .suimp-item-title { overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; font-weight: 650; }
      .suimp-muted { color: #94a3b8; font-size: 12px; }
      .suimp-actions { display: flex; gap: 8px; }
      .suimp-primary, .suimp-secondary { border: 1px solid #2563eb; border-radius: 6px; padding: 8px 10px; cursor: pointer; font-weight: 600; }
      .suimp-primary { flex: 1; background: #2563eb; color: #fff; }
      .suimp-secondary { background: #111827; color: #dbeafe; }
      .suimp-primary:disabled { opacity: .5; cursor: not-allowed; }
      .suimp-log { max-height: 150px; overflow: auto; white-space: pre-wrap; border: 1px solid #1f2937; border-radius: 6px; background: #020617; padding: 8px; color: #cbd5e1; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12px; }
    `;
  }

  function renderListingItemHtml(listing) {
    const thumbUrl = listing.photoUrls?.[0];
    const title = listing.title || `Backup #${listing.backupId}`;
    const meta = [
      listing.year,
      listing.mileage ? `${listing.mileage} km` : "",
      listing.price ? `${listing.price} BGN` : "",
      `${listing.photoUrls?.length || 0} photos`,
    ].filter(Boolean).join(" | ");

    return `
      ${
        thumbUrl
          ? `<img class="suimp-thumb" src="${escapeHtml(thumbUrl)}" alt="" loading="lazy" referrerpolicy="no-referrer" />`
          : '<div class="suimp-thumb suimp-thumb-placeholder">No img</div>'
      }
      <div class="suimp-item-main">
        <div class="suimp-item-title">${escapeHtml(title)}</div>
        <div class="suimp-muted">${escapeHtml(meta)}</div>
      </div>
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
    fillButton.disabled = true;
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
      fillButton.disabled = false;
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

  async function loadListings() {
    try {
      const response = await fetch(`${apiBase}/api/facebook-marketplace/listings?limit=250`, { mode: "cors" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      state.listings = data.listings || [];
      state.selected = matchListingByBackupId(state.selected?.backupId);
      updateFillButton();
      log(`Loaded ${state.listings.length} listings`);

      if (await continuePendingListing()) {
        return;
      }

      renderList();
    } catch (error) {
      listEl.innerHTML = '<div class="suimp-muted" style="padding:10px">Could not load listings.</div>';
      log(`Load failed: ${error.message || error}`);
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
      // If storage is blocked, navigation still happens; the user can reselect.
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

  async function continuePendingListing() {
    const pending = getPendingListing();
    if (!pending || !isCreateForm()) return false;

    state.selected = matchListingByBackupId(pending.backupId) || pending;
    updateFillButton();
    renderList();
    sessionStorage.removeItem(pendingKey);
    log(`Continuing pending backup #${state.selected.backupId}`);
    await fillListing(state.selected);
    return true;
  }

  function matchListingByBackupId(backupId) {
    if (!backupId) return null;
    return state.listings.find((listing) => listing.backupId === backupId) || null;
  }

  closeButton.addEventListener("click", () => panel.remove());
  searchInput.addEventListener("input", renderList);
  createButton.addEventListener("click", () => {
    location.href = createVehicleUrl;
  });
  fillButton.addEventListener("click", () => {
    if (state.selected) void fillListing(state.selected);
  });

  void loadListings();
})();
