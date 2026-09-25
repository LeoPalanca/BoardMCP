# Board Snapshot Assistant (Firefox)

A local, read-only Firefox extension for reviewing Board in the profile where you are already signed in. It does not assume `localhost`, does not navigate the active tab, and does not send page content to Claude, Codex, or any remote service.

The popup credits the extension to Leonardo Palanca.

## What it does

- Lets you choose Claude, Codex, or a personalized agent label. The selection is stored in Firefox extension storage; it does not authenticate to or call that agent.
- After you click **Analyze**, requests access to the active page's origin and reads the Board Data Models and Capsules list routes in temporary background tabs. It leaves the active tab where it is.
- Shows the discovered names with checkboxes and confirms the selected counts as you check them. **Start read** shows per-page progress and a completion summary while it reads the selected Data Models' Entity members, Cube metadata, and Relationships analysis, plus the visible content of selected Capsules.
- Automatically downloads a Markdown report when the read completes. It records the selected agent label, discovered items, selected-scope results, and scan limits.

The first pass reads Board's rendered list pages; if those routes cannot be found or the page redirects to sign-in, inventory can be incomplete. The selected read visits only checked routes, using temporary background tabs, and closes them when each read finishes. Model reads include visible Entity member rows, Cube metadata, hierarchy rows, and the Board Analyze report; Capsule reads include visible page text, headings, and rendered tables. Paginated or virtualized rows and DataView values may be partial. The extension never clicks **Fix Relationships** and does not edit Board data.

The extension uses `activeTab` for the starting page and requests optional access only to that page's origin so it can open the Board list and selected detail routes in the same signed-in Firefox profile. Firefox remembers the approved origin until you remove it from the extension's permissions. It declares no install-time access to all hosts and makes no direct API calls; background tabs load Board pages through normal browser navigation. Cross-origin frames and restricted browser pages cannot be inspected.

The extension uses Firefox's `downloads` permission to save the completed Markdown report automatically to the normal download location, without opening a Save As dialog.

## Load it in Firefox

Load the extension in the Firefox instance and profile where you are signed into Board:

1. Open `about:debugging#/runtime/this-firefox` in that Firefox instance.
2. Choose **Load Temporary Add-on...**.
3. Select this folder's `manifest.json`.
4. Open a Board page, click the extension toolbar button, choose the reviewing agent, and select **Analyze**. Approve access to that site when Firefox asks.
5. Expand the Data Models and Capsules lists and check what to inspect, then select **Start read**. Or choose **Analyze and read all** to select and read every discovered item. The Markdown report downloads automatically when the read completes.

The agent choice is a report label; this extension does not launch the selected AI agent. **Start read** scans the selected Board pages and saves `board-agent-read.md` to Firefox's normal download location. If a file with that name already exists, Firefox gives the new report a unique filename. Firefox temporary add-ons are removed when that Firefox session closes. For regular use, the extension will need a signed package or another installation method supported by your Firefox setup.
