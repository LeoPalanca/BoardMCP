# Local Board MCP

Working read-only MCP for local Board, using your authenticated Firefox session. Version 1.3.0 adds recursive Capsule inventory; restart Codex after updating the registered board-local server. Node 22+ required. No npm packages required.

## Use

1. Run Open-BoardFirefox.ps1 in your normal Windows account. It opens a separate Firefox profile under %LOCALAPPDATA%/BoardMCP/firefox-profile.
2. Sign in to Board with your regular account and leave that Firefox window open. Sign in again there if the session expires.
3. Restart Codex if board-local tools are not loaded. Ask it to list Board models, Capsules (including folders), entities, members, relationships, cubes, or read cube values from existing capsule screens.

The connector navigates that dedicated window. Use your usual browser for other work during reads. Firefox automation listens on 127.0.0.1:9228, verified 2026-09-24. Session information stays in Firefox; the connector does not extract passwords or tokens.

## Tools and limits

- list_models: model links rendered on the authenticated Data Models page.
- list_capsules: Capsule screens discovered in the root list and nested folders, with folder paths. This lists Capsule routes; it does not inspect their contents.
- list_entities(model): entity grid metadata, including member counts and physical names.
- list_cubes(model): cube grid metadata, including types, versions and file sizes.
- list_entity_members(model, entity?): member codes, descriptions, and additional rendered fields; omit entity to read each Entity.
- list_relationships(model): parent-child hierarchy edges from the Relationships tree.
- read_cube_data(model, cube): values returned by existing capsule DataView screens for the selected Cube, including screens discovered in nested folders, along with screen dimensions and row/column labels.

Column labels follow the Board session language. Grid reads report detected filters, paging, and possible additional rows. Cube values come from existing DataView layouts and can reflect their filters, selections, aggregations, and visible dimensions; they are not a guaranteed dump of every stored cell. A Cube with no matching screen returns no view results, which does not by itself prove the Cube is empty. No model edits or procedures are exposed. Requests are serialized within each MCP process; avoid simultaneous reads from multiple MCP processes.

## Firefox extension: initial read-only inventory

The extension is in [`firefox-extension/`](firefox-extension/). Load it in the Firefox profile where you are signed in to Board. **Analyze** requests access to only the active page's origin, then reads the Data Models and Capsules lists in background tabs without moving the open page. See its [README](firefox-extension/README.md) for setup and permission details.

After inventory, expand the collapsed Data Models and Capsules lists to select a scope and choose **Start read**. Or use **Analyze and read all** to select and read every discovered item. Both read visible Entity members, Cube metadata, Relationships analysis, and selected Capsule page contents, then automatically download a Markdown report labeled for Claude, Codex, or a custom agent. The extension does not call those agents or edit Board data. Paginated and virtualized content may be partial.

Future improvements: improve coverage of paginated and virtualized grids, capture full DataView cell layouts with filters and dimensions, and add a structured JSON snapshot with explicit completeness markers. The Markdown report remains a human-readable handoff. The current connector and extension remain read-only; any future edit capability will be a separate addition.

## Future desktop app (planned, not implemented)

The longer-term direction is a local desktop chat app that can start a Codex or Claude coding-agent harness and give the selected agent access to Board through the read-only MCP tools. The Firefox extension remains the current inventory and report workflow; this section describes a future design only.

### Proposed design

