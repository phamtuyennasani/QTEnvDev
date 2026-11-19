# PQT Forge image pipeline contract

The new image dialog exposes the legacy Basic, Compression, Effects, Watermark, Texture and preview components. Their configuration belongs to the existing module-local setup singleton. The selected tab is view state. No new Pinia state or shared configuration fields are introduced; no exception is authorized.

ImageBatch remains the renderer operation owner across dialog destruction and re-entry. It owns immutable request snapshots, metadata discovery, progress, duplicate guards, terminal results, persistence, notices and listener cleanup. The fork image module owns Sharp work and filesystem side effects. There is no image cancellation API, so the dialog reports that active writes cannot be cancelled and stays safe to close.

| Operation | Start and lifetime | Intermediate events | Terminal events | Duplicate behavior | Failure boundary |
| --- | --- | --- | --- | --- | --- |
| Discover images | explicit file/folder selection until IPC terminal | `allFile`, successful and failed metadata tasks | `code: 0` complete; `code: 1` failed; transport/observation timeout unknown | reject discovery/queue edits while discovery or compression is active | each unreadable image/path fails individually; valid siblings continue |
| Compress images | explicit run with validated configuration and frozen queue until IPC terminal | successful and failed task results | `code: 0` terminal with per-image outcomes; `code: 1` required failure; observation timeout unknown | block replay while active or unknown | invalid metadata candidates are skipped; valid independent images continue; partial completion remains visible |
| Persist settings | initialization and configuration change | none | saved or warning | serialized writes | supplementary; never overwrites successful file outcomes |
| Open output folder | explicit open action | none | opened or warning | independent | supplementary; never rejects completed compression |

An observation timeout is not proof that Sharp stopped. The operation remains guarded and its IPC listener remains registered for a late terminal result. On application shutdown the renderer releases resources; it never reports cancellation or success merely because the dialog unmounted.

The configured image timeout is forwarded to Sharp. Finite numeric and enumerated option validation runs before dispatch; a deep JSON snapshot contains only data. Save output requires a destination; overwrite requires a separate backup directory. Per-item success, failed metadata, failed output and unknown pending work are rendered separately.

Required verification covers configuration snapshot immutability, invalid options, duplicate invocation, queue guard, progress retention, partial failures, terminal listener cleanup, observation timeout/late completion, and page re-entry. The repository reference `docs/skills/qtenvdev-failure-boundaries/SKILL.md` is absent; implementation follows the failure-boundary rules in AGENTS.md directly.
