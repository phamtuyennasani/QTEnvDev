# Capture and site workflow contract

No exceptions to AGENTS.md module constraints are authorized. Configurations use StorageGetAsync/StorageSetAsync; legacy stores are read only for migration. Renderer owners are module-local singleton classes exposed through reactiveBind. Inputs and filters belong to panels; immutable request snapshots and results belong to controllers. These are tool runtimes, not ModuleInstalledItem services; no service lifecycle is duplicated.

## Capturer

- Owner/lifetime: Capturer controller survives page closure. Main Capturer runtime owns windows and output writes.
- Start: validate and snapshot configuration; synchronize native settings, then open native capture window. Duplicate open/config requests are guarded.
- Intermediate: opened capture window. Opening is not a completed screenshot.
- Terminal: native saved/cancelled/failed event, or explicit native status reconciliation. IPC timeout is unknown, blocks replay, and permits status/stop reconciliation. Save/open-folder auxiliary failures never replay a screenshot.
- Stop/cleanup: native stop command closes the runtime; page unmount only detaches view state. Listener subscriptions live with controller and have explicit disposal.
- Tests: duplicate launch, settings snapshot, opening vs saved, cancellation, errors, timeout/unknown, status recovery, listener cleanup, persisted settings migration.
- Native verification: `pqt-forge-capturer-electron-test.ts` exercises actual Windows/Electron desktop sources, native PNG decoding and temporary filesystem saves, duplicate-save/session guards, invalid data/collisions, shortcut rollback and supplementary clipboard/reveal failures. Desktop pixels are not persisted. `pqt-forge-capturer-renderer-test.ts` mounts the real overlay and verifies canvas region export plus save-result/error ownership through isolated IPC. `pqt-forge-capturer-ipc-test.ts` covers cancellation during lazy loading/hide delay and native re-entry. Interactive selection/annotations and Save As user acceptance remain manual checks.

## Site Sucker

- Owner/lifetime: SiteSucker controller survives panel closure; main SiteSucker runtime owns page windows, HTTP streams and pending queues.
- Start: HTTP(S) URL + output folder are required. URL substring `pageLimit` retains legacy meaning. Separate maxPages/maxFiles/maxFileSize/maxTotalSize/maxDuration settings bound page/network/file work. Timeout is milliseconds. Request includes an operation ID; stale progress/terminal events are ignored.
- Intermediate: per-link wait/running/success/fail/skipped with reason, preserving completed output. Progress is never terminal.
- Terminal: completed/partial/cancelled/failed reported by native runtime after workers settle, carrying per-link results. Acknowledging start is not completion. Close of any worker requests cancellation of the whole run. Timeout of transport is unknown and blocks replay until native status/stop reconciles it.
- Duplicate behavior: controller and native runtime reject overlapping runs. Cancellation is idempotent; workers abort requests and destroy streams/windows, remove partial temporary files, and retain already completed files.
- Dependencies/failure policy: output-root setup and runtime initialization are required; each page/file is independent after setup. Invalid URLs and excluded/over-limit candidates are skipped individually. Auxiliary folder-open/persistence errors are warnings and do not invalidate native completed work. Status and cancellation errors retain unknown state.
- Tests: count caps vs URL filter, finite numeric bounds, streamed-byte caps without content-length, page/file failures continue siblings, stale events, duplicate calls, cancellation and timeout recovery, queue completion, cleanup and re-entry.
- Native integration: `scripts/pqt-forge-site-sucker-electron-test.ts` builds an Electron main-process fixture and uses only a local HTTP server. It verifies concurrent pages, CSS/assets, transient retries, cancellation, native window closure, page/image bounds, worker cleanup, and removal of partial files. Evidence is written to `.superpowers/site-sucker-electron/`.

The referenced docs/skills/qtenvdev-failure-boundaries/SKILL.md is missing in this checkout; AGENTS.md supplies the failure boundary policy applied here.
