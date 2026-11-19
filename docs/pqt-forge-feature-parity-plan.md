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

The Windows Electron fixture exercises Websites with isolated IPC, including scoped Cron navigation, a Laravel scaffold draft, legacy-compatible backup, alias links, hosts shortcuts and subdirectory websites. Separate Windows runtime fixtures served requests with Nginx, Apache with PHP-CGI, and Tomcat 9. They use temporary configuration, explicit loopback ports and an isolated test certificate. These runs verify generated server files and their behavior after a restart. Platform acceptance for OS hosts changes, system trust, Caddy and FrankenPHP runtime, and macOS and Linux service execution remains open.

## Phase 2 — services, runtimes, packages, and databases

- [ ] Finish comparison and migration for online packages, installed and current versions, install/update/remove, timeout and failure reporting. Package Library exposes Homebrew formulae, install/uninstall, macOS bootstrap and the existing macOS PHP upgrade flow. Generic MacPorts, SDKMAN and dedicated version managers still differ. Live macOS Homebrew execution remains to be verified.
- [ ] Add module-specific configuration, bounded log tail/clear, and companion-service behavior for the migrated service-file and lifecycle paths.
- [ ] Migrate database admin tools, credentials, ports, and data-directory workflows for the supported database panels; unsupported module-specific fields remain explicit.
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

The build smoke test verifies dist/render/next.html; it does not prove interactive UI parity.

The opt-in Windows server checks take paths to existing binaries. Run yarn test:pqt-forge-native-apache with paths to httpd.exe, php-cgi.exe and openssl.exe. Run yarn test:pqt-forge-native-nginx with paths to nginx.exe and openssl.exe. Run yarn test:pqt-forge-native-tomcat with paths to java.exe, the Tomcat distribution directory and openssl.exe. Quote any argument that contains spaces.


