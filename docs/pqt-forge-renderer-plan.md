# PQT Forge renderer implementation plan

The new UI is an independent renderer surface. It does not import or extend the legacy shell, sidebar, dialogs, or layout components. Existing IPC, fork modules, and service lifecycle code will be connected later through adapters.

## Current slice

- Added `src/render-next/next.html` and `next-main.ts` as a separate renderer entry.
- Added a fixed 800x600 PQT Forge shell with title bar, workspace sidebar, status bar, and placeholder workspaces.
- Added the first design tokens and the PQT mark component.
- Added an Overview screen with service metrics, active services, quick actions, and loading-ready visual states.
- Added the Services workspace with filterable service list, detail panel, status badges, and independent start/stop/restart controller states.
- Added independent task progress dialog and notice rail for operation feedback.
- Added the Websites workspace with project search, online/draft states, host details, runtime/server facts, and project actions.
- Added Runtimes and Databases workspaces with version/health lists, detail facts, and management action surfaces.
- Added the Tools workspace with command search, category filters, recent tools, and launch feedback.
- Added Settings workspace with General, Appearance, and About sections plus a global ⌘K command palette.
- Added Logs workspace with live-style timeline, search, severity filters, clear and export actions.
- Added a renderer service adapter that reuses the established ModuleInstalledItem lifecycle when the host is initialized, with a safe preview fallback.
- Added runtime and database adapters that refresh installed versions and process state from the existing BrewStore/Module domain when available.
- Added an Electron renderer switch for the fixed 800x600 PQT Forge renderer and a smoke test covering all current screens.
- Added dev-runner logging and a post-build smoke check for the packaged `dist/render/next.html` entry.
- Added Logs workspace with live-style timeline, search, severity filters, clear and export actions.
- Added the Tools workspace with command search, category filters, recent tools, and launch feedback.
- Added an isolated `nextBuildConfig` and `build:pqt-forge-next` script so the new entry builds without changing the legacy renderer input graph.
- Added local font assets for the new renderer and Vite URL imports, removing unresolved references to legacy font paths.
- Added the PQT Forge SVG mark to the packaged static assets and selected it for the Electron window icon.
- Wired the same mark into the system tray and updated the tray tooltip to `PQT Forge`.
- Verified the Electron development runner with the default renderer; startup selected the 800x600 path and reached `ready-to-show`.
- Replaced Overview service fixtures with the shared renderer service controller and live adapter refresh; running count and health now derive from detected service state.
- Added stale-operation protection and duplicate invocation guards to the service controller, with a dedicated lifecycle smoke contract.
- Added a project adapter that refreshes Websites from the existing host domain store with a safe empty-state fallback.
- Added installed-state handling to Runtime and Database adapters so unavailable versions are represented accurately in the new UI.
- Added a generated PQT Forge icon pipeline for PNG window/tray assets and a multi-size Windows ICO output used by the packaging workflow.
- Added Linux desktop icon sizes under `build/pqt-forge-icons` and changed the Linux desktop metadata to display `PQT Forge`; macOS remains on the existing signed ICNS until a native ICNS generation step is available on the target runner.
- Wired the new title-bar controls to the existing Electron IPC commands for minimize, maximize/restore, and close.
- Made PQT Forge the default Electron renderer; the legacy renderer remains available only with `PQT_FORGE_NEXT_RENDERER=0`.
- Added a packaging smoke contract covering the built renderer and all PQT Forge window/tray/Windows/Linux assets.
- Made the custom title bar draggable with Electron `-webkit-app-region`, while excluding window controls with `no-drag`.
- Connected PQT Forge Settings to the existing async storage layer so preferences survive renderer reloads.
- Connected the Logs workspace to the existing `APP-On-Log` IPC stream; the default timeline is now empty until real events arrive.
- Aligned the Logs parser with the main-process event format and corrected `AppLog.info()` to emit the info level.
- Connected the JSON formatter tool action to the existing external-browser IPC adapter; other tools retain an explicit ready state until their native panels are implemented.
- Added global numeric workspace shortcuts and a Logs entry to the command palette; text inputs remain protected from global key handling.
- Connected the Websites “Open site” action to the external-browser adapter with protocol selection from SSL state; drafts are guarded with an explicit notice.

