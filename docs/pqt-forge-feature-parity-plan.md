# PQT Forge feature parity plan

Updated: 2026-11-19

This document tracks the migration from the legacy renderer (src/render) to the independent renderer in src/render-next. A screen listed in the sidebar is not, by itself, evidence of parity. Each workflow must use a real domain adapter or clearly report that it is unavailable or incomplete.

See [the current parity audit](pqt-forge-parity-audit.md) for verified changes, open gaps and platform acceptance limits.

## Status vocabulary

- Complete: the new screen and its domain flow are connected; runtime acceptance may still be required.
- Partial: the screen exists, but some legacy options, providers, or error paths remain.
- Pending: no equivalent workflow has been migrated.

## Phase 0 — known parity gaps

- [x] Overview uses authoritative service and host adapters, reports unknown state when the desktop connection is unavailable, and does not invent health, uptime, or port values.
- [x] Services and databases use module-backed catalogs and distinguish unavailable, unknown, not-installed, stopped, and running.
- [x] Edit php.ini reads and writes the real configuration file and rejects a write when the file changed outside the editor.
- [x] The website editor preserves PHP/static, direct-project, and Tomcat host records and routes Tomcat hosts to the dedicated editor.
- [x] Cron supports global and website scope, validates five-field schedules, preserves individual operation results, and uses an in-app delete confirmation.
- [x] Runtime QA target is 1200x800; dev runner loads the new renderer at that size with working custom window controls and DevTools disabled by default.

## Phase 1 — websites and project workflows

- [x] Migrate website list and CRUD, saved order and pins, templates, links and QR, vhost and rewrite files, log preview and clear, TLS settings, subdirectory websites, system hosts controls, and website backup import and export.
- [x] Connect PHP, Node.js, Python and Go saved projects and scaffolding to the existing lifecycle, port and command editors, folders, configuration and logs. Java/Tomcat websites use the dedicated editor and backend.
- [x] Keep unsupported project types unchanged until their structure is understood by the new editor.
- [x] Verify ports, commands, TLS, proxy changes and post-save lifecycle behavior through the website and project controllers. Run native server fixtures with generated configurations.

The Windows Electron fixture exercises Websites with isolated IPC, including scoped and system tasks, CA file and command shortcuts, a Laravel scaffold draft, backup, alias links, hosts shortcuts and subdirectory websites. Windows runtime fixtures passed with Nginx 1.28.0, Apache 2.4.66 with PHP-CGI 8.3.30, Tomcat 9.0.106, Caddy 2.11.9, and FrankenPHP 1.13.5 with PHP 8.5.12. They use temporary configuration, loopback requests and certificate trust scoped to the fixture. The Caddy and FrankenPHP fixture also verifies that HTTPS switches to the updated reverse proxy destination. System hosts writes, OS trust changes and native macOS and Linux execution remain open.

## Phase 2 — services, runtimes, packages, and databases

- [ ] Finish comparison and migration for online packages, installed and current versions, and provider-specific actions. Package Library exposes Homebrew, MacPorts and SDKMAN. Runtimes exposes Node.js and Go managers, Git diagnostics and installation, and Composer. Live provider execution on macOS and Linux remains open.
- [ ] Finish module-specific configuration, bounded log tail and clear, and companion-service behavior. Services includes HTTP Serve, DNS Server, FTP Accounts, Podman and Cloudflare Tunnel.
- [ ] Finish database admin tools, credentials, ports and data-directory workflows. Databases exposes MySQL/MariaDB Create and Backup, MySQL instance groups, phpMyAdmin and slow logs, plus editable PostgreSQL data directories.
- [x] Preserve completed side effects when a refresh fails; package mutations retain terminal success and report refresh warnings, while unknown outcomes block replay.

## Phase 3 — toolbox parity

- [x] Compare all 36 registered legacy tools and the implemented CodeMake surface. `docs/pqt-forge-tool-audit.md` records the current routing and original gaps; complete established views restore the richer editors and controls, with separate behavior and render evidence.
- [x] Migrate Capturer and Site Sucker with correlated progress, cancellation, cleanup, duplicate/unknown guards, and file/network limits. Site Sucker preserves the URL substring filter separately from its numeric page cap. Local Electron integration covers real browser workers and native capture APIs/save behavior.
- [x] Complete all image option/preview groups, validated advanced options, favorites, custom URL tools/webview, and settings migrations. Settings initialization and serialized writes protect saved data during rapid panel closure or Save actions.

