# Toolbox library operation contract

Legacy custom tools store a label and URL in app.tools.json and render that URL in an Electron webview. Built-in aliases created by an early new-renderer implementation remain readable.

- Owner: module-local ToolLibraryController singleton, exposed with reactiveBind. Form inputs, search, categories and edit selection stay in ToolsScreen.
- Lifetime: library data lasts for the renderer session; an opened custom webview lasts until its panel is closed or unmounted.
- Persistence: StorageGetAsync/StorageSetAsync own the new library key. app.tools.json is a read-only migration source, consulted only when the new key is absent. No Pinia or config.setup additions; no exception authorization is required.
- Start: initialize, add/edit/delete a URL tool, toggle a built-in/custom favorite, or open a URL tool.
- Intermediate events: storage saving count; webview start loading; webview navigation.
- Terminal events: committed storage snapshot or visible storage error; webview finish load or visible load failure. Close/unmount stops loading and removes listeners.
- Duplicate behavior: initialization shares one promise; writes are serialized and each computes from the last committed snapshot. Opening another tool closes the previous view.
- Failure boundaries: loading/migration is required before writes; failed storage writes do not publish uncommitted mutations. Invalid migration items are skipped individually with a warning. A failed external-browser open does not erase a loaded in-app page.
- Service interaction: none. Electron owns the webview process. The controller owns listeners and panel status.
- Verification: behavior tests cover read-only migration, ID mapping, URL CRUD, custom favorites, saved alias compatibility, malformed candidates, failed writes, write ordering, initialization deduplication, webview progress/failure and cleanup.
