// Settings popup. Persists user preferences via chrome.storage.sync.

const DEFAULTS = { rememberLast: false };

const checkbox = document.getElementById('rememberLast');

chrome.storage.sync.get(DEFAULTS, (settings) => {
  checkbox.checked = !!settings.rememberLast;
});

checkbox.addEventListener('change', () => {
  chrome.storage.sync.set({ rememberLast: checkbox.checked });
});
