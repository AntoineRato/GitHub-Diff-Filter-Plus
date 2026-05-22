# Privacy Policy for GitHub Diff Filter Plus

**Effective date:** 2026-05-22

**Author:** Antoine Rato

GitHub Diff Filter Plus does not collect, store, transmit, or share any
personal information whatsoever. This page describes what little data
the extension touches and where it lives.

## What the extension does with data

The extension stores **one** record locally, only when you explicitly
opt in by enabling the "Remember last selection" setting in the popup:

- A boolean preference: whether to remember your last filter selection.
- If enabled: the list of file extensions you last applied as a filter
  on a Pull Request (e.g. `[".cs", ".meta"]`).

This data is stored exclusively via Chrome's `chrome.storage.sync` API,
which means:

- It lives only inside your own Chrome profile.
- It is synchronized between your Chrome installations only through
  your own Google account, using Google's sync infrastructure.
- It is never sent to the extension author, to any server controlled by
  the author, or to any third party.
- The extension does not make any outgoing network request, ever.

If you uninstall the extension or disable the setting, this data is
discarded.

## What the extension does NOT do

- No analytics, no telemetry, no crash reporting.
- No tracking of which Pull Requests you view, which filters you apply,
  or how often you use the extension.
- No advertising identifiers, no fingerprinting.
- No remote code execution. All code is bundled with the extension and
  reviewed by Chrome Web Store before each release.
- No interaction with services other than GitHub itself (and only via
  the content script on `https://github.com/*` Pull Request pages).

## Permissions requested

| Permission | Why it is needed |
|---|---|
| `storage` | Persist the single preference described above. |
| `host_permissions: https://github.com/*` | Required so the content script can detect and enhance the native file filter dropdown on Pull Request pages. |

No other permissions are requested.

## Data sharing with third parties

None. The extension exchanges no data with any third party.

## Children's privacy

The extension is not directed at children and does not knowingly
process any data from anyone, including children, beyond the local
storage entry described above.

## Changes to this policy

If this policy is ever updated, the new version will be published in
this same file with a new "Effective date". Since the extension is
open source, the full history is visible in the public git log.

## Contact

For questions, issues, or feedback:

- GitHub issues: https://github.com/AntoineRato/GitHub-Diff-Filter-Plus/issues
- Email: antoine.rato@gmail.com
