# MySQL service and instance group controls

The Services controller holds the request, notices, duplicate guard, and final result across navigation. It delegates the primary instance to ModuleInstalledItem and the secondary instances to MysqlStore. The individual owners process progress and terminal replies and release their listeners. The fork owns PIDs and process state.

A failed primary start or restart leaves the group start untouched. Once the primary action succeeds, a group failure is reported separately and preserves the primary outcome. Stopping the primary and stopping the groups are independent. Both are attempted and reported, including when stopping a hidden module. An unavailable group catalog affects only the companion outcome.

Verify blocked companion starts, partial group failures, independent stop attempts, and the original primary result.
