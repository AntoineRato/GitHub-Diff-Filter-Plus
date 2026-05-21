# Icons

PNG icons required for Chrome Web Store publishing. Drop them here:

- `icon-16.png`: 16×16
- `icon-32.png`: 32×32
- `icon-48.png`: 48×48 (shown on the extensions management page)
- `icon-128.png`: 128×128 (Chrome Web Store listing)

Until real icons exist, the extension loads with Chrome's default placeholder.
Once the PNGs are added, wire them up in `manifest.json`:

```json
"icons": {
  "16": "icons/icon-16.png",
  "32": "icons/icon-32.png",
  "48": "icons/icon-48.png",
  "128": "icons/icon-128.png"
},
"action": {
  "default_popup": "popup.html",
  "default_title": "GitHub Diff Filter Plus",
  "default_icon": {
    "16": "icons/icon-16.png",
    "32": "icons/icon-32.png",
    "48": "icons/icon-48.png"
  }
}
```
