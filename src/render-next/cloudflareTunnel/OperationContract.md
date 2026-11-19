# Cloudflare Tunnel in Services

The Services view owns the dialog selection. The established tunnel store owns the saved definitions and runs one initialization at a time. Each tunnel model owns its commands, request snapshots, progress, terminal reply, and duplicate guard across dialog closure. The fork owns process and PID state. The existing detached panels handle token, DNS and log views. Loading saved definitions is a required dependency for tunnel controls. A load failure shows a retry and does not clear existing definitions. No new persistence or lifecycle methods are needed.

Verify loading a saved tunnel through Services, starting it with a progress reply, reopening the dialog while it is active, and observing the resulting running state. The fixture does not contact Cloudflare.
