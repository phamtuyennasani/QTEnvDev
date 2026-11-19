# PostgreSQL data directory

The database view mounts the same directory control as the legacy PostgreSQL page. The module controller owns preference loading, the folder picker, write admission, and terminal results across navigation. Closing or canceling the native picker settles the operation without writing. The selected binary is captured before opening the picker. A running or changing PostgreSQL service prevents a directory change.

The existing PostgreSQL storage record owns the per-binary directory. Settings commit only after persistence succeeds. PostgreSQL lifecycle resolution waits for a pending write to settle, and continues with the previously saved value if that write failed. The write does not move or delete database files.

Verify cancellation, blocked changes while the service runs, and persistence failure and retry.
