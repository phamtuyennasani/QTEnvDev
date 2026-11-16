import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve, sep } from 'node:path'
import {
  installGitBashIntegration,
  syncShellDirectories
} from '../src/fork/module/Tool.win/GitBashIntegration'

const root = await mkdtemp(join(tmpdir(), "QTEnvDev Git Bash [路径] ' $ "))
const scriptContent = await readFile(
  new URL('../static/sh/Windows/qt-env-dev.sh', import.meta.url),
  'utf8'
)
const shellQuote = (text: string) => `'${text.replaceAll("'", "'\\''")}'`
try {
  const home = join(root, 'home')
  const bin = join(root, 'bin')
  const scriptPath = join(bin, 'qt-env-dev.sh')
  await mkdir(home)
  assert.equal(await installGitBashIntegration(home, scriptPath, scriptContent), 'updated')
  const bashrc = await readFile(join(home, '.bashrc'), 'utf8')
  assert.match(bashrc, /QTEnvDev Git Bash integration/)
  assert.match(await readFile(join(home, '.bash_profile'), 'utf8'), /QTEnvDev Git Bash integration/)
  assert.equal(await installGitBashIntegration(home, scriptPath, scriptContent), 'unchanged')
  assert.equal(await readFile(join(home, '.bashrc'), 'utf8'), bashrc)
  assert.equal(await installGitBashIntegration(home, scriptPath, scriptContent + '\n'), 'updated')

  const profileHome = join(root, 'profile-home')
  await mkdir(profileHome)
  const customProfile = 'export QTENVDEV_LOGIN_SENTINEL=preserved\n'
  await writeFile(join(profileHome, '.profile'), customProfile)
  await installGitBashIntegration(profileHome, scriptPath, scriptContent)
  assert.ok((await readFile(join(profileHome, '.profile'), 'utf8')).startsWith(customProfile))
  assert.equal(existsSync(join(profileHome, '.bash_profile')), false)

  const brokenHome = join(root, 'broken-home')
  await mkdir(brokenHome)
  await writeFile(join(brokenHome, '.bashrc'), '# preserve my configuration\n')
  const brokenProfile =
    '# <<< QTEnvDev Git Bash integration <<<\n# >>> QTEnvDev Git Bash integration >>>\n'
  await writeFile(join(brokenHome, '.bash_profile'), brokenProfile)
  await assert.rejects(installGitBashIntegration(brokenHome, scriptPath, scriptContent), /invalid/)
  assert.equal(await readFile(join(brokenHome, '.bashrc'), 'utf8'), '# preserve my configuration\n')
  assert.equal(await readFile(join(brokenHome, '.bash_profile'), 'utf8'), brokenProfile)

  const failedSync = join(root, 'failed-sync')
  await mkdir(join(failedSync, '.qtenvdev-bash.dir'), { recursive: true })
  const partial = await syncShellDirectories(failedSync, ['C:/Projects/Allowed'])
  assert.equal(partial.status, 'degraded')
  assert.match(partial.warnings[0], /Git Bash directory sync failed/)
  assert.deepEqual(JSON.parse(await readFile(join(failedSync, '.qtenvdev.dir'), 'utf8')), [
    'C:/Projects/Allowed'
  ])
  const requiredFailure = join(root, 'required-failure')
  await mkdir(join(requiredFailure, '.qtenvdev.dir'), { recursive: true })
  await assert.rejects(syncShellDirectories(requiredFailure, ['C:/Projects/Allowed']))
  assert.equal(existsSync(join(requiredFailure, '.qtenvdev-bash.dir')), false)
  const candidateSync = await syncShellDirectories(bin, ['C:/Valid', 'C:/Invalid\nC:/NotAllowed'])
  assert.equal(candidateSync.status, 'degraded')
  assert.deepEqual(JSON.parse(await readFile(join(bin, '.qtenvdev.dir'), 'utf8')), ['C:/Valid'])
  assert.equal(await readFile(join(bin, '.qtenvdev-bash.dir'), 'utf8'), 'C:/Valid\n')

  let bash = process.env.GIT_BASH_TEST_BIN
  if (!bash && process.platform === 'win32') {
    const candidates = execFileSync('where.exe', ['git'], { encoding: 'utf8', windowsHide: true })
      .trim()
      .split(/\r?\n/)
      .map((git) => resolve(dirname(git), '../bin/bash.exe'))
    bash = candidates.find(existsSync)
  }
  if (bash) {
    const bashRun = (
      args: string[],
      options: { cwd?: string; input?: string; home?: string } = {}
    ) =>
      execFileSync(bash!, args, {
        cwd: options.cwd ?? root,
        input: options.input,
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'pipe'],
        timeout: 20000,
        windowsHide: true,
        env: {
          ...process.env,
          HOME: options.home ?? home,
          CHERE_INVOKING: '1',
          HISTFILE: '/dev/null'
        }
      })
    const unixPath = (path: string) =>
      bashRun(['--noprofile', '--norc', '-c', 'cygpath -u "$1"', 'bash', path]).trim()
    const projectA = join(root, 'ProjectA')
    const projectB = join(root, 'ProjectB')
    const outside = join(root, 'Outside')
    const runtimeA = join(root, 'RuntimeA')
    const runtimeB = join(root, 'RuntimeB')
    const runtimeLiteral = join(root, 'Runtime $(touch INJECTION) `literal`')
    await Promise.all(
      [
        projectA,
        projectB,
        outside,
        runtimeA,
        join(runtimeA, 'bin'),
        join(runtimeA, 'sbin'),
        runtimeB,
        runtimeLiteral
      ].map((path) => mkdir(path, { recursive: true }))
    )
    for (const path of [runtimeA, join(runtimeA, 'bin'), join(runtimeA, 'sbin'), runtimeB]) {
      await writeFile(join(path, 'qtenvdev-test-runtime'), '#!/usr/bin/env bash\nexit 0\n', {
        mode: 0o755
      })
    }
    const envLine = (paths: string[]) =>
      `$env:PATH = '${(paths.join(';') + ';').replaceAll("'", "''")}' + $env:PATH #QTEnvDev-ID-test`
    await writeFile(
      join(projectA, '.qtenvdev'),
      envLine([runtimeA, join(runtimeA, 'bin'), join(runtimeA, 'sbin')])
    )
    await writeFile(join(projectB, '.qtenvdev'), envLine([runtimeB]))
    await syncShellDirectories(bin, [join(root, 'Missing'), projectA, projectB])
    const a = unixPath(projectA)
    const b = unixPath(projectB)
    const other = unixPath(outside)
    const expectedA = unixPath(runtimeA) + '/qtenvdev-test-runtime'
    const expectedB = unixPath(runtimeB) + '/qtenvdev-test-runtime'
    const testScript = join(root, 'runtime-test.sh')
    await writeFile(
      testScript,
      `
fail() { printf 'FAIL: %s\\n' "$1" >&2; exit 1; }
cd() { builtin cd "$@"; }
original_cd=$(declare -f cd)
PROMPT_COMMAND=': keep-existing-handler'
source ${shellQuote(unixPath(join(home, '.bashrc')))}
[[ "$(declare -f cd)" == "$original_cd" ]] || fail 'cd function overwritten'
[[ "\${PROMPT_COMMAND[0]}" == ': keep-existing-handler' ]] || fail 'prompt handler lost'
[[ \${#PROMPT_COMMAND[@]} == 2 ]] || fail 'missing prompt hook'
baseline="$PATH:${unixPath(join(runtimeA, 'sbin'))}:"
PATH="$baseline"
cd ${shellQuote(a)}; qtenvdev_autoload
[[ "$(command -v qtenvdev-test-runtime)" == ${shellQuote(expectedA)} ]] || fail 'reversed PATH priority'
loaded_path="$PATH"
qtenvdev_autoload; cd .; qtenvdev_autoload
[[ "$PATH" == "$loaded_path" ]] || fail 'repeated PATH growth'
source ${shellQuote(unixPath(join(home, '.bashrc')))}
[[ \${#PROMPT_COMMAND[@]} == 2 && "$PATH" == "$loaded_path" ]] || fail 'duplicate source changed state'
cd ${shellQuote(b)}; qtenvdev_autoload
[[ "$(command -v qtenvdev-test-runtime)" == ${shellQuote(expectedB)} ]] || fail 'project B not active'
[[ "$PATH" == ${shellQuote(unixPath(runtimeB))}:"$baseline" ]] || fail 'old injected paths remain or original PATH changed'
cd ${shellQuote(a.replace('ProjectA', 'projecta'))}; qtenvdev_autoload
[[ "$(command -v qtenvdev-test-runtime)" == ${shellQuote(expectedA)} ]] || fail 'case variant did not load A'
PATH="/external-tool:$PATH"
cd ${shellQuote(other)}; qtenvdev_autoload
[[ "$PATH" == "/external-tool:$baseline" ]] || fail 'external PATH edit or trailing entry lost'
PATH="$baseline"
cd ${shellQuote(a)}; qtenvdev_autoload
printf '' > ${shellQuote(unixPath(join(bin, '.qtenvdev-bash.dir')))}
qtenvdev_autoload
[[ "$PATH" == "$baseline" ]] || fail 'revoked directory still active'
printf '%s\\n' ${shellQuote(projectA)} > ${shellQuote(unixPath(join(bin, '.qtenvdev-bash.dir')))}
printf '%s\\n' ${shellQuote(envLine([join(root, 'MissingRuntime'), runtimeLiteral]))} > .qtenvdev
qtenvdev_autoload
[[ "$PATH" == ${shellQuote(unixPath(runtimeLiteral))}:* ]] || fail 'valid sibling skipped after missing runtime'
[[ ! -e INJECTION ]] || fail 'project file executed shell code'
printf '%s\\n' ${shellQuote(`$env:PATH = "${runtimeB};" + $env:PATH #QTEnvDev-ID-legacy`)} > .qtenvdev
qtenvdev_autoload
[[ "$(command -v qtenvdev-test-runtime)" == ${shellQuote(expectedB)} ]] || fail 'legacy double-quoted paths not loaded'
printf '%s\\n' ${shellQuote(envLine([runtimeA]))} ${shellQuote(envLine([runtimeB]))} > .qtenvdev
qtenvdev_autoload
[[ "$(command -v qtenvdev-test-runtime)" == ${shellQuote(expectedB)} ]] || fail 'assignment order differs from PowerShell'
printf '%s\\n' ${shellQuote(envLine([runtimeA]))} > .qtenvdev
qtenvdev_autoload
[[ "$(command -v qtenvdev-test-runtime)" == ${shellQuote(expectedA)} ]] || fail 'changed project file not reloaded'
false
qtenvdev_autoload
[[ $? == 1 ]] || fail 'prompt handler overwrote exit status'
cd ${shellQuote(other)}; qtenvdev_autoload
[[ "$PATH" == "$baseline" ]] || fail 'leaving project did not restore PATH'
printf 'Git Bash runtime checks passed\\n'
`
    )
    assert.match(
      bashRun(['--noprofile', '--norc', unixPath(testScript)], { cwd: outside }),
      /runtime checks passed/
    )

    await syncShellDirectories(bin, [projectA, projectB])
    for (const loginHome of [home, profileHome]) {
      const output = bashRun(
        [
          '--login',
          '-c',
          'type qtenvdev_autoload >/dev/null && printf "HOOK_READY=%s\\n" "$QTENVDEV_LOGIN_SENTINEL"'
        ],
        { home: loginHome }
      )
      assert.match(output, /HOOK_READY=/)
      if (loginHome === profileHome) assert.match(output, /HOOK_READY=preserved/)
    }
    const interactive = bashRun(
      ['--noprofile', '--rcfile', unixPath(join(home, '.bashrc')), '-i'],
      {
        cwd: outside,
        input: `cd ${shellQuote(a)}\nprintf 'ACTIVE=%s\\n' "$(command -v qtenvdev-test-runtime)"\ncd ${shellQuote(other)}\ncommand -v qtenvdev-test-runtime || printf 'RESTORED\\n'\nexit\n`
      }
    )
    assert.ok(interactive.includes(`ACTIVE=${expectedA}`))
    assert.match(interactive, /RESTORED/)
    console.log(
      'Real Git Bash: PATH order, cleanup, case, source idempotence, safe parsing, login and interactive hooks passed'
    )
  } else {
    console.log('Native Git Bash checks skipped: set GIT_BASH_TEST_BIN to run them')
  }
} finally {
  assert.ok(resolve(root).startsWith(resolve(tmpdir()) + sep) && root.includes('QTEnvDev Git Bash ['))
  await rm(root, { recursive: true, force: true })
}
console.log(
  'Git Bash profile creation, preservation, repeat initialization and failure boundaries passed'
)
