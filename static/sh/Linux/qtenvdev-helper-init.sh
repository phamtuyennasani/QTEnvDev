#!/bin/bash
# Runs only during explicitly authorized installation/maintenance.
set -euo pipefail
export PATH=/usr/sbin:/usr/bin:/sbin:/bin
[ "$(id -u)" = 0 ] || { echo 'Run this installer as root'; exit 1; }
BIN="$1"
ROLE="$2"
DATA_PATH="$3"
SERVICE_NAME=qtenvdev-helper
BIN_DEST=/usr/local/bin/qtenvdev-helper
SERVICE_PATH=/etc/systemd/system/qtenvdev-helper.service

check_directory() {
  local path="$1"
  [ -d "$path" ] && [ ! -L "$path" ] || { echo "Unsafe install directory: $path"; exit 1; }
}

ensure_helper_directory() {
  local path="$1"
  if [ -e "$path" ] || [ -L "$path" ]; then
    check_directory "$path"
  else
    install -d -o root -g root -m 0755 "$path"
  fi
}

stop_existing_helper() {
  local load_state state pid
  load_state=$(systemctl show "$SERVICE_NAME" --property=LoadState --value) || return 1
  if [ "$load_state" = not-found ]; then return 0; fi
  systemctl stop "$SERVICE_NAME" || return 1
  state=$(systemctl show "$SERVICE_NAME" --property=ActiveState --value) || return 1
  pid=$(systemctl show "$SERVICE_NAME" --property=MainPID --value) || return 1
  if { [ "$state" != inactive ] && [ "$state" != failed ]; } || [ "$pid" != 0 ]; then
    echo 'Existing QTEnvDev helper did not stop; installation aborted' >&2
    return 1
  fi
}
# Preserve administrator-configured system directories; only manage our own assets.
mkdir -p /usr/local/bin
ensure_helper_directory /etc/qtenvdev-helper
TEMP_BIN=$(mktemp /usr/local/bin/.qtenvdev-helper.XXXXXX)
trap 'rm -f "$TEMP_BIN"' EXIT
install -o root -g root -m 0755 "$BIN" "$TEMP_BIN"
stop_existing_helper
"$TEMP_BIN" --install-linux-policy "$ROLE" "$DATA_PATH"
mv -T "$TEMP_BIN" "$BIN_DEST"

TEMP_UNIT=$(mktemp /etc/systemd/system/.qtenvdev-helper.XXXXXX)
cat > "$TEMP_UNIT" <<'UNIT'
[Unit]
Description=QTEnvDev limited privileged helper
After=local-fs.target

[Service]
ExecStart=/usr/local/bin/qtenvdev-helper
Restart=on-failure
User=root
Group=root
UMask=0077
RuntimeDirectory=qtenvdev-helper
RuntimeDirectoryMode=0755
NoNewPrivileges=yes

[Install]
WantedBy=multi-user.target
UNIT
chmod 0644 "$TEMP_UNIT"
mv -T "$TEMP_UNIT" "$SERVICE_PATH"
systemctl daemon-reload
systemctl enable "$SERVICE_NAME"
systemctl start "$SERVICE_NAME"
echo 'Installed: fixed hosts editing, user service low-port binding, root Pure-Ftpd, PID directory repair.'