## Deliberately deferred follow-up slices

1. Add native panels for the remaining toolbox utilities.
2. Add version installation/update controllers for Runtimes and Databases.
3. Add full website editing/configuration flows beyond host listing and browser open.
4. Generate a native macOS ICNS from the PQT Forge mark on the macOS signing runner.

The delivered renderer, adapters, persistence, IPC integrations, default Electron routing, icon packaging, and smoke contracts are complete for the first PQT Forge release slice.

## Operation contract

Long-running operations belong to module-local controllers. Each controller must own the immutable request snapshot, IPC listeners, progress events, terminal result, duplicate-invocation guard, retry/cancel behavior, and cleanup. Fork modules remain the source of truth for process, PID, port, and shutdown state.

## Package migration continuation — 2026-11-18

1. Repair next-renderer domain bootstrap: install the existing Pinia domain, consume the host snapshot/config/language and data-directory events, acknowledge renderer readiness, and show recoverable startup errors. Do not import the old shell, views or styles.
2. Replace package transport/controller with real catalog and installation results. Add a shared independent package browser to Runtimes, Services and Databases, including installed versions, search, retry, actual download progress, background continuity and explicit removal confirmation.
3. Remove simulated service success/progress. Read lifecycle outcomes from ModuleInstalledItem and refresh the current domain state after package changes.
4. Record a source-backed old-to-new feature inventory; keep incomplete feature families visibly pending instead of claiming full parity.
5. Verify lifecycle behavior, entry-page ownership, type checking, renderer build and runtime screens.

## Functional migration continuation — 2026-11-18

1. Replace the sample website list with authoritative host records, including an empty state. Build an independent website editor (domain/aliases/root, PHP, per-server ports, SSL, rewrite, reverse proxies), persistent create/edit/remove, and host log access. Preserve unsupported project types and all unedited fields.
2. Replace placeholder toolbox actions with local JSON, Base64, JWT decode, hashes and text comparison panels; expose unsupported tools as pending instead of claiming they opened.
3. Repair duplicate bootstrap and initialize domain language without importing legacy views or styles. Fix runtime provider omissions and the database package launcher.
4. Record a source-backed migration matrix and run targeted lifecycle tests, ownership checks, typecheck and renderer build. Do not install/remove actual packages for verification.

### Operation contracts for this continuation

No module constraint exceptions are authorized. Editor inputs, panel visibility and local utility inputs belong to their mounted Vue components. Hosts and installed PHP versions remain in AppStore/BrewStore. New operation owners are module-local singletons exposed with reactiveBind. No new Pinia store or config.setup keys are added.

| Operation | Owner and lifetime | Events and duplicates | Failure boundary and verification |
| --- | --- | --- | --- |
| Website catalog | WebsiteController, renderer lifetime, domain dependency injected | One shared refresh flight; terminal success replaces even an empty list; refresh error retains prior records with explicit error | Read required for list; service state unknown is never called online; test empty refresh, duplicate and stale selection |
| Website save/remove | WebsiteController, renderer lifetime; immutable host snapshots | One mutation flight; code 200 retained as progress; code 0 with authoritative host list commits; failure/unknown timeout terminal; release flight in finally; closing editor does not cancel | Validation/data directory and backend write required; domain reconciliation, hosts/DNS sync and restart of already running web servers supplementary and report warnings independently; unknown write outcome blocks replay until explicit reconciliation. Tests duplicate, rejection/retry, progress, unmount continuity and committed write with refresh failure |
| Host logs | WebsiteController, renderer lifetime, read-only on explicit request | Per-file request generation; bounded tail IPC uses existing log backend; terminal text/error cleans request; stale result cannot replace current file | Missing log is explicit empty/error, no writes; logs never affect completed website save |
| Local utility transform | Mounted independent utility panel, no process/service ownership | Synchronous transforms local; async digest tracks input generation and ignores obsolete results | Invalid input stays in panel; no network, process or persistence; tests Unicode Base64, JWT decode-only, invalid JSON and hash vectors |
| Renderer bootstrap | Renderer-lifetime initialization flight | Duplicate APP-Ready-To-Show does not reinstall listeners or remount; language completion/warning before domain actions; ready acknowledgement once | Config required for commands, language failure supplementary; no ThemeInit because next CSS tokens are independent |

