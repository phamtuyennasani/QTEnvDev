# Complete tool surfaces in PQT Forge

The new toolbox embeds the established content components for tools whose complete inputs/actions are materially larger than the initial new panels. `LegacyToolPanel.vue` owns only selection of an explicit component, loading/error display, and the Forge dialog. It never reconstructs domain data or operation IPC.

| State / operation | Owner and lifetime | Request/progress/terminal/duplicates | Verification |
| --- | --- | --- | --- |
| Wrapper tool selection, process lookup tab, loading error | Mounted wrapper | Lazy component import; failure is visible with retry; selected surface unmounts on close | Source mapping enumeration and renderer build |
| JSON inputs/tabs/conversions | Established JSONStore + mounted editor instances | Existing format helpers; mounted editor owns callbacks and disposes Monaco instances | JSON parsing/sorting behavioral vectors; typecheck/build |
| JWT header/payload/secret/token/signature state | Established JWT reactive store | Synchronous crypto-js HMAC create/decode/verify; no IPC or background work | HS256/HS384/HS512 and none create/decode, bad secret, tampered token and malformed JSON tests |
| Regex inputs/match captures/sample/visualization | Established RegexTester store; mounted SVG view | Synchronous match helper; SVG removed on unmount | Captures, named ranges, flags and no-match vectors |
| Code library languages/groups/snippets | Established CodeLibrary singleton, app lifetime | Reuses existing `qtenvdev-code-library` localForage persistence and existing CRUD dialogs; no new config or store | Same data source is imported; meaningful group/snippet behavior reviewed in source |
| Port/process search and stop | Established `ProcessControl/Controller` and PortKill/ProcessKill adapters | Existing PID validation, duplicate guards and per-PID/unknown stop results remain authoritative | Existing process-controller test suite, renderer boundary checks |
| WebSocket/SSE connection, heartbeat and event logs | Established WebSocketSSE singleton store, app lifetime | Duplicate connect rejected; socket identity guards stale callbacks; disconnect clears socket handlers/heartbeat; scoped SSE keys reject stale messages and detach on terminal 0/500; SSE buffer capped at 1 MB, logs at 300 | `test:pqt-forge-realtime`: duplicate, disconnect/reconnect, stale WS/SSE callback isolation, JSON send, headers/params/protocols, chunked filtered events, bounds and terminal cleanup |
| Markdown/editor instances, QR rendering, FileInfo hash requests, key listener | Established components | Keeps existing open/save/render/event behavior and unmount cleanup; wrapper adds no replay | Typecheck/build; targeted model tests where pure helpers exist |

The compatibility helper supplies Element Plus UI components/directives, YbIcon, the existing translation function and Base helpers through a private descendant app context. It does not mutate the root plugin registry or create another Vue app, router, Pinia or shared configuration. Tailwind utilities are nested beneath `.pqt-established-tool`; a scoped compatibility stylesheet provides the dimensions required by the established editor and dialog content. The surrounding shell remains the Forge dialog.

Explicit map: JSON, JWT, CodeLibrary, RegexTester, DiffCompare, MarkdownPreview, QRCodeGenerator, WifiQRCodeGenerator, FileInfo, KeycodeInfo, CronParser, Timestamp, SystenEnv, SSLMake, BomClean, PhpObfuscator, CodePlayground, WebSocketSSE. A separate ProcessPanel embeds PortKill and ProcessKill as two tabs and uses the same private compatibility helper so their existing controller and validation contract is retained.

The wrapper is an intentional parity adapter. It avoids silently reducing a mature tool to a subset of its advertised capabilities. The specialized Capturer, Site Sucker, and image pipeline migrations remain separate.
