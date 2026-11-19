# Toolbox operation adapters

Operation lifetimes belong to the module-local controller; mounted panels own inputs, confirmation dialogs and selections. No new Pinia store or shared setup persistence is added.

| Tool | Owner / request | Progress and terminal | Duplicate / lifetime policy | Verification |
| --- | --- | --- | --- | --- |
| Process control | established ProcessToolController singletons for port/process queries | query responses; kill response; independent refresh | query revisions coalesce; stop snapshot and confirmation; state survives panel re-entry | existing process tests and boundary checks |
| Code playground | module-local execution controller | progress code 200; terminal code 0/1 | selected installed runtime captured; duplicate run blocked; listener cleanup | runtime signature and lifecycle |
| BOM cleaner | module-local controller | scan list; per-task progress; terminal code 0/1 | frozen extension/exclude snapshot; survives close | progress, partial outcomes, duplicate guard |
| SSL maker | module-local controller | terminal code 0/1 | validated domain/root/output snapshot; folder-open failure supplementary | preconditions and result preservation |
| Environment files | module-local controller | list/read/save terminal | file/content snapshot; stale reads ignored; system read-only policy | read revision, save guard, failure |
| PHP obfuscator | module-local controller | terminal code 0/1 with logs | installed PHP and non-nested source/output snapshot | path/runtime validation, terminal cleanup |
| Request timing | request-timing singleton | progress 100/200; terminal 0/1; 60s observation bound | HTTP(S) snapshot, duplicate/unknown replay guard; prior metrics retained | URL validation, late terminal, re-entry |
| RSA generation | RSA singleton | promise resolution/rejection; 120s observation bound | finite allowed bit size, frozen request, prior keys retained; late promise settles unknown | duplicate, timeout, result retention |
| MySQL code connection | MySQL-code singleton | progress 100/200; terminal 0/1; 60s observation bound | frozen validated host/port/user credentials; sensitive IPC; prior database list retained | validation, duplicate, unknown and cleanup |

Completed writes and stops remain completed when folder opening or refresh fails. Observation timeout is unknown, retains the original listener and blocks replay; it never implies cancellation.