The host-log slice exposes file-manager reveal only (no automatic read/watch, truncation or clearing). An unknown host-write result stays locked for this renderer session even after a list refresh, because a still-running backend write cannot be disproved by a read. Website post-save restarts reuse each already-running ModuleInstalledItem.restart(); false/string failures are warnings and cannot replay the committed write.

| Additional operation | Owner and lifetime | Events and duplicates | Failure boundary and checks |
| --- | --- | --- | --- |
| Database lifecycle | Existing serviceController / ModuleInstalledItem, renderer lifetime | Database entry delegates to the established service controller, awaits terminal result, then refreshes domain display | Refresh supplementary, no inferred connection count or storage; no parallel lifecycle for the same version; package launcher opens actual package dialog |
| Native lifecycle parameters | Module-local registration helpers, renderer lifetime; registered before invoking installed item lifecycle | Registration shares a preparation flight; data-directory bindings are read from the existing module storage keys, not copied into shared config | Loading a saved data directory is required before start/stop for that module; errors block only that requested module. Neo4j uses its existing Java binding manager; no parallel process lifecycle |
| Bootstrap configuration | Next bootstrap controller, renderer lifetime | One config request; timeout removes IPC listener, records recoverable error; retry loads config without remounting or resetting host; language failure is a warning | Config must be validated before INIT_CONFIG. Keep shell mounted on failure, with domain commands disabled until retry succeeds. Language/bootstrap notices use next state before mount |

### Ownership and operation contracts

No exceptions to module constraints are authorized or needed. Existing installed versions/configuration remain in BrewStore/Module/AppStore; no new Pinia store or shared-config persistence is added. Browser search, selected package category, modal visibility and typed deletion confirmation are local component state. New operation controllers are module-local classes bound with reactiveBind. Backend processes/PIDs remain fork-owned.

| Operation | Owner/lifetime and events | Duplicate behavior and cleanup | Dependencies and failure boundary | Focused checks |
| --- | --- | --- | --- | --- |
| Host bootstrap | Next bootstrap controller, renderer lifetime; starts on APP-Ready-To-Show, receives global/data-directory/privilege broadcasts; config completion or startup error is terminal | One initialization flight; acknowledge renderer once; listeners belong to renderer; retry initialization without remounting UI | Host/config required for domain commands; language warning supplementary; no mounting old shell | Initialization gating, readiness, failure/retry |
| Package catalog | PackageController, renderer lifetime; per-module load begins from browser; code 200 remains intermediate, code 0/data or error/timeout is terminal | Same-module calls share one flight; distinct module catalogs cannot overwrite one another; transport removes timers/listeners at terminal events | Metadata required for installation; invalid candidates skipped individually with reason; empty catalog distinct from transport error | Concurrent module loads, duplicate load, errors/retry, page reentry |
| Package install | PackageController, renderer lifetime; immutable package snapshot; backend progress retained until terminal success/failure | One mutation at a time; duplicate invocation cannot issue a second request; navigation/dismissal does not cancel; terminal cleanup in finally | Install result is required (including code 0/data false as failure); installed-domain refresh is supplementary and never replays completed work | Real progress, false terminal result, rejection/retry, background continuity, supplementary refresh failure |
| Managed version removal | PackageController plus existing VersionDeleteOperation; explicit typed confirmation and inspected immutable directory identity; stop, remove, committed/refresh | One mutation at a time; invalid confirmation does not stop/delete; identity rechecked before stop and in main before delete; terminal cleanup | Confirmed identity and ModuleInstalledItem.stop() success required; completed delete survives metadata/refresh failure; external unmanaged versions cannot be deleted | Cancel/wrong phrase, identity drift, failed stop, duplicate removal, partial completion |
| Service lifecycle | Service controller and existing ModuleInstalledItem; starts directly on action; promise outcome is terminal, refresh reports actual domain state | Duplicate same-service action guarded; group awaits each real terminal outcome; finally releases action state | No preview success or timer-simulated liveness; missing/unavailable service is failure; independent group items continue and retain outcomes | Missing version, false result, actual lifecycle completion, group ordering |

