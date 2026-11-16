autoload -Uz colors && colors

_qtenvdev_allowed_paths=()
_qtenvdev_config_hash=""

_qtenvdev_msg() {
  [[ -z "$1" ]] && return
  local color="$1"
  shift

  if (( $# == 0 )); then
    print -P "%F{$color}[QTEnvDev]%f"
  else
    print -P "%F{$color}[QTEnvDev] ${*:1}%f"
  fi
}

_qtenvdev_hash() {
  local hash
  if hash=$(shasum -a 256 "$1" 2>/dev/null); then
    echo ${hash%% *}
  else
    echo "invalid"
    return 1
  fi
}

_qtenvdev_reload() {
  local config_file
  local -a valid_paths
  local new_hash dir_path clean_dir

    if [[ -f "$HOME/Library/QTEnvDev/bin/.qtenvdev.dir" ]]; then
      config_file="$HOME/Library/QTEnvDev/bin/.qtenvdev.dir"
    elif [[ -f "$HOME/Library/PhpWebStudy/bin/.qtenvdev.dir" ]]; then
      config_file="$HOME/Library/PhpWebStudy/bin/.qtenvdev.dir"
    else
      return 1
    fi

  new_hash=$(_qtenvdev_hash "$config_file") || return

  [[ "$new_hash" == "$_qtenvdev_config_hash" ]] && return

  _qtenvdev_allowed_paths=()
  _qtenvdev_config_hash="$new_hash"

  if [[ -f "$config_file" ]]; then
    while IFS= read -r dir_path || [[ -n "$dir_path" ]]; do
      dir_path="${dir_path//$'\r'/}"
      if [[ "$dir_path" =~ ^/ ]]; then
        clean_dir="${dir_path:A}"
        clean_dir="${clean_dir%%/}"
        valid_paths+=("$clean_dir")
      fi
    done < "$config_file"
  else
    return 1
  fi

  _qtenvdev_allowed_paths=("${valid_paths[@]}")
}

qtenvdev_autoload() {
  _qtenvdev_reload || return
  local current_path="${PWD}" found=0
  for allow_path in "${_qtenvdev_allowed_paths[@]}"; do
    [[ "$allow_path" == "$current_path" ]] && { found=1; break; }
  done
  (( found )) || return

  if [[ -f ".qtenvdev" ]]; then
    _qtenvdev_msg cyan "Loading environment variables..."
    source ".qtenvdev" && _qtenvdev_msg green "✓ Load successful" || _qtenvdev_msg red "✗ Load failed"
  fi
}

autoload -Uz add-zsh-hook
add-zsh-hook chpwd qtenvdev_autoload

qtenvdev_autoload
