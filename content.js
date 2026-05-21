// GitHub Diff Filter Plus content script.
// Runs on https://github.com/*/pull/*
//
// Goal: replace the native "File extensions" dropdown's instant-apply
// behaviour with multi-select + a single Apply button.
//
// Design notes (kept light on purpose):
//   * We only observe #__primerPortalRoot__ (where Primer mounts overlays),
//     never the whole document. The portal is data-turbo-permanent so a
//     single observer survives SPA navigation.
//   * The native menu is destroyed and recreated each time the user opens
//     it, so our injected DOM and event listeners are GC'd with it. We
//     don't track instances ourselves.
//   * Click handling uses one delegated listener at the menu root rather
//     than one per item.
//   * Selected extensions are read from aria-checked at Apply time, so we
//     never cache state that could drift.

(() => {
  'use strict';

  const PORTAL_ID = '__primerPortalRoot__';
  const MENU_SELECTOR = 'ul[aria-label="File extensions"]';
  const ITEM_SELECTOR = 'li[role="menuitemcheckbox"]';
  const LABEL_SELECTOR = '[data-component="ActionList.Item.Label"]';
  const ENHANCED_ATTR = 'data-gdfp-enhanced';

  function getSettings() {
    return new Promise((resolve) => {
      chrome.storage.sync.get({ rememberLast: false, lastSelection: [] }, resolve);
    });
  }

  function enhance(menu) {
    if (menu.hasAttribute(ENHANCED_ATTR)) return;
    menu.setAttribute(ENHANCED_ATTR, '1');

    // Intercept activation on items so the native handler never sees them.
    menu.addEventListener('click', onItemActivate, true);
    menu.addEventListener('keydown', onItemKeydown, true);

    // Inject Select all / Deselect all (header) and Apply (footer).
    const header = document.createElement('li');
    header.className = 'gdfp-row gdfp-header';
    header.setAttribute('role', 'none');
    header.innerHTML =
      '<button type="button" class="gdfp-btn" data-gdfp="select">Select all</button>' +
      '<button type="button" class="gdfp-btn" data-gdfp="deselect">Deselect all</button>';
    menu.insertBefore(header, menu.firstChild);

    const footer = document.createElement('li');
    footer.className = 'gdfp-row gdfp-footer';
    footer.setAttribute('role', 'none');
    footer.innerHTML =
      '<button type="button" class="gdfp-btn gdfp-apply" data-gdfp="apply">Apply</button>';
    menu.appendChild(footer);

    menu.addEventListener('click', onControl);
  }

  function isOurItem(item, menu) {
    return item && item.parentElement === menu;
  }

  function onItemActivate(e) {
    const menu = e.currentTarget;
    const item = e.target.closest(ITEM_SELECTOR);
    if (!isOurItem(item, menu)) return;
    e.preventDefault();
    e.stopPropagation();
    toggle(item);
  }

  function onItemKeydown(e) {
    if (e.key !== ' ' && e.key !== 'Enter') return;
    const menu = e.currentTarget;
    const item = e.target.closest(ITEM_SELECTOR);
    if (!isOurItem(item, menu)) return;
    e.preventDefault();
    e.stopPropagation();
    toggle(item);
  }

  function toggle(item) {
    const next = item.getAttribute('aria-checked') !== 'true';
    item.setAttribute('aria-checked', String(next));
  }

  function onControl(e) {
    const btn = e.target.closest('button[data-gdfp]');
    if (!btn) return;
    const menu = e.currentTarget;
    e.preventDefault();
    e.stopPropagation();
    const action = btn.dataset.gdfp;

    if (action === 'select' || action === 'deselect') {
      const next = action === 'select' ? 'true' : 'false';
      for (const item of menu.querySelectorAll(`:scope > ${ITEM_SELECTOR}`)) {
        item.setAttribute('aria-checked', next);
      }
      return;
    }

    if (action === 'apply') applyFilters(menu);
  }

  async function applyFilters(menu) {
    const items = menu.querySelectorAll(`:scope > ${ITEM_SELECTOR}`);
    const selected = [];
    for (const item of items) {
      if (item.getAttribute('aria-checked') !== 'true') continue;
      const label = item.querySelector(LABEL_SELECTOR);
      if (label && label.textContent) selected.push(label.textContent.trim());
    }

    const hasRealFilter = selected.length > 0 && selected.length < items.length;

    const url = new URL(location.href);
    url.searchParams.delete('file-filters[]');
    // If everything is selected (or nothing), drop the param entirely so the
    // URL stays clean and we don't fight the default state.
    if (hasRealFilter) {
      for (const ext of selected) url.searchParams.append('file-filters[]', ext);
    }

    // Persist the selection for next time, if the user opted in.
    const { rememberLast } = await getSettings();
    if (rememberLast) {
      chrome.storage.sync.set({ lastSelection: hasRealFilter ? selected : [] });
    }

    location.href = url.toString();
  }

  function scan(root) {
    if (!(root instanceof Element)) return;
    if (root.matches?.(MENU_SELECTOR)) {
      enhance(root);
      return;
    }
    root.querySelectorAll?.(MENU_SELECTOR).forEach(enhance);
  }

  function watch(portal) {
    portal.querySelectorAll(MENU_SELECTOR).forEach(enhance);
    new MutationObserver((mutations) => {
      for (const m of mutations) m.addedNodes.forEach(scan);
    }).observe(portal, { childList: true, subtree: true });
  }

  async function maybeApplyRemembered(reason) {
    const dbg = (...args) => console.log('[Diff Filter Plus]', `(${reason})`, ...args);
    // Auto-apply only on the Files changed tab. GitHub uses /changes
    // for that tab (some older URLs may still be /files).
    if (!/\/pull\/\d+\/(?:changes|files)\/?$/.test(location.pathname)) {
      dbg('skip: not on /changes', location.pathname);
      return;
    }
    const url = new URL(location.href);
    // Don't override a URL that already specifies its own filter.
    if (url.searchParams.has('file-filters[]')) {
      dbg('skip: URL already has filters');
      return;
    }

    const { rememberLast, lastSelection } = await getSettings();
    dbg('settings:', { rememberLast, lastSelection });
    if (!rememberLast) { dbg('skip: rememberLast off'); return; }
    if (!Array.isArray(lastSelection) || lastSelection.length === 0) {
      dbg('skip: no saved selection');
      return;
    }

    for (const ext of lastSelection) url.searchParams.append('file-filters[]', ext);
    dbg('applying:', lastSelection, '→', url.toString());
    // replace() keeps the back/forward history clean.
    location.replace(url.toString());
  }

  function start() {
    maybeApplyRemembered('start');
    const portal = document.getElementById(PORTAL_ID);
    if (portal) { watch(portal); return; }
    // Portal not yet mounted: wait for it, then disconnect.
    const wait = new MutationObserver(() => {
      const p = document.getElementById(PORTAL_ID);
      if (!p) return;
      wait.disconnect();
      watch(p);
    });
    wait.observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }

  // GitHub uses SPA navigation between PR tabs. The Navigation API
  // (Chrome 102+) catches every soft navigation regardless of which
  // library powers it (Turbo, PJAX, GitHub's own router…).
  if (window.navigation) {
    navigation.addEventListener('navigatesuccess', () => maybeApplyRemembered('navigatesuccess'));
  }
  // Fallback events in case the Navigation API misses a case.
  document.addEventListener('turbo:load', () => maybeApplyRemembered('turbo:load'));
  document.addEventListener('pjax:end', () => maybeApplyRemembered('pjax:end'));
})();
