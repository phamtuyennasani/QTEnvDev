# SDKMAN installation

The existing SDKMAN packages controller owns the installer, terminal output, and discovery across Package Library navigation. The user starts it from a supported SDKMAN panel. The controller snapshots the platform and command, shares duplicate starts, and excludes concurrent package mutations through the existing busy state. The application PTY owns the process and reports output until exit. The controller releases the listener after a confirmed exit. If it cannot confirm exit or stop the terminal, the outcome stays unknown and prevents another installation.

After a successful installer exit, main checks the same SDKMAN home used at application startup. Discovery and catalog refresh are supplementary. They preserve the completed install and allow a discovery or catalog retry without installing again. Bash 4 or newer is required. On macOS the installer uses Homebrew Bash when a suitable Bash is absent from PATH. The fork uses the same Bash selection for catalog reads. No new settings, service lifecycle, or persistence are involved. Copying a row command writes only to the clipboard.

Test unsupported platforms and duplicate starts, navigation while the installer runs, confirmed exit and discoverability, failed discovery followed by a discovery-only retry, and distinct copy commands for each candidate and installed state.
