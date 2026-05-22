# GitHub Diff Filter Plus

> Multi-select file type filters for GitHub PRs. Apply all at once.

Chrome extension that replaces the native "File extensions" filter on GitHub Pull Request "Files changed" pages with a multi-select dropdown and a single **Apply** button. No more page reloads on every checkbox click.

## Status

Early development. Not yet published on the Chrome Web Store.

## Install (developer mode)

1. Clone or download this repo.
2. Open `chrome://extensions` and enable **Developer mode** (top right).
3. Click **Load unpacked** and select this folder.
4. Open any GitHub PR's "Files changed" tab. The enhanced filter takes over.

## Project layout

```
manifest.json     # Manifest V3
content.js        # Content script that enhances the PR page
styles.css        # Styles injected into the page
popup.html        # Settings popup markup
popup.js          # Settings popup logic
popup.css         # Settings popup styles
icons/            # Extension icons (see icons/README.md)
```

## Privacy

This extension collects, transmits, and shares **no** personal data. The only
thing it persists (locally, via `chrome.storage.sync`) is your "Remember last
selection" preference and, if enabled, the list of extensions you last
filtered on. Nothing ever leaves your browser.

Full policy: [PRIVACY.md](./PRIVACY.md)

## License

[MIT](./LICENSE)