- **Desktop UI:** Electron with React, reusing the project's Node.js environment. A chat view streams agent responses and tool activity, with a Board scope panel for model and Capsule selection.
- **Local broker:** The Electron main process starts and supervises the chosen local agent and its MCP connection. The renderer communicates with the broker through a small, explicit IPC interface.
- **Codex:** Integrate through the supported Codex App Server protocol, which provides a JSON-RPC interface for custom clients and streamed events. See the [Codex App Server documentation](https://developers.openai.com/codex/app-server).
- **Claude:** Integrate through the Claude Agent SDK or Claude Code's streaming CLI interface. See the [Claude Agent SDK documentation](https://code.claude.com/docs/en/agent-sdk/overview) and [CLI reference](https://code.claude.com/docs/en/cli-usage).
- **Board access:** Configure the selected agent to use the existing Board MCP capabilities. Keep the current Firefox-backed login and read-only tools for the first version, and serialize browser reads so concurrent agent sessions cannot navigate the same Board session at once.

### Intended user flow

1. Choose Codex or Claude and start a local agent session.
2. Run an initial Board inventory to discover Data Models and Capsules.
3. Select the models and Capsules to inspect, or choose a read-all action.
4. Follow agent responses, Board tool calls, and read progress in the chat UI.
5. Save a Markdown report and a structured JSON snapshot with scope, timestamps, and completeness limits.

### Board read report specification

Every selected route should produce a page record, even when extraction finds no content. Include the Board site, route and URL, Data Model or Capsule identity, read timestamp, extraction status, and warnings. Use explicit statuses such as `complete`, `partial`, `empty`, `unavailable`, and `error`; do not leave a section blank or treat “no rows detected” as proof that Board contains no data. Markdown should be easy to read, while JSON should preserve the same records and status details for later agent use.

For each page type, capture:

- **Cubes page:** each visible Cube's name, physical name, primary structure (Entities/dimensions), versions, and available type/size metadata. Where the UI exposes it, capture Cube analysis: sparsity and combination count, plus references to Data Readers, Dataflows, Screens, and Procedures that use it. Record filters, paging, visible columns, and extraction status; the page supports search and configurable columns, so a visible table may not show every property. If no rows are extracted, report an unresolved inventory rather than implying the model has no Cubes. Board describes a Cube as multidimensional data whose cells are intersections of its dimensions; a rendered DataView is therefore a query result, not necessarily a full Cube dump. See [About Cubes](https://help.board.com/docs/about-cubes) and [Manage Cubes](https://help.board.com/docs/manage-cubes).
- **Relationships page:** hierarchy parent-child edges and counts; the full visible Board Analyze findings, including issue names and affected members; and any single-occurrence relationship rows and counts. Board relationships are many-to-one hierarchies; parallel rollup paths are possible, and unbalanced hierarchies can store parent-child links within one Entity. Analyze checks for orphan members, while members without children are another integrity concern. Record separately whether each section loaded, had rows, was empty, or could not be read. “No hierarchy rows detected” is an observation about the scan, not a verified absence of relationships. See [About Relationships](https://help.board.com/docs/about-relationships), [Create a Relationship](https://help.board.com/docs/create-a-relationship), and [Unbalanced hierarchies](https://help.board.com/v15/docs/unbalanced-hierarchies).
- **Capsule screen:** Capsule and folder identity, screen name and URL, headings, visible text and tables, and each rendered object where identifiable. A Capsule stores Screens/Procedures and their report/layout definitions, not the underlying data. Capture the associated Data Model(s), DataView data blocks, axes/dimensions, and active filters/selections where exposed: Board says Layout results can depend on security, Screen Select, Pagers/Selectors, and Layout Select. Record visible values with that context, along with pagination, virtualized content, unavailable objects, and other limits. A DataView can export CSV/Excel/PDF, so investigate its read-only export as a possible richer extraction path; an export still needs its active query context and does not by itself establish a full Cube dump. A report containing only the page title and URL must be marked incomplete. See [Capsules](https://help.board.com/docs/capsules), [About Screens](https://help.board.com/docs/about-screens), [About the Layout](https://help.board.com/docs/about-the-layout), and [About Screen Objects](https://help.board.com/docs/about-screen-objects).
- **Entity pages:** entity name and physical name, member count, visible member codes/descriptions and other fields, plus paging and filters. Distinguish a confirmed empty entity from member rows the scan could not retrieve.

For example, a report that contains only `LucaTest25 / cubes` and its URL, `No hierarchy rows detected` with an empty Analyze section, or a Capsule title and URL does not yet satisfy this specification. Those sections need either extracted content or a clear partial/unavailable result with the reason. This is a future reporting requirement; the current extension and MCP behavior have not been changed here.

### Suggested implementation sequence

1. Create the Electron chat shell and a provider interface for starting, continuing, and stopping agent sessions.
2. Add one provider at a time, beginning with Codex App Server and then Claude's SDK or streaming CLI.
3. Add the Board inventory panel and connect the current read-only MCP tools.
4. Add selection-scoped reads, progress and error reporting, and Markdown/JSON exports.
5. Consider Board editing only as a separate future capability with explicit per-action approval.

The first desktop version should use the authenticated Firefox profile already managed by BoardMCP. Reading an arbitrary Firefox window would need a separate browser integration, such as an extension-to-desktop native messaging bridge. Do not assume the app can reuse a user's CLI authentication until each provider's local setup has been confirmed.

## Verification

Run: node Test-Mcp.cjs

This tests MCP stdio initialization, tool discovery, the original three live metadata reads, and invalid model rejection. Verified 2026-09-24: Leonardo; six entities (Fornitori, Materia Prima, Regione, Tipologia fornitore, Prodotti, Negozi); two cubes (Ordini, Fatturato). Both grids reached bottom without detected filters or extra pages. The expanded reads use the same authenticated Firefox profile.

## Original Public API

The Board 15.1 Public API still fails with HTTP 500 due to unresolved IImpersonificationService. The MCP now uses Firefox. See BOARD-API-ISSUE.md. Original PowerShell setup/diagnostic scripts remain for retesting after a Board repair. Their DPAPI credentials under LocalAppData/BoardMCP/client.xml are unused by the Firefox connector. Test-BoardMcp.ps1 tests the original API; Test-Mcp.cjs tests the working MCP.

## License

MIT. See [LICENSE](LICENSE).
