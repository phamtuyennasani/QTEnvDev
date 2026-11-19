# Built-in module visibility

The Settings view owns its display and toggles. Its module controller holds one change through confirmation, required service stop, and preference save. The existing visibility guard owns module-specific confirmation. Standard services use the established installed module lifecycle and DNS and built-in FTP use their workspace controllers. Those owners keep progress and terminal state across navigation. Duplicate changes are ignored until completion. A failed required stop leaves visibility unchanged. A preference write failure restores visibility without restarting an already stopped service. The setting uses the existing visibility map and creates no new store or configuration key.

Verify persisted visibility on entry, fallback when a selected module is hidden, restoration when shown, and rejection when the existing guard refuses a hide. Verify service stop failures leave the setting unchanged.
