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

After inventory, select Data Models and Capsules and choose **Start agent read**. It reads visible Entity members, Cube metadata, Relationships analysis, and selected Capsule page contents, then lets you download a Markdown report labeled for Claude, Codex, or a custom agent. It does not call those agents or edit Board data. Paginated and virtualized content may be partial.

Future improvements: improve coverage of paginated and virtualized grids, capture full DataView cell layouts with filters and dimensions, and add a structured JSON snapshot with explicit completeness markers. The Markdown report remains a human-readable handoff. The current connector and extension remain read-only; any future edit capability will be a separate addition.

## Verification

Run: node Test-Mcp.cjs

This tests MCP stdio initialization, tool discovery, the original three live metadata reads, and invalid model rejection. Verified 2026-09-24: Leonardo; six entities (Fornitori, Materia Prima, Regione, Tipologia fornitore, Prodotti, Negozi); two cubes (Ordini, Fatturato). Both grids reached bottom without detected filters or extra pages. The expanded reads use the same authenticated Firefox profile.

## Original Public API

The Board 15.1 Public API still fails with HTTP 500 due to unresolved IImpersonificationService. The MCP now uses Firefox. See BOARD-API-ISSUE.md. Original PowerShell setup/diagnostic scripts remain for retesting after a Board repair. Their DPAPI credentials under LocalAppData/BoardMCP/client.xml are unused by the Firefox connector. Test-BoardMcp.ps1 tests the original API; Test-Mcp.cjs tests the working MCP.

## License

MIT. See [LICENSE](LICENSE).
