import { quotePosixShell } from './Gvm'

export function sdkmanBash(
  script: string,
  platform: { isMacOS?: boolean; BrewBin?: string },
  installBash = false
) {
  const body = quotePosixShell(script)
  if (!platform.isMacOS) return 'exec /bin/bash -c ' + body

  const brew = quotePosixShell(platform.BrewBin || 'brew')
  const setup = [
    `if bash -c '(( BASH_VERSINFO[0] >= 4 ))'; then exec bash -c ${body}; fi`,
    `prefix="$(${brew} --prefix bash)" || exit $?`,
    'sdkman_bash="$prefix/bin/bash"',
    ...(installBash ? [`[ -x "$sdkman_bash" ] || ${brew} install bash || exit $?`] : []),
    `exec "$sdkman_bash" -c ${body}`
  ]
  return 'exec /bin/bash -c ' + quotePosixShell(setup.join('\n'))
}
