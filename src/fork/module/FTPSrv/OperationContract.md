# FTP accounts workspace

The renderer controller owns account and service requests through a terminal reply and keeps their results across page changes. It snapshots each request, ignores duplicate writes and reports refresh errors separately from committed changes. The page owns account drafts and confirmation dialogs. Account credentials travel through sensitive IPC.

The existing FTP account files remain the source of saved accounts. The built-in fork owns its listener and reports its status. Pure-FTPd reuses its installed version lifecycle. Failure to refresh the Pure-FTPd user database after saving returns a warning with the committed account state. A timeout leaves the result unknown and requires a refresh before further mutations. Tests cover duplicate account writes, committed results with refresh failures and built-in service controls.
