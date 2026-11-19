# Installed service versions

The dialog owns its open state. ServiceManager binds the established module's installed versions and persisted current version. ModuleInstalledItem owns start, stop, and restart through the terminal reply, including progress and the existing duplicate guard. Starting a different version for an exclusive service uses the module's existing version switch and the same companion service hooks. The fork owns the running processes and ports.

The module owns discovery and ServiceActionStore owns PATH, aliases, and managed version deletion. These paths retain their existing stores and persisted settings. The dialog adds no operation state, IPC, or persistence. Test opening the dialog for a discovered service, starting a second version, closing and reopening during progress, and observing the current version after completion.
