/* eslint-disable @typescript-eslint/no-require-imports -- Electron launches this isolated renderer audit as CommonJS. */
// Exercise production launchers and Element Plus focus handling with native input.
// The preview replaces filesystem, process, helper and IPC effects before imports.
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { app, BrowserWindow } = require('electron')

const out = path.resolve('tmp/hallmark/audit', process.env.HALLMARK_RUN || 'pilot-interactions')
fs.mkdirSync(out, { recursive: true })
app.setPath('userData', fs.mkdtempSync(path.join(os.tmpdir(), 'qtenvdev-interaction-')))
app.commandLine.appendSwitch('force-device-scale-factor', '1')
app.commandLine.appendSwitch('disable-backgrounding-occluded-windows')
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
const overlay = '.app-workbench-dialog, .app-workbench-drawer'

app.whenReady().then(async () => {
  const report = {
    platform: 'macos-renderer-fixture',
    scope: 'Production launchers and AsyncComponentShow; native effects stubbed',
    errorCoverage:
      'Root Vue/window errors plus Electron renderer console errors, including separately mounted overlays',
    cases: [],
    errors: []
  }
  const win = new BrowserWindow({
    show: false,
    frame: false,
    width: 1200,
    height: 800,
    webPreferences: { offscreen: true, backgroundThrottling: false }
  })
  let consoleErrors = []
  win.webContents.on('console-message', (details) => {
    if (details.level === 'error') {
      consoleErrors.push({
        message: details.message,
        source: details.sourceId,
        line: details.lineNumber
      })
    }
  })
  const js = (source) => win.webContents.executeJavaScript(source, true)
  const waitFor = async (source, timeout = 15000) => {
    const deadline = Date.now() + timeout
    while (!(await js(source))) {
      if (Date.now() > deadline) throw new Error('Timed out: ' + source)
      await sleep(40)
    }
  }
  const key = async (keyCode) => {
    win.webContents.sendInputEvent({ type: 'keyDown', keyCode })
    if (keyCode === 'Enter') {
      win.webContents.sendInputEvent({ type: 'char', keyCode: '\r' })
    }
    win.webContents.sendInputEvent({ type: 'keyUp', keyCode })
    await sleep(40)
  }
  const activate = async (selector, name, pointer = false, inOverlay = false) => {
    const target = await js(`(() => {
      const visible=e=>!!e.getClientRects().length&&getComputedStyle(e).visibility!=='hidden';
      const root=${inOverlay ? `[...document.querySelectorAll(${JSON.stringify(overlay)})].filter(visible).at(-1)` : 'document'};
      const e=[...root.querySelectorAll(${JSON.stringify(selector)})].find(e=>visible(e)&&(${JSON.stringify(name)}===null||e.textContent.trim()===${JSON.stringify(name)}));
      if(!e)throw new Error('Launcher not found: '+${JSON.stringify(selector + ' ' + name)});
      e.scrollIntoView({block:'nearest'});e.focus();
      window.pilotLauncher=e;
      const r=e.getBoundingClientRect();return {x:Math.round(r.x+r.width/2),y:Math.round(r.y+r.height/2),focused:document.activeElement===e,tag:e.tagName};
    })()`)
    assert.ok(target.focused, 'Launcher must be keyboard focusable: ' + selector)
    if (pointer) {
      assert.ok(
        await js(
          `window.pilotLauncher.contains(document.elementFromPoint(${target.x},${target.y}))`
        ),
        'Pointer launcher must be unobstructed'
      )
      for (const type of ['mouseMove', 'mouseDown', 'mouseUp']) {
        win.webContents.sendInputEvent({
          type,
          x: target.x,
          y: target.y,
          ...(type === 'mouseMove' ? {} : { button: 'left', clickCount: 1 })
        })
      }
    } else await key('Enter')
  }
  const cases = [
    { name: 'hosts-add', route: '/hosts', selector: '.top-tab button.el-button--primary' },
    {
      name: 'hosts-edit-menu',
      route: '/hosts',
      scenario: 'hosts-populated',
      menu: '.host-list button[aria-label="Action: qtenvdev.test"]',
      selector: '.app-host-actions button',
      text: 'Edit'
    },
    {
      name: 'podman-machine-add',
      route: '/podman',
      scenario: 'podman-empty',
      selector: '.app-container-aside .el-card__header button[aria-label="Add"]'
    },
    {
      name: 'podman-container-add',
      route: '/podman',
      scenario: 'podman-containers',
      selector: '.app-container-detail .el-card__body button.el-button--primary'
    },
    {
      name: 'php-config-nested',
      route: '/php',
      parent: 'php-extensions',
      selector: '.app-workbench-drawer button[aria-label="php.ini"]'
    }
  ]
  const sizes = (process.env.HALLMARK_SIZES || '1200x800,800x600').split(',').map((size) => {
    const match = /^(\d+)x(\d+)$/.exec(size)
    assert.ok(match, 'Invalid viewport: ' + size)
    const width = Number(match[1])
    const height = Number(match[2])
    assert.ok(width > 0 && height > 0, 'Viewport dimensions must be positive: ' + size)
    return { width, height }
  })
  const themes = (process.env.HALLMARK_THEMES || 'dark,light').split(',')
  assert.ok(
    themes.every((theme) => ['dark', 'light'].includes(theme)),
    'Invalid theme'
  )
  const selectedCases = process.env.HALLMARK_CASES?.split(',')
  if (selectedCases) {
    assert.ok(
      selectedCases.every((name) => cases.some((item) => item.name === name)),
      'Unknown interaction case'
    )
  }
  try {
    for (const { width, height } of sizes) {
      win.setContentSize(width, height)
      for (const theme of themes) {
        for (const item of cases) {
          if (selectedCases && !selectedCases.includes(item.name)) continue
          for (const close of ['escape', 'button']) {
            const result = { name: item.name, width, height, theme, close, pass: false }
            consoleErrors = []
            try {
              await win.loadURL('http://127.0.0.1:5201/hallmark-preview?platform=macos')
              await waitFor('!!window.hallmark', 90000)
              if (!win.webContents.debugger.isAttached()) {
                win.webContents.debugger.attach('1.3')
              }
              await win.webContents.debugger.sendCommand('Emulation.setFocusEmulationEnabled', {
                enabled: true
              })
              win.webContents.focus()
              await js(`window.hallmark.setTheme(${JSON.stringify(theme)})`)
              await js(`window.hallmark.navigate(${JSON.stringify(item.route)})`)
              await js(`window.hallmark.store.asideExpanded=${width >= 960}`)
              if (item.scenario) {
                await js(`window.hallmark.scenario(${JSON.stringify(item.scenario)})`)
              }
              if (item.parent) {
                await js(`window.hallmark.openOverlay(${JSON.stringify(item.parent)})`)
                await sleep(450)
              }
              await waitFor(
                `!!document.querySelector(${JSON.stringify(item.menu || item.selector)})`
              )
              await sleep(250)
              if (item.menu) {
                await activate(item.menu, null)
                await js('window.pilotMenuLauncher=window.pilotLauncher')
                await waitFor(
                  `!![...document.querySelectorAll(${JSON.stringify(item.selector)})].find(e=>e.getClientRects().length&&getComputedStyle(e).visibility!=='hidden')`
                )
                await sleep(200)
              }
              if (item.parent) {
                result.parentSearch = await js(`(() => {
                  const input=document.querySelector('.php-extensions .el-table__header .el-input');
                  if(!input)throw new Error('PHP Extensions search input not found');
                  const wrapper=input.querySelector('.el-input__wrapper');
                  const cell=input.closest('th .cell');
                  const rect=e=>{const r=e.getBoundingClientRect();return {top:r.top,bottom:r.bottom,left:r.left,right:r.right,height:r.height}};
                  const inputRect=rect(input),wrapperRect=rect(wrapper),cellRect=rect(cell);
                  return {input:inputRect,wrapper:wrapperRect,cell:cellRect,
                    wrapperContained:wrapperRect.top>=cellRect.top-1&&wrapperRect.bottom<=cellRect.bottom+1,
                    inputContainsWrapper:wrapperRect.top>=inputRect.top-1&&wrapperRect.bottom<=inputRect.bottom+1};
                })()`)
                assert.ok(
                  result.parentSearch.wrapperContained && result.parentSearch.inputContainsWrapper,
                  'PHP Extensions search must fit its header cell: ' +
                    JSON.stringify(result.parentSearch)
                )
              }
              await js(`(() => {
                window.pilotInputEvents=[];
                for(const type of ['keydown','click'])document.addEventListener(type,e=>{
                  window.pilotInputEvents.push({type,key:e.key,code:e.code,defaultPrevented:e.defaultPrevented,target:e.target.getAttribute?.('aria-label')||e.target.tagName});
                });
              })()`)
              await activate(item.selector, item.text || null, close === 'button')
              await js('window.pilotExpectedLauncher=window.pilotLauncher')
              const count = item.parent ? 2 : 1
              await waitFor(
                `([...document.querySelectorAll(${JSON.stringify(overlay)})].filter(e=>e.getClientRects().length&&getComputedStyle(e).visibility!=='hidden')).length===${count}`
              )
              await sleep(450)
              result.opened = await js(`(() => {
                const e=[...document.querySelectorAll(${JSON.stringify(overlay)})].filter(e=>e.getClientRects().length&&getComputedStyle(e).visibility!=='hidden').at(-1);
                return {focusedInside:e.contains(document.activeElement),title:e.innerText.slice(0,100),errors:[...window.hallmark.errors]};
              })()`)
              assert.ok(result.opened.focusedInside, 'Opened overlay must receive focus')
              if (item.parent && close === 'escape') {
                const filename = `${item.name}-${theme}-${width}x${height}-opened.png`
                fs.writeFileSync(
                  path.join(out, filename),
                  (await win.webContents.capturePage()).toPNG()
                )
                result.openedScreenshot = filename
              }
              if (close === 'escape') await key('Escape')
              else await activate('.app-drawer-close, .el-dialog__headerbtn', null, true, true)
              await waitFor(
                `([...document.querySelectorAll(${JSON.stringify(overlay)})].filter(e=>e.getClientRects().length&&getComputedStyle(e).visibility!=='hidden')).length===${count - 1}`
              )
              await sleep(450)
              result.restored = await js(`(() => {
                const e=window.pilotExpectedLauncher,a=document.activeElement;
                const visible=e=>!!e?.isConnected&&!!e.getClientRects().length&&getComputedStyle(e).visibility!=='hidden';
                return {exact:a===e,launcherConnected:!!e.isConnected,launcherVisible:visible(e),fallback:a===window.pilotMenuLauncher,focusedVisible:visible(a),focusedTag:a.tagName,focusedName:a.getAttribute('aria-label')||a.textContent.trim().slice(0,80)};
              })()`)
              result.errors = await js('[...window.hallmark.errors]')
              result.consoleErrors = [...consoleErrors]
              assert.deepEqual(result.errors, [], 'No renderer errors during actual-trigger flow')
              assert.deepEqual(
                result.consoleErrors,
                [],
                'No renderer console errors during actual-trigger flow'
              )
              assert.ok(
                result.restored.focusedVisible &&
                  (result.restored.exact ||
                    (!result.restored.launcherVisible && result.restored.fallback)),
                'Focus must return to visible launcher or its menu trigger: ' +
                  JSON.stringify(result.restored)
              )
              if (item.parent) {
                result.parentRemainedOpen = await js(
                  `!!document.querySelector(${JSON.stringify(overlay)})?.contains(document.activeElement)`
                )
                assert.ok(
                  result.parentRemainedOpen,
                  'Closing nested drawer must preserve its parent'
                )
                if (close === 'escape') {
                  const filename = `${item.name}-${theme}-${width}x${height}-restored.png`
                  fs.writeFileSync(
                    path.join(out, filename),
                    (await win.webContents.capturePage()).toPNG()
                  )
                  result.restoredScreenshot = filename
                }
              }
              result.pass = true
            } catch (error) {
              result.error = String(error)
              result.errors = await js('window.hallmark?.errors || []').catch(() => [])
              result.consoleErrors = [...consoleErrors]
              const capture = await win.webContents.capturePage()
              fs.writeFileSync(
                path.join(out, `${item.name}-${theme}-${width}-${close}.png`),
                capture.toPNG()
              )
              process.exitCode = 1
            }
            result.inputEvents = await js('window.pilotInputEvents || []').catch(() => [])
            report.cases.push(result)
            fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2))
            console.log(
              result.pass ? 'PASS' : 'FAIL',
              item.name,
              theme,
              width,
              close,
              result.error || ''
            )
          }
        }
      }
    }
  } catch (error) {
    report.errors.push(String(error))
    process.exitCode = 1
  } finally {
    fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2))
    console.log(
      JSON.stringify({
        cases: report.cases.length,
        passes: report.cases.filter((item) => item.pass).length,
        errors: report.errors
      })
    )
    win.destroy()
    app.exit(process.exitCode || 0)
  }
})