Verification must not install or remove a real customer package without an explicit test target. Runtime checks may list packages and exercise safe error/confirmation paths.

## Parity continuation — 2026-11-18 (current pass)

1. Replace remaining Overview fixtures with authoritative host counts, name service availability accurately, and route its group action to the saved default startup group.
2. Add an independent Startup groups workspace/editor using the existing StartupGroupManager, store, candidate rules and ordered runner. Migrate list, add/edit/remove, member selection/order, default group and start/stop results without mounting legacy views.
3. Add independent Configuration and Logs dialogs to Services/Databases. Discover paths via each fork module's listConfigFiles/listLogFiles; offer explicit strict reads, guarded configuration saves and file reveal. Never invent paths or silently create missing files.
4. Repair host IPC terminal cleanup and verify directory/file API contracts; preserve unknown write results and completed writes when supplementary actions fail.
5. Run controller/lifecycle tests, typecheck, production build and UI checks. Keep an exact source-backed parity matrix, including limitations.

No module exceptions are authorized. Existing group persistence remains under qtenvdev-startup-groups via the established store. Draft inputs, selection, order and dialog visibility are component-local. New controller instances are renderer-lifetime singletons bound with reactiveBind; no new Pinia store or shared config keys.

| Operation | Owner/lifetime | Events, duplicates and cleanup | Failure boundary and verification |
| --- | --- | --- | --- |
| Startup-group catalog/candidates | Next startupGroupController, renderer lifetime, established domain manager | Shared preparation flight, explicit loading/error; source failure disables saving rather than discarding saved members | Saved group read and member discovery required for execution/editing; test duplicate refresh and candidate-load failure preservation |
| Group mutation | Next controller wraps established store add/update/remove/default/reorder | One serialized mutation, immutable draft, stale group detection, persisted result before UI success | Storage required; source/status refresh supplementary; preserve completed save; test rejected save, duplicate and stale editor |
| Group start/stop | Established StartupGroupRunner through next controller | Register module lifecycle parameters before execution; existing ordered queue, stop reversal, duplicate guard and member terminal results retained | Preparation required; preserve invalid/skipped/not-run/failed/started/stopped outcomes; refresh supplementary; no automatic process launch during verification |
| Service file catalog/read | Next ServiceFilesController, renderer lifetime; backend-owned file paths | Immutable module/version snapshot, per-selection generation; listener/timer cleanup at terminal reply; bounded-size strict read, no background watcher | Catalog and read required independently; missing/oversize/unreadable files stay explicit; stale replies never overwrite current selection |
| Configuration save | Same controller, renderer lifetime; immutable file/content snapshot | One write flight; reread baseline before write, explicit confirmed success or failed/unknown result; unknown blocks replay | File identity/content check and write required; no auto restart, install or fallback write; readback supplementary; test conflict, duplicate, timeout, navigation and committed save |

The failure-boundaries skill is deleted in the pre-existing working tree; its HEAD version was read with git show, without restoring the user's deletion. Configuration/log dialogs initially support raw config editing and explicit refresh/reveal; common-field forms, reset/import/export, live tail and log clearing remain separate parity work.

## Parity implementation — service files

- Added `ServiceFilesController` and `ServiceFilesDialog` to the new renderer. Services and databases now expose Configuration and Logs actions. The controller uses each fork module's authoritative `listConfigFiles`/`listLogFiles` response, strict file reads, guarded writes, refresh and file-manager reveal. Missing paths remain explicit; no invented file path or automatic restart is used.
- This slice preserves the legacy module boundary: fork modules remain the source of file ownership, renderer owns dialog/editor state, and writes use the existing strict IPC filesystem contract.
- Remaining parity work includes common-field configuration forms, log tail/watch/clear tools, database admin panels, PHP project/extensions/configuration, terminal, PATH/environment, hosts/DNS/cron, and customer/onboarding surfaces.
