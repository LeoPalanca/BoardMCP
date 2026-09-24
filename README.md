# Local Board MCP

Working read-only MCP for local Board, using your authenticated Firefox session. Registered in Codex as board-local; Node 22+ required. No npm packages required.

## Use

1. Run Open-BoardFirefox.ps1 in your normal Windows account. It opens a separate Firefox profile under %LOCALAPPDATA%/BoardMCP/firefox-profile.
2. Sign in to Board with your regular account and leave that Firefox window open. Sign in again there if the session expires.
3. Restart Codex if board-local tools are not loaded. Ask it to list Board models, entities, or cubes.

The connector navigates that dedicated window. Use your usual browser for other work during reads. Firefox automation listens on 127.0.0.1:9228, verified 2026-09-24. Session information stays in Firefox; the connector does not extract passwords or tokens.

## Tools and limits

- list_models: model links rendered on the authenticated Data Models page.
- list_entities(model): entity grid metadata, including member counts and physical names.
- list_cubes(model): cube grid metadata, including types, versions and file sizes.

Column labels follow the Board session language. Reads scroll and collect rendered rows. possibleMoreRows, filtered, and allRowsRead indicate detected limits. Pagination, collapsed groups, and UI filters can limit results. These are UI metadata, not the complete Public API schema, entity members, cube dimensions, or cube values. Model discovery covers rendered links. No model edits or procedures are exposed. Requests are serialized within each MCP process; avoid simultaneous reads from multiple MCP processes.

## Verification

Run: node Test-Mcp.cjs

This tests MCP stdio initialization, tool discovery, all three live reads, and invalid model rejection. Verified 2026-09-24: Leonardo; six entities (Fornitori, Materia Prima, Regione, Tipologia fornitore, Prodotti, Negozi); two cubes (Ordini, Fatturato). Both grids reached bottom without detected filters or extra pages.

## Original Public API

The Board 15.1 Public API still fails with HTTP 500 due to unresolved IImpersonificationService. The MCP now uses Firefox. See BOARD-API-ISSUE.md. Original PowerShell setup/diagnostic scripts remain for retesting after a Board repair. Their DPAPI credentials under LocalAppData/BoardMCP/client.xml are unused by the Firefox connector. Test-BoardMcp.ps1 tests the original API; Test-Mcp.cjs tests the working MCP.