Phase 3 verification includes `test:pqt-forge-phase3`, `test:pqt-forge-tool-ui`, `test:pqt-forge-native-tools`, renderer operation boundaries, typecheck and the production renderer build. The UI fixture opens 38 panels and exercises JSON conversion, PHP's detached config editor, code-library Add, SVG cleanup, custom webview load/reload, and delayed settings initialization. Its IPC is isolated and is not native service acceptance.

Native Site Sucker evidence uses a local HTTP server to test pages/assets/CSS, retry, cancellation/window closure, limits and cleanup. Capturer evidence reads real Windows/Electron desktop sources without persisting desktop pixels, uses synthetic PNGs for real nativeImage/filesystem saves, and separately exercises the actual overlay canvas export. Interactive selection/annotations and user interaction with Save As remain manual acceptance; remote WebSocket/SSE endpoints and every installed service/tool combination were not exercised. These limits do not represent missing migrated controls or simulated completion of native operations.

## Verification

Relevant checks:

- yarn typecheck
- yarn test:pqt-forge-next
- yarn test:pqt-forge-next:build
- yarn test:renderer-operation-boundaries
- yarn test:pqt-forge-domain-adapters
- yarn test:pqt-forge-tools
- yarn test:pqt-forge-websites
- yarn test:pqt-forge-website-controller
- yarn test:pqt-forge-website-backup
- yarn test:pqt-forge-websites-ui
- yarn test:pqt-forge-cron
- yarn test:pqt-forge-homebrew-ui
- yarn test:pqt-forge-php-extensions-ui
- yarn test:startup-group-runner
- yarn test:pqt-forge-project-workflows
- yarn test:pqt-forge-phase3
- yarn test:pqt-forge-tool-ui
- yarn test:pqt-forge-native-tools
- yarn test:pqt-forge-native-apache
- yarn test:pqt-forge-native-nginx
- yarn test:pqt-forge-native-caddy
- yarn test:pqt-forge-native-database
- yarn test:pqt-forge-native-tomcat

The build smoke test verifies dist/render/next.html; it does not prove interactive UI parity.

### HTTP Serve operation contract

The HTTP Serve screen owns folder selection, drag feedback, removal confirmation and the selected QR code. A module-local renderer singleton owns its request snapshots, pending actions, notices, terminal results and IPC cleanup across navigation. There are no progress messages. A timeout leaves the outcome unknown until a fresh snapshot reports the saved folders and active servers. Duplicate mutations are blocked while the current request is pending. The existing main runtime owns the server, port, links and per-folder start/stop ordering. HTTP Serve has no installed binary or companion service.

Adding a valid folder saves it before trying to start it. If startup fails, the saved folder remains available for retry. Removing a folder requires a confirmed stop and then a successful preference write. A failed stop preserves the saved entry. Dropped folders are independent. Reuse the existing HTTP Serve preference key for compatibility and update only that key. No new store or shared configuration field is needed. Verify folder validation, native HTTP serving, duplicate start, authoritative status, listener shutdown and the legacy saved-folder entry point.

### Podman operation contract

Services opens a dedicated workspace using the established Podman machine, image, container and Compose views. The existing Podman singleton owns discovery across navigation and the established model classes own machine and container lifecycle, IPC and saved Compose definitions. The fork runs Podman and supplies authoritative state. Installation uses the existing Homebrew coordinator and its terminal outcomes and logs, with one request at a time. Rediscovery after installation is supplementary and preserves the package result. No new store, configuration key or service lifecycle is needed. Verify entry, failed discovery and retry, and opening a detected machine and its Compose tab.

### Dedicated runtime manager entry points

Runtimes opens the established Node.js manager, npm configuration editor and Go GVM panel. The renderer dialog selects and mounts a view. The existing fnm, nvm and GVM module state owns commands and terminal handles. Reopening the dialog uses the same module state. Source support follows the existing platform options for each manager. Verify the desktop entry points and Unix provider controls through renderer fixtures. Actual installs and version selection in the user shell require native platform acceptance.

The opt-in Windows server checks accept paths to existing binaries. Pass httpd.exe, php-cgi.exe and openssl.exe to `yarn test:pqt-forge-native-apache`. Pass nginx.exe and openssl.exe to `yarn test:pqt-forge-native-nginx`. Pass caddy.exe, frankenphp.exe and openssl.exe to `yarn test:pqt-forge-native-caddy`. Pass java.exe, the Tomcat distribution directory and openssl.exe to `yarn test:pqt-forge-native-tomcat`. Quote paths that contain spaces.

Pass `mysql` or `mariadb` and the path to its server executable to `yarn test:pqt-forge-native-database`. The fixture initializes a temporary data directory, binds to loopback and uses the administration backend for creation, account discovery and backup.


