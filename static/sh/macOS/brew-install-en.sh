#!/bin/zsh
# String coloring program
if [[ -t 1 ]]; then
  tty_escape() { printf "\033[%sm" "$1"; }
else
  tty_escape() { :; }
fi
tty_universal() { tty_escape "0;$1"; } # Normal display
tty_green="$(tty_universal 32)" # Green
tty_reset="$(tty_escape 0)" # Remove color
if command -v brew >/dev/null 2>&1; then
    echo -n "${tty_green}
    Detects that brew is installed, and the installer script exits automatically.${tty_reset}"
    echo "QTEnvDev-End of Homebrew installation"
    exit 0
fi

echo "
              ${tty_green} Starting the Homebrew installer ${tty_reset}
"
echo -n "${tty_green}
->Whether to start executing the script now（Y/N） "
read MY_Del_Old
echo "${tty_reset}"
case $MY_Del_Old in
"y")
echo "--> Script execution begins"
;;
"Y")
echo "--> Script execution begins"
;;
*)
echo "You typed $MY_Del_Old and the installation exited. if you continue to run the script you should type Y or y"
echo "QTEnvDev-End of Homebrew installation"
exit 125
;;
esac

installer=$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh) || exit $?
/bin/bash -c "$installer"
result=$?
echo "QTEnvDev-End of Homebrew installation"
[[ "$result" == 125 ]] && exit 1
exit "$result"
