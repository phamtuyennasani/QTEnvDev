#!/bin/zsh
# For Chinese users only. Do not edit.
set -e
srcFlag=$1
brewHome=$2
case "$srcFlag" in
"default")
echo "
    你选择了默认源
    "
    #HomeBrew基础框架
    USER_BREW_GIT=https://github.com/Homebrew/brew.git
    #HomeBrew Core
    USER_CORE_GIT=https://github.com/Homebrew/homebrew-core.git
    #HomeBrew Cask
    USER_CASK_GIT=https://github.com/Homebrew/homebrew-cask.git
;;
"tsinghua")
echo "
    你选择了清华大学国内源
    "
       USER_HOMEBREW_BOTTLE_DOMAIN=https://mirrors.tuna.tsinghua.edu.cn/homebrew-bottles/
       #HomeBrew基础框架
       USER_BREW_GIT=https://mirrors.tuna.tsinghua.edu.cn/git/homebrew/brew.git
       #HomeBrew Core
       USER_CORE_GIT=https://mirrors.tuna.tsinghua.edu.cn/git/homebrew/homebrew-core.git
       #HomeBrew Cask
       USER_CASK_GIT=https://mirrors.tuna.tsinghua.edu.cn/git/homebrew/homebrew-cask.git
       HOMEBREW_API_DOMAIN=https://mirrors.tuna.tsinghua.edu.cn/homebrew-bottles/api
       HOMEBREW_PIP_INDEX_URL=https://pypi.tuna.tsinghua.edu.cn/simple/
;;
"bfsu")
    echo "
    北京外国语大学brew本体下载源
    "
    USER_HOMEBREW_BOTTLE_DOMAIN=https://mirrors.bfsu.edu.cn/homebrew-bottles
    #HomeBrew基础框架
    USER_BREW_GIT=https://mirrors.bfsu.edu.cn/git/homebrew/brew.git
    #HomeBrew Core
    USER_CORE_GIT=https://mirrors.bfsu.edu.cn/git/homebrew/homebrew-core.git
    #HomeBrew Cask
    USER_CASK_GIT=https://mirrors.bfsu.edu.cn/git/homebrew/homebrew-cask.git
    HOMEBREW_API_DOMAIN=https://mirrors.bfsu.edu.cn/homebrew-bottles/api
    HOMEBREW_PIP_INDEX_URL=https://mirrors.bfsu.edu.cn/pypi/web/simple/
;;
"tencent")
    echo "
    你选择了腾讯brew本体下载源
    "
    USER_HOMEBREW_BOTTLE_DOMAIN=https://mirrors.cloud.tencent.com/homebrew-bottles
    #HomeBrew基础框架
    USER_BREW_GIT=https://mirrors.cloud.tencent.com/homebrew/brew.git
    #HomeBrew Core
    USER_CORE_GIT=https://mirrors.cloud.tencent.com/homebrew/homebrew-core.git
    #HomeBrew Cask
    USER_CASK_GIT=https://mirrors.cloud.tencent.com/homebrew/homebrew-cask.git
    HOMEBREW_API_DOMAIN=https://mirrors.cloud.tencent.com/homebrew-bottles/api
    HOMEBREW_PIP_INDEX_URL=https://mirrors.cloud.tencent.com/pypi/simple/
;;
"aliyun")
    echo "
    你选择了阿里巴巴brew本体下载源
    "
    USER_HOMEBREW_BOTTLE_DOMAIN=https://mirrors.aliyun.com/homebrew/homebrew-bottles
    #HomeBrew基础框架
    USER_BREW_GIT=https://mirrors.aliyun.com/homebrew/brew.git
    #HomeBrew Core
    USER_CORE_GIT=https://mirrors.aliyun.com/homebrew/homebrew-core.git
    #HomeBrew Cask
    USER_CASK_GIT=https://mirrors.aliyun.com/homebrew/homebrew-cask.git
    HOMEBREW_API_DOMAIN=https://mirrors.aliyun.com/homebrew/homebrew-bottles/api
    HOMEBREW_PIP_INDEX_URL=https://mirrors.aliyun.com/pypi/simple/
;;
"ustc")
  echo "
  你选择了中国科学技术大学brew本体下载源
  "
  #HomeBrew 下载源 install
  USER_HOMEBREW_BOTTLE_DOMAIN=https://mirrors.ustc.edu.cn/homebrew-bottles
  #HomeBrew基础框架
  USER_BREW_GIT=https://mirrors.ustc.edu.cn/brew.git
  #HomeBrew Core
  USER_CORE_GIT=https://mirrors.ustc.edu.cn/homebrew-core.git
  #HomeBrew Cask
  USER_CASK_GIT=https://mirrors.ustc.edu.cn/homebrew-cask.git
  HOMEBREW_API_DOMAIN=https://mirrors.ustc.edu.cn/homebrew-bottles/api
  HOMEBREW_PIP_INDEX_URL=https://mirrors.bfsu.edu.cn/pypi/web/simple/
;;
*)
  print -u2 'Unsupported Homebrew mirror.'
  exit 1
;;
esac

git --git-dir="$brewHome/.git" remote set-url origin "$USER_BREW_GIT"
core="$brewHome/Library/Taps/homebrew/homebrew-core"
cask="$brewHome/Library/Taps/homebrew/homebrew-cask"
failed=0
if [ -d "$core" ] && ! git --git-dir="$core/.git" remote set-url origin "$USER_CORE_GIT"; then
  printf '%s\n' 'Could not update the homebrew-core origin.' >&2
  failed=1
fi
if [ -d "$cask" ] && ! git --git-dir="$cask/.git" remote set-url origin "$USER_CASK_GIT"; then
  printf '%s\n' 'Could not update the homebrew-cask origin.' >&2
  failed=1
fi

update_profile() {
  local profile="$1" last_char
  if [ -f "$profile" ]; then
    sed -i "" -e '/^export HOMEBREW_BOTTLE_DOMAIN=/d' \
      -e '/^export HOMEBREW_API_DOMAIN=/d' \
      -e '/^export HOMEBREW_PIP_INDEX_URL=/d' "$profile" || return 1
  fi
  if [ "$srcFlag" != "default" ]; then
    if [ -s "$profile" ]; then
      last_char=$(tail -c 1 "$profile") || return 1
      if [ -n "$last_char" ]; then
        printf '\n' >> "$profile" || return 1
      fi
    fi
    printf '%s\n' "export HOMEBREW_BOTTLE_DOMAIN=$USER_HOMEBREW_BOTTLE_DOMAIN" \
      "export HOMEBREW_API_DOMAIN=$HOMEBREW_API_DOMAIN" \
      "export HOMEBREW_PIP_INDEX_URL=$HOMEBREW_PIP_INDEX_URL" >> "$profile" || return 1
  fi
}

for profile in "$HOME/.zshrc" "$HOME/.bash_profile"; do
  if ! update_profile "$profile"; then
    printf 'Could not update the shell profile %s.\n' "${profile##*/}" >&2
    failed=1
  fi
done

[ "$failed" -eq 0 ] || exit 1
printf '%s\n' 'QTENVDEV_BREW_MIRROR_APPLIED'
