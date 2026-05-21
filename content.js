// GitHub Diff Filter Plus content script.
// Runs on https://github.com/*/pull/*
//
// Goal: replace the native "File extensions" dropdown's instant-apply
// behaviour with multi-select + a single Apply button, and optionally
// re-apply the user's last selection when they come back to the Files
// changed tab.
//
// Design notes (kept light on purpose):
//   * We only observe #__primerPortalRoot__ (where Primer mounts overlays),
//     never the whole document.
//   * The native menu is destroyed and recreated each time it opens, so
//     our injected DOM and listeners are GC'd with it.
//   * Settings are cached in memory and kept in sync via
//     chrome.storage.onChanged so the click interceptor can decide
//     synchronously.
//   * Remember-last works primarily by rewriting the href of PR tab links
//     before Turbo navigates: one SPA navigation lands directly on the
//     filtered URL — no double-load, no flash. A fallback runs on page
//     load events for the cases where the user did not click a link.

(() => {
  'use strict';

  const PORTAL_ID = '__primerPortalRoot__';
  const MENU_SELECTOR = 'ul[aria-label="File extensions"]';
  const ITEM_SELECTOR = 'li[role="menuitemcheckbox"]';
  const LABEL_SELECTOR = '[data-component="ActionList.Item.Label"]';
  const ENHANCED_ATTR = 'data-gdfp-enhanced';
  const FILES_PATH = /\/pull\/\d+\/(?:changes|files)\/?$/;
  const FILTER_PARAM = 'file-filters[]';

  let settings = { rememberLast: false, lastSelection: [] };

  function refreshSettings() {
    chrome.storage.sync.get(settings, (loaded) => { settings = loaded; });
  }
  refreshSettings();
  chrome.storage.onChanged.addListener((_changes, area) => {
    if (area === 'sync') refreshSettings();
  });

  function shouldAutoApply(url) {
    if (url.origin !== location.origin) return false;
    if (!FILES_PATH.test(url.pathname)) return false;
    if (url.searchParams.has(FILTER_PARAM)) return false;
    if (!settings.rememberLast) return false;
    if (!Array.isArray(settings.lastSelection) || settings.lastSelection.length === 0) return false;
    return true;
  }

  function addFilters(url) {
    for (const ext of settings.lastSelection) {
      url.searchParams.append(FILTER_PARAM, ext);
    }
  }

  function navigate(href, action /* 'advance' | 'replace' */) {
    if (action === 'replace') location.replace(href);
    else location.href = href;
  }

  // Visual feedback during the hard reload. Adds a thin top progress bar
  // that lives only on the outgoing page (the new page won't have it,
  // since the script runs fresh there). Helps mask the "frozen page"
  // perception between click and the new page rendering.
  function showLoadingBar() {
    if (!document.body) return;
    if (document.getElementById('gdfp-loading-bar')) return;
    const bar = document.createElement('div');
    bar.id = 'gdfp-loading-bar';
    document.body.appendChild(bar);
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

  function applyFilters(menu) {
    const items = menu.querySelectorAll(`:scope > ${ITEM_SELECTOR}`);
    const selected = [];
    for (const item of items) {
      if (item.getAttribute('aria-checked') !== 'true') continue;
      const label = item.querySelector(LABEL_SELECTOR);
      if (label && label.textContent) selected.push(label.textContent.trim());
    }

    const hasRealFilter = selected.length > 0 && selected.length < items.length;

    const url = new URL(location.href);
    url.searchParams.delete(FILTER_PARAM);
    // If everything is selected (or nothing), drop the param entirely so the
    // URL stays clean and we don't fight the default state.
    if (hasRealFilter) {
      for (const ext of selected) url.searchParams.append(FILTER_PARAM, ext);
    }

    if (settings.rememberLast) {
      const toSave = hasRealFilter ? selected : [];
      settings.lastSelection = toSave;
      chrome.storage.sync.set({ lastSelection: toSave });
    }

    showLoadingBar();
    navigate(url.toString(), 'advance');
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

  // Intercept link clicks BEFORE Next.js can. Registered on window in
  // capture phase, ideally at document_start so we beat GitHub's own
  // click handlers. stopImmediatePropagation prevents Next.js from
  // starting its (unfiltered) SPA navigation in parallel. We then trigger
  // a hard navigation to the filtered URL ourselves. The flash is
  // unavoidable (we can't access Next.js' internal router), but at least
  // the user no longer sees an unfiltered intermediate render.
  function interceptClick(e) {
    if (e.button !== 0) return;
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    if (e.defaultPrevented) return;
    const link = e.target.closest?.('a[href]');
    if (!link) return;
    let dest;
    try { dest = new URL(link.href, location.href); } catch { return; }
    if (!shouldAutoApply(dest)) return;

    addFilters(dest);
    console.log('[Diff Filter Plus] click intercepted → hard nav to:', dest.toString());
    e.preventDefault();
    e.stopImmediatePropagation();
    showLoadingBar();
    location.href = dest.toString();
  }

  // Fallback for navigations that didn't go through a link click
  // (browser back/forward, URL bar entry, history pop…).
  function maybeApplyRemembered(reason) {
    const url = new URL(location.href);
    const apply = shouldAutoApply(url);
    console.log('[Diff Filter Plus] fallback', reason || '', { pathname: url.pathname, willApply: apply, settings });
    if (!apply) return;
    addFilters(url);
    showLoadingBar();
    navigate(url.toString(), 'replace');
  }

  function start() {
    maybeApplyRemembered('start');
    const portal = document.getElementById(PORTAL_ID);
    if (portal) { watch(portal); return; }
    const wait = new MutationObserver(() => {
      const p = document.getElementById(PORTAL_ID);
      if (!p) return;
      wait.disconnect();
      watch(p);
    });
    wait.observe(document.body, { childList: true, subtree: true });
  }

  // Register the click interceptor as early as possible, before
  // GitHub's bundles register theirs. Window + capture beats anything
  // attached lower in the tree.
  window.addEventListener('click', interceptClick, true);

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }

  // Fallback for navigations that bypass the click handler (browser
  // back/forward, URL-bar entry, programmatic JS navigation).
  document.addEventListener('turbo:load', () => maybeApplyRemembered('turbo:load'));
})();
