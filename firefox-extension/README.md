# Board Snapshot Assistant (Firefox)

A local, read-only proof of concept for reviewing the current Board page in the Firefox profile where you are already signed in. It does not assume `localhost`, does not navigate away from the active tab, and does not send page content to Claude, Codex, or any remote service.

## What it does

- Lets you choose Claude, Codex, or a personalized agent label. The selection is stored in Firefox extension storage; it does not authenticate to or call that agent.
- After you click **Analyze active tab**, inspects the current page URL, visible headings, and visible same-origin links for Board Data Model and Capsule route patterns.
- Shows the discovered names with checkboxes to record a future deep-scan scope.
- Copies or downloads an initial Markdown report that records the selected agent, discovered items, and scan limits.

The first pass only inspects the active top-level page. It does not crawl other pages, inspect DataView cell values, run Board's Analyze action, or edit Board data. The checkboxes currently record intent only; deep scanning is a later stage. Items not linked from the current page are not discovered, so this is not a complete inventory. Embedded frames are reported by host, but their contents are not inspected.

The extension requests `activeTab` and `scripting` so the user-initiated scan can inspect only the page open when the toolbar button is clicked. It has no broad host permissions, background scripts, or network calls. Cross-origin frames and restricted browser pages cannot be inspected by this first version.

## Load it in Firefox

Load the extension in the Firefox instance and profile where you are signed into Board:

1. Open `about:debugging#/runtime/this-firefox` in that Firefox instance.
2. Choose **Load Temporary Add-on...**.
3. Select this folder's `manifest.json`.
4. Open a Board page, click the extension toolbar button, choose the reviewing agent, and select **Analyze active tab**.

Firefox temporary add-ons are removed when that Firefox session closes. For regular use, the extension will need a signed package or another installation method supported by your Firefox setup.
