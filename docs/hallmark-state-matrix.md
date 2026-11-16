# Hallmark state matrix

This matrix is the acceptance contract for the 71 module routes and the two system routes. It is intentionally separate from the fixture report: a route may render safely in the IPC fixture while still needing visual review for its business states.

## Shared states

Every interactive surface is reviewed for:

- default, hover, focus-visible, active, disabled
- loading, empty, error, success
- running/starting/stopping where the route manages a service
- responsive widths 320, 375, 414, 768, 960, 1280 and 1440 CSS pixels
- light and dark themes

## Layout families

| Family | Routes | Shared owner | Required visual checks |
| --- | --- | --- | --- |
| Service workbench | web servers, databases, queues, governance, email, DNS, FTP, search, storage, tunnels | ServiceManager + VersionManager | service table, running row, start/stop/restart, unavailable version, refresh/loading |
| Language project | Bun, Deno, .NET, Erlang, Flutter, Go, Java, Node, Perl, PHP, Python, RoadRunner, Ruby, Rust, Swoole, Zig | LanguageProjects + VersionManager | project list, empty projects, create flow entry, version source tabs |
| AI workspace | AI coding routes, AI service routes, MCP, Ollama, Hermes, OpenClaw, n8n | module-local workspace components | installed/uninstalled, conversation/config tabs, session empty/error |
| Site workbench | Hosts, MkCert | Host and certificate stores | empty hosts, add/edit, sort, SSL/error notices |
| Console | Startup Group | StartupGroupManager | empty groups, reorder, partial failure, running state |
| Container runtime | Podman | Podman singleton controller | loading, install, terminal, machine list, compose empty state |
| Focused utility | Tools, Cron, Git, HTTP Server | module-local controllers | focused empty/loading/error and touch targets |
| System | Setup, CustomerModule | existing Pinia/module owners | settings navigation, module list, plugin state, custom module empty state |

## Operation contract

Visual refactors do not introduce operations. Existing controllers, Pinia stores, IPC listeners and fork modules remain authoritative. A visual change is accepted only when it does not move progress, notices, terminal results, duplicate guards or cleanup into a page-only component.

## Evidence locations

- Route inventory: .hallmark/inventory.json
- Locked design system: design.md
- Migration status: docs/hallmark-migration.md
- Safe renderer fixture: scripts/hallmark/preview.ts, scripts/hallmark/serve.ts, scripts/hallmark/audit.cjs
- Platform reports: tmp/hallmark/audit/full-windows/report.json, tmp/hallmark/audit/full-macos/report.json, tmp/hallmark/audit/full-linux/report.json

## Evidence status

The route-level audit is accepted when the fixture reports `errors: []`, no clipped controls and `scroll === width` at the tested viewport. This proves renderer layout safety only. It does not prove a real service starts, stops, installs, downloads or persists correctly; those behaviours remain covered by the existing operation and platform test suites.
