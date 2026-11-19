# PQT Forge feature parity plan

Updated: 2026-11-18

This document tracks the migration from the legacy renderer (src/render) to the independent renderer in src/render-next. A screen listed in the sidebar is not, by itself, evidence of parity. Each workflow must use a real domain adapter or clearly report that it is unavailable or incomplete.

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

- [x] Complete host list and CRUD parity: sorting, templates, QR, vhost/rewrite, logs, and SSL state.
- [x] Complete PHP, Node.js, Python, and Go project workflows with saved project discovery, real start/stop lifecycle actions, ports, commands, folder/config/log access; Java/Tomcat hosts use the dedicated Tomcat editor and lifecycle path.
- [x] Keep unsupported project types unchanged until their structure is understood by the new editor.
- [x] Verify project ports, start commands, SSL/proxy changes, and post-save server restart behavior through the website controller and language-project lifecycle contracts.

## Phase 2 — services, runtimes, packages, and databases

- [x] Audit every legacy provider for online packages, installed versions, current version, install/update/remove, timeout, and failure reporting. Provider-specific update semantics are recorded in src/render-next/packages/capabilities.ts; native upgrade is used where available, version replacement is explicit for catalog providers, and unsupported native upgrades remain visible instead of being guessed.
- [x] Add module-specific configuration, bounded log tail/clear, and companion-service behavior for the migrated service-file and lifecycle paths.
- [x] Migrate database admin tools, credentials, ports, and data-directory workflows for the supported database panels; unsupported module-specific fields remain explicit.
- [x] Preserve completed side effects when a refresh fails; package mutations retain terminal success and report refresh warnings, while unknown outcomes block replay.

## Phase 3 — toolbox parity

- [ ] Compare every legacy tool input/action/output with its new panel.
- [ ] Migrate Capturer and Site Sucker with progress, cancellation, cleanup, and explicit file/network limits.
- [ ] Complete image pipeline options, favorites, custom tools, and tool-specific settings.

## Verification

Relevant checks:

- yarn typecheck
- yarn test:pqt-forge-next
- yarn test:pqt-forge-next:build
- yarn test:renderer-operation-boundaries
- yarn test:pqt-forge-domain-adapters
- yarn test:pqt-forge-tools
- yarn test:pqt-forge-websites
- yarn test:startup-group-runner

The build smoke test verifies dist/render/next.html; it does not prove interactive UI parity.


