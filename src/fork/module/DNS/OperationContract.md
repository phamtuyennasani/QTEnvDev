# DNS server workspace

The dedicated DNS fork owns the UDP listener and its actual bound address. Start and stop return only after the listener opens or closes. Fork commands serialize until terminal and repeated starts or stops are safe. Its dedicated worker remains registered through the existing service lifecycle, including application shutdown. This built-in service has no installed executable or selectable version for `ModuleInstalledItem` to manage.

The module-local renderer controller holds each lifecycle and config operation through terminal, owns the query event listener and website-name subscription, and retains the latest 1,000 query responses across page changes. The screen owns form drafts, dialogs and display choices. Existing DNS JSON files remain the source of saved settings and defaults. Writes use the loaded content to detect a stale draft. Saving affects the next start, so a restart is a separate command and a restart error cannot negate the saved configuration.

Refresh reads fork status and configuration. A duplicate operation is ignored until terminal. Transport failure leaves the displayed state unknown until refreshed. The status probe waits for earlier fork commands to settle. Tests cover duplicate starts, confirmed stop, failed bind and retry, editable config, website alias synchronization and log retention.
