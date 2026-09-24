# Board Public API failure, 2026-09-24

MCP workaround verified 2026-09-24: board-local now uses authenticated Firefox UI reads. Live tests returned Leonardo, 6 entities, and 2 cubes. This avoids the Public API failure; it does not repair it. See README.md.

The local Board 15.1 on-premises Public API returns HTTP 500 for authenticated requests to:

- `GET /public/Leonardo/schema/Entities`
- `GET /public/Leonardo/schema/Cubes`
- `GET /public/presentations`

The Client API account has Schema permission and a Security Profile with access to `Leonardo`. `POST /identity/connect/token` succeeds using client credentials and `public-api` scope. The routes match local Swagger at `http://localhost/swagger/`. Both `localhost` and the machine hostname give the same failure. The HTTP response is `An unhandled error occurred` with a `cod_ref` value.

The local log at `C:\Program Files (x86)\Board\Board WebApi Server\App_Data\log\BoardWeb-20260924.log` records this exception for the corresponding requests:

> Cannot resolve parameter `Board.Web.Infrastructure.Security.IImpersonificationService impersonificationService` of constructor `Board.Web.PublicApi.V1.Services.AuthenticationService`.

The stack shows Autofac failing to activate `SchemaController` and `PresentationsController`. Example error reference: `1790252807092`. The installed Board Web API executable product version is `15.1.0.1.610725`; the log reports `15.1.1.0`.

This is a server-side Board Web API dependency failure. The local MCP connector is registered and can list model names from disk, but authenticated Schema reads remain unavailable until the Board Web API installation or configuration is repaired. No Client ID, secret, or token is included in this report.

Board's [support guidance](https://community.board.com/discussion/16523/how-to-open-a-case-with-the-red-banner-error/p1) asks on-premises users to attach the `BoardWeb-YYYYMMDD.log` file from `App_Data\log`. [Board's installer notice](https://community.board.com/discussion/20357/new-process-for-accessing-board-software-installers) says current Board 15 patches are obtained through Support.

## First recovery attempt

At a quiet time, restart only the **Board WebApi Engine** Windows service, then retry the read-only Schema call. Board's [Admin Portal documentation](https://help.board.com/docs/admin-portal) also describes Web service restarts. This briefly interrupts browser sessions. If HTTP 500 and the same `IImpersonificationService` exception persist, provide this report and the Web log to Board Support and ask for a verified Board 15.1 repair or patch. Avoid manual edits to Board assemblies or dependency registration without vendor guidance.

On 2026-09-24 at 15:48 Europe/Rome, both Board WebApi Engine and Board Engine were stopped and started successfully. Both services returned to `Running`, and Swagger responded HTTP 200. Fresh authenticated Entities and Cubes requests still returned HTTP 500. New log entries at 15:49 show the same unresolved `IImpersonificationService` dependency. A service restart did not resolve this installation's Public API failure.
