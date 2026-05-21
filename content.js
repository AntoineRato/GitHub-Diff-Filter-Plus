// GitHub Diff Filter Plus content script
// Runs on https://github.com/*/pull/*
//
// Strategy:
//   1. GitHub is a SPA, so watch the DOM for the native "File extensions"
//      dropdown to appear, then enhance it.
//   2. Replace native instant-apply behaviour with multi-select + a single
//      "Apply" button that navigates to the URL once.
//   3. The Apply URL uses GitHub's own query format:
//        ?file-filters[]=.cs&file-filters[]=.meta&...
//
// NOTE: The selector below is a placeholder. It must be confirmed by
// inspecting the native dropdown HTML on a real PR before the enhancement
// can be implemented.

(() => {
  'use strict';

  const log = (...args) => console.debug('[Diff Filter Plus]', ...args);

  // TODO: replace with the real selector once the HTML is inspected.
  const DROPDOWN_SELECTOR =
    'details-dialog[aria-label*="File extensions" i], .js-file-filter-dialog';

  const enhanced = new WeakSet();

  function enhance(dropdownEl) {
    if (enhanced.has(dropdownEl)) return;
    enhanced.add(dropdownEl);
    log('dropdown detected, enhancement pending', dropdownEl);
    // TODO: build the multi-select UI + Apply button here.
  }

  function scan(root) {
    if (!(root instanceof Element)) return;
    if (root.matches?.(DROPDOWN_SELECTOR)) {
      enhance(root);
      return;
    }
    root.querySelectorAll?.(DROPDOWN_SELECTOR).forEach(enhance);
  }

  const observer = new MutationObserver((mutations) => {
    for (const m of mutations) {
      m.addedNodes.forEach(scan);
    }
  });

  observer.observe(document.body, { childList: true, subtree: true });
  scan(document.body);

  log('initialized on', location.href);
})();
