/* eslint-disable @typescript-eslint/no-require-imports -- Isolated Electron renderer fixture. */
// Real component launchers and native keyboard input; no native application effects.
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { app, BrowserWindow } = require('electron')

const out = path.resolve('tmp/hallmark/audit', process.env.HALLMARK_RUN || 'pilot-startup-editor')
fs.mkdirSync(out, { recursive: true })
app.setPath('userData', fs.mkdtempSync(path.join(os.tmpdir(), 'qtenvdev-group-editor-')))
app.commandLine.appendSwitch('force-device-scale-factor', '1')
app.commandLine.appendSwitch('disable-backgrounding-occluded-windows')
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
const dialog = '.startup-group-editor-dialog'
const sizes = (process.env.HALLMARK_SIZES || '1200x800,800x600').split(',').map((size) => {
  const match = /^(\d+)x(\d+)$/.exec(size)
  assert.ok(match, 'Invalid viewport: ' + size)
  return { width: Number(match[1]), height: Number(match[2]) }
})
const themes = (process.env.HALLMARK_THEMES || 'dark,light').split(',')
const locales = (process.env.HALLMARK_LOCALES || 'en,vi').split(',')
const checkDiscard = process.env.HALLMARK_DISCARD === '1'
const checkFailures = !!process.env.HALLMARK_FAILURES
assert.ok(themes.every((theme) => ['dark', 'light'].includes(theme)))
assert.ok(locales.every((locale) => ['en', 'vi'].includes(locale)))

app.whenReady().then(async () => {
  const report = {
    scope:
      'StartupGroup production Add/Edit, three-step draft, native keyboard and fixture-only save',
    limitations:
      'IPC stubbed; no service/helper/installer test; API focuses controls before activation',
    discardChecks: checkDiscard,
    failureChecks: checkFailures,
    cases: [],
    errors: []
  }
  let consoleErrors = []
  let partition = 0
  const createWindow = () => {
    const window = new BrowserWindow({
      show: false,
      frame: false,
      width: 1200,
      height: 800,
      webPreferences: {
        offscreen: true,
        backgroundThrottling: false,
        partition: `hallmark-startup-editor-${partition++}`
      }
    })
    window.webContents.on('console-message', (details) => {
      if (details.level === 'error') consoleErrors.push(details.message)
    })
    return window
  }
  let win = createWindow()
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
    if (keyCode === 'Enter') win.webContents.sendInputEvent({ type: 'char', keyCode: '\r' })
    if (keyCode === 'Space') win.webContents.sendInputEvent({ type: 'char', keyCode: ' ' })
    win.webContents.sendInputEvent({ type: 'keyUp', keyCode })
    await sleep(90)
  }
  const activate = async (selector, index = 0, keyCode = 'Enter') => {
    await js(`(() => {
      const e=[...document.querySelectorAll(${JSON.stringify(selector)})].filter(e=>e.getClientRects().length&&getComputedStyle(e).visibility!=='hidden')[${index}];
      if(!e)throw new Error('Missing visible control: '+${JSON.stringify(selector)});
      e.scrollIntoView({block:'nearest'});e.focus();
      if(document.activeElement!==e)throw new Error('Control did not receive focus');
    })()`)
    await key(keyCode)
  }
  const settle = () =>
    js(`new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))).then(()=>
      Promise.allSettled(document.getAnimations().filter(animation=>
        animation.effect?.getTiming().iterations!==Infinity).map(animation=>animation.finished)))`)
  const screenshot = async (prefix, name) => {
    await settle()
    const filename = `${prefix}-${name}.png`
    fs.writeFileSync(path.join(out, filename), (await win.webContents.capturePage()).toPNG())
    return filename
  }
  const measure = async () => {
    await settle()
    return js(`(() => {
    const d=document.querySelector('${dialog}'),f=d.querySelector('.el-dialog__footer');
    const box=e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,bottom:r.bottom}};
    const r=box(d),footer=box(f);
    const overflow=[...d.querySelectorAll('input,textarea,button,.el-checkbox,.el-step__title')]
      .filter(e=>e.getClientRects().length&&getComputedStyle(e).visibility!=='hidden')
      .map(e=>({tag:e.tagName,text:e.getAttribute('aria-label')||e.textContent.trim().slice(0,70),...box(e)}))
      .filter(e=>e.x<r.x-1||e.right>r.right+1);
    return {dialog:r,footer,overflow,rootOverflow:document.documentElement.scrollWidth>innerWidth,
      focusedInside:d.contains(document.activeElement),
      footerVisible:footer.y>=r.y&&footer.bottom<=innerHeight,
      fitsViewport:r.x>=0&&r.y>=0&&r.right<=innerWidth+1&&r.bottom<=innerHeight+1};
  })()`)
  }
  const assertLayout = (value) => {
    assert.ok(
      value.fitsViewport && value.footerVisible && !value.rootOverflow,
      JSON.stringify(value)
    )
    assert.deepEqual(value.overflow, [], 'Controls must stay inside dialog')
  }
  const changeText = async (selector, value) => {
    await js(`(() => {
      const input=document.querySelector(${JSON.stringify(selector)});
      if(!input)throw new Error('Missing draft input');
      input.scrollIntoView({block:'nearest'});input.focus();input.select();
    })()`)
    await win.webContents.insertText(value)
  }
  const candidateFailures = async (prefix) => {
    const before = await js('window.hallmark.startupGroupSnapshot()')
    const persisted = await js('window.hallmark.startupGroupPersistedSnapshot()')
    await js("window.hallmark.startupGroupFault('candidates','hold')")
    await activate('.app-page-header__actions button.el-button--primary')
    await waitFor(`!!document.querySelector('${dialog} input')`)
    await waitFor('window.hallmark.startupGroupFaultSnapshot().candidates.pending===1')
    await changeText(`${dialog} .el-input input`, 'Candidate failure draft')
    await changeText(`${dialog} textarea`, 'Keep this description after retry')
    const pending = await js(`(() => ({
      nextDisabled:document.querySelector('${dialog} .el-dialog__footer button.el-button--primary').disabled,
      loadingVisible:!!document.querySelector('${dialog} [role="status"]'),
      emptyVisible:!!document.querySelector('${dialog} .el-empty')
    }))()`)
    if (process.env.HALLMARK_FAILURE_BASELINE === '1') {
      await js("window.hallmark.releaseStartupGroupFault('candidates',true)")
      await sleep(350)
      const baseline = {
        pending,
        errors: await js('[...window.hallmark.errors]'),
        alert: await js(`!!document.querySelector('${dialog} [role="alert"]')`),
        screenshot: await screenshot(prefix, 'candidate-rejection-before')
      }
      fs.writeFileSync(path.join(out, 'failure-baseline.json'), JSON.stringify(baseline, null, 2))
      throw new Error('Baseline captured: missing candidate loading/error UI')
    }
    assert.ok(
      pending.nextDisabled && pending.loadingVisible && !pending.emptyVisible,
      'Candidate loading must be visible and block dependent steps'
    )
    await js("window.hallmark.releaseStartupGroupFault('candidates',true)")
    await waitFor(`!!document.querySelector('${dialog} [role="alert"]')`)
    const error = await js(`(() => {
      const e=document.querySelector('${dialog} [role="alert"]');
      return {text:e.textContent,unsafeHTML:!!e.querySelector('fixture-error'),
        name:document.querySelector('${dialog} input').value,
        description:document.querySelector('${dialog} textarea').value,
        nextDisabled:document.querySelector('${dialog} .el-dialog__footer button.el-button--primary').disabled,
        retryEnabled:!e.querySelector('button').disabled};
    })()`)
    assert.ok(error.text.includes('Fixture candidate source unavailable <fixture-error>'))
    assert.ok(!error.unsafeHTML && error.nextDisabled && error.retryEnabled)
    assert.equal(error.name, 'Candidate failure draft')
    assert.equal(error.description, 'Keep this description after retry')
    const layout = await measure()
    assertLayout(layout)
    const capture = await screenshot(prefix, 'candidate-error')
    await sleep(200)
    assert.equal(
      await js('window.hallmark.startupGroupFaultSnapshot().candidates.calls'),
      1,
      'Load failure must not retry automatically'
    )
    await js("window.hallmark.startupGroupFault('candidates','pass')")
    await activate(`${dialog} [role="alert"] button`)
    await waitFor(
      `!document.querySelector('${dialog} [role="alert"]') && !document.querySelector('${dialog} .el-dialog__footer button.el-button--primary').disabled`
    )
    assert.equal(await js(`document.querySelector('${dialog} input').value`), error.name)
    await activate(`${dialog} .el-dialog__footer button.el-button--primary`)
    await waitFor(`document.querySelectorAll('${dialog} .startup-group-candidate-card').length===5`)
    await key('Escape')
    await waitFor(`!document.querySelector('${dialog}')`)
    await sleep(350)
    assert.deepEqual(await js('window.hallmark.startupGroupSnapshot()'), before)
    assert.deepEqual(await js('window.hallmark.startupGroupPersistedSnapshot()'), persisted)
    // Settle the old open after a later open has already completed.
    await js("window.hallmark.startupGroupFault('candidates','hold')")
    await activate('.app-page-header__actions button.el-button--primary')
    await waitFor('window.hallmark.startupGroupFaultSnapshot().candidates.pending===1')
    await key('Escape')
    await waitFor(`!document.querySelector('${dialog}')`)
    await sleep(350)
    await js("window.hallmark.startupGroupFault('candidates','pass')")
    await activate('.app-page-header__actions button.el-button--primary')
    await waitFor(
      `!!document.querySelector('${dialog} input') && !document.querySelector('${dialog} .el-dialog__footer button.el-button--primary').disabled`
    )
    await changeText(`${dialog} .el-input input`, 'Newer open survives')
    await js("window.hallmark.releaseStartupGroupFault('candidates',true)")
    await sleep(250)
    assert.ok(!(await js(`!!document.querySelector('${dialog} [role="alert"]')`)))
    assert.equal(await js(`document.querySelector('${dialog} input').value`), 'Newer open survives')
    await key('Escape')
    await waitFor(`!document.querySelector('${dialog}')`)
    await sleep(350)
    return {
      pending,
      error,
      layout,
      screenshot: capture,
      retryPreservedDraft: true,
      staleRejectionIgnored: true,
      liveUnchanged: true,
      persistedUnchanged: true
    }
  }
  const saveFailure = async (prefix, operation, expectedBasic) => {
    const before = await js('window.hallmark.startupGroupSnapshot()')
    const persisted = await js('window.hallmark.startupGroupPersistedSnapshot()')
    const beforeCalls = await js('window.hallmark.startupGroupFaultSnapshot().save.calls')
    await js("window.hallmark.startupGroupFault('save','hold')")
    const expectedOrder = await js(
      `Array.from(document.querySelectorAll('${dialog} .startup-group-order-label')).map(e=>e.textContent.trim())`
    )
    await activate(`${dialog} .el-dialog__footer button.el-button--primary`)
    await waitFor('window.hallmark.startupGroupFaultSnapshot().save.pending===1')
    // A second activation and Escape must not write twice or close an in-flight save.
    await key('Enter')
    await key('Escape')
    const pending = await js(`(() => ({
      open:!!document.querySelector('${dialog}'),
      calls:window.hallmark.startupGroupFaultSnapshot().save.calls,
      footerDisabled:[...document.querySelectorAll('${dialog} .el-dialog__footer button')].every(e=>e.disabled),
      closeVisible:!!document.querySelector('${dialog} .el-dialog__headerbtn')?.getClientRects().length,
      saving:!!document.querySelector('${dialog} .el-button.is-loading')
    }))()`)
    assert.ok(pending.open && pending.footerDisabled && !pending.closeVisible && pending.saving)
    assert.equal(pending.calls, beforeCalls + 1)
    assert.deepEqual(await js('window.hallmark.startupGroupSnapshot()'), before)
    assert.deepEqual(await js('window.hallmark.startupGroupPersistedSnapshot()'), persisted)
    await js("window.hallmark.releaseStartupGroupFault('save',true)")
    await waitFor(
      `!!document.querySelector('${dialog} [role="alert"]') && !document.querySelector('${dialog} .el-button.is-loading')`
    )
    const error = await js(`(() => {
      const e=document.querySelector('${dialog} [role="alert"]');
      e.scrollIntoView({block:'nearest'});
      return {text:e.textContent,unsafeHTML:!!e.querySelector('fixture-error'),
        order:[...document.querySelectorAll('${dialog} .startup-group-order-label')].map(e=>e.textContent.trim()),
        focused:document.activeElement===e,
        footerEnabled:[...document.querySelectorAll('${dialog} .el-dialog__footer button')].every(e=>!e.disabled)};
    })()`)
    assert.ok(error.text.includes('Fixture storage write rejected <fixture-error>'))
    assert.ok(!error.unsafeHTML && error.footerEnabled && error.focused)
    assert.deepEqual(error.order, expectedOrder)
    assert.deepEqual(await js('window.hallmark.startupGroupSnapshot()'), before)
    assert.deepEqual(await js('window.hallmark.startupGroupPersistedSnapshot()'), persisted)
    const layout = await measure()
    assertLayout(layout)
    const capture = await screenshot(prefix, `${operation}-save-error`)
    await sleep(200)
    assert.equal(
      await js('window.hallmark.startupGroupFaultSnapshot().save.calls'),
      beforeCalls + 1
    )
    await activate(`${dialog} .el-dialog__footer > .startup-group-editor-footer > button`)
    await activate(`${dialog} .el-dialog__footer > .startup-group-editor-footer > button`)
    const basic = await js(`(() => ({
      name:document.querySelector('${dialog} .el-input input').value,
      description:document.querySelector('${dialog} textarea').value,
      continueOnFailure:document.querySelector('${dialog} .startup-group-failure-policy input').checked
    }))()`)
    assert.deepEqual(basic, expectedBasic, 'Save rejection must retain the complete basic draft')
    await activate(`${dialog} .el-dialog__footer button.el-button--primary`)
    await activate(`${dialog} .el-dialog__footer button.el-button--primary`)
    assert.deepEqual(
      await js(
        `Array.from(document.querySelectorAll('${dialog} .startup-group-order-label')).map(e=>e.textContent.trim())`
      ),
      expectedOrder
    )
    await js("window.hallmark.startupGroupFault('save','pass')")
    return {
      pending,
      error,
      layout,
      screenshot: capture,
      liveUnchanged: true,
      persistedUnchanged: true,
      basic,
      noAutomaticRetry: true,
      expectedNextCall: beforeCalls + 2
    }
  }
  const discardDrafts = async (editSelector, expectedLabels) => {
    const before = await js('window.hallmark.startupGroupSnapshot()')
    const persistedBefore = await js('window.hallmark.startupGroupPersistedSnapshot()')
    assert.deepEqual(persistedBefore, before, 'Saved fixture must match its domain state')
    const cases = []
    for (const step of [0, 1, 2]) {
      for (const closeMethod of ['cancel', 'escape', 'close-button']) {
        await activate(editSelector)
        await waitFor(`!!document.querySelector('${dialog} input')`)
        await sleep(350)
        assert.equal(
          await js(`document.querySelector('${dialog} input').value`),
          before.groups[0].name,
          'Reopened draft name must come from saved group'
        )
        const draftName = `Discard ${step} ${closeMethod}`
        await changeText(`${dialog} .el-input input`, draftName)
        await changeText(`${dialog} textarea`, `Uncommitted description ${step} ${closeMethod}`)
        await activate(`${dialog} .startup-group-failure-policy input`, 0, 'Space')
        if (step > 0) {
          await activate(`${dialog} .el-dialog__footer button.el-button--primary`)
          await waitFor(
            `document.querySelectorAll('${dialog} .startup-group-candidate-card[aria-pressed="true"]').length===4`
          )
          await activate(`${dialog} .startup-group-candidate-card[aria-pressed="true"]`, 0, 'Space')
          assert.equal(
            await js(
              `document.querySelectorAll('${dialog} .startup-group-candidate-card[aria-pressed="true"]').length`
            ),
            3,
            'Draft membership must actually change before discard'
          )
        }
        if (step > 1) {
          await activate(`${dialog} .el-dialog__footer button.el-button--primary`)
          await waitFor(
            `document.querySelectorAll('${dialog} .startup-group-order-item').length===3`
          )
          await activate(
            `${dialog} .startup-group-order-item:first-child .startup-group-order-actions button:nth-child(2)`
          )
          await activate(
            `${dialog} .startup-group-order-item:last-child .startup-group-order-actions button:nth-child(3)`
          )
          assert.equal(
            await js(`document.querySelectorAll('${dialog} .startup-group-order-item').length`),
            2,
            'Draft order/removal must actually change before discard'
          )
        }
        assert.deepEqual(
          await js('window.hallmark.startupGroupSnapshot()'),
          before,
          'Editing must not mutate the live group'
        )
        assert.deepEqual(
          await js('window.hallmark.startupGroupPersistedSnapshot()'),
          persistedBefore,
          'Editing must not persist its draft'
        )
        if (closeMethod === 'cancel')
          await activate(`${dialog} .startup-group-editor-footer-actions > button:first-child`)
        else if (closeMethod === 'escape') await key('Escape')
        else await activate(`${dialog} .el-dialog__headerbtn`)
        await waitFor(`!document.querySelector('${dialog}')`)
        await sleep(350)
        const restored = await js(
          `document.activeElement===document.querySelector(${JSON.stringify(editSelector)})`
        )
        assert.ok(restored, 'Discard must restore focus to Edit launcher')
        assert.deepEqual(
          await js('window.hallmark.startupGroupSnapshot()'),
          before,
          'Discard must retain the complete live config'
        )
        assert.deepEqual(
          await js('window.hallmark.startupGroupPersistedSnapshot()'),
          persistedBefore,
          'Discard must retain persisted config'
        )
        cases.push({
          step,
          closeMethod,
          liveUnchanged: true,
          persistedUnchanged: true,
          focusRestored: restored
        })
      }
    }
    await activate(editSelector)
    await waitFor(`!!document.querySelector('${dialog} input')`)
    await sleep(350)
    const reopened = await js(`(() => ({
      name:document.querySelector('${dialog} .el-input input').value,
      description:document.querySelector('${dialog} textarea').value,
      continueOnFailure:document.querySelector('${dialog} .startup-group-failure-policy input').checked
    }))()`)
    assert.equal(reopened.name, before.groups[0].name)
    assert.equal(reopened.description, before.groups[0].description || '')
    assert.equal(reopened.continueOnFailure, !!before.groups[0].continueOnFailure)
    await activate(`${dialog} .el-dialog__footer button.el-button--primary`)
    await waitFor(
      `document.querySelectorAll('${dialog} .startup-group-candidate-card[aria-pressed="true"]').length===4`
    )
    await activate(`${dialog} .el-dialog__footer button.el-button--primary`)
    await waitFor(`document.querySelectorAll('${dialog} .startup-group-order-item').length===4`)
    const reopenedLabels = await js(
      `Array.from(document.querySelectorAll('${dialog} .startup-group-order-label')).map(e=>e.textContent.trim())`
    )
    assert.deepEqual(
      reopenedLabels,
      expectedLabels,
      'Reopened membership and order must match saved draft'
    )
    await key('Escape')
    await waitFor(`!document.querySelector('${dialog}')`)
    await sleep(350)
    return { cases, reopened, reopenedLabels }
  }
  try {
    for (const { width, height } of sizes) {
      for (const theme of themes) {
        for (const locale of locales) {
          const result = { width, height, theme, locale, pass: false, screenshots: [] }
          const prefix = `startup-editor-${locale}-${theme}-${width}x${height}`
          consoleErrors = []
          try {
            if (report.cases.length) {
              const previousWindow = win
              win = createWindow()
              previousWindow.destroy()
            }
            win.setContentSize(width, height)
            await win.loadURL('http://127.0.0.1:5201/hallmark-preview?platform=macos')
            await waitFor('!!window.hallmark', 90000)
            if (!win.webContents.debugger.isAttached()) win.webContents.debugger.attach('1.3')
            await win.webContents.debugger.sendCommand('Emulation.setFocusEmulationEnabled', {
              enabled: true
            })
            win.webContents.focus()
            await js(`window.hallmark.setTheme('${theme}')`)
            await js(`window.hallmark.setLocale('${locale}')`)
            await js(`window.hallmark.store.asideExpanded=${width >= 960}`)
            await js("window.hallmark.scenario('groups-editor')")
            await waitFor(
              "!!document.querySelector('.app-page-header__actions button.el-button--primary')"
            )
            await js(
              "window.groupLauncher=document.querySelector('.app-page-header__actions button.el-button--primary')"
            )
            if (checkFailures) result.candidateFailure = await candidateFailures(prefix)
            await activate('.app-page-header__actions button.el-button--primary')
            await waitFor(`!!document.querySelector('${dialog} input')`)
            await sleep(400)
            result.basic = await measure()
            assertLayout(result.basic)
            assert.ok(result.basic.focusedInside)
            result.screenshots.push(await screenshot(prefix, 'basic'))
            await activate(`${dialog} .el-dialog__footer button.el-button--primary`)
            result.validation = await js(`(() => {
              const e=document.querySelector('${dialog} input'),id=e.getAttribute('aria-describedby');
              return {invalid:e.getAttribute('aria-invalid'),focused:document.activeElement===e,
                message:document.getElementById(id)?.textContent.trim()};
            })()`)
            assert.equal(result.validation.invalid, 'true')
            assert.ok(result.validation.focused && result.validation.message)
            await win.webContents.insertText('Fixture workbench group')
            if (checkFailures) {
              await changeText(
                `${dialog} textarea`,
                'Fixture draft description retained after failure'
              )
              await activate(`${dialog} .startup-group-failure-policy input`, 0, 'Space')
            }
            await activate(`${dialog} .el-dialog__footer button.el-button--primary`)
            await waitFor(`!!document.querySelector('${dialog} .startup-group-category-collapse')`)
            // Expand actual Element Plus headers using Enter, not Vue component state.
            for (const selector of [
              `${dialog} .startup-group-category-collapse > .el-collapse-item > .el-collapse-item__header`,
              `${dialog} .startup-group-module-collapse > .el-collapse-item > .el-collapse-item__header`
            ]) {
              const count = await js(
                `document.querySelectorAll(${JSON.stringify(selector)}).length`
              )
              for (let i = 0; i < count; i++) await activate(selector, i)
              await sleep(250)
            }
            const candidate = `${dialog} .startup-group-candidate-card`
            const indices = await js(`(() => {
              const all=[...document.querySelectorAll('${candidate}')];
              return {apache:all.flatMap((e,i)=>e.textContent.includes('/visual-fixture/apache/')?[i]:[]),
                php:all.flatMap((e,i)=>e.textContent.includes('/visual-fixture/php/')?[i]:[]),
                node:all.findIndex(e=>e.textContent.includes('/visual-fixture/teams/'))};
            })()`)
            assert.equal(indices.apache.length, 2)
            assert.equal(indices.php.length, 2)
            assert.ok(indices.node >= 0)
            await activate(candidate, indices.apache[0])
            await activate(candidate, indices.apache[1], 'Space')
            result.singleSelection = await js(
              `Array.from(document.querySelectorAll('${candidate}')).filter(e=>e.textContent.includes('/visual-fixture/apache/')&&e.getAttribute('aria-pressed')==='true').map(e=>e.textContent.trim())`
            )
            assert.equal(result.singleSelection.length, 1)
            assert.ok(result.singleSelection[0].includes('2.0.0'))
            await activate(candidate, indices.php[0])
            await activate(candidate, indices.php[1], 'Space')
            await activate(candidate, indices.node, 'Space')
            result.selected = await js(
              `document.querySelectorAll('${candidate}[aria-pressed="true"]').length`
            )
            result.warnings = await js(
              `document.querySelectorAll('${dialog} .startup-group-candidate-warning').length`
            )
            assert.equal(result.selected, 4)
            assert.ok(result.warnings >= 2)
            result.candidates = await measure()
            assertLayout(result.candidates)
            result.screenshots.push(await screenshot(prefix, 'candidates'))
            await activate(`${dialog} .el-dialog__footer button.el-button--primary`)
            await waitFor(
              `document.querySelectorAll('${dialog} .startup-group-order-item').length===4`
            )
            const labels = () =>
              js(
                `Array.from(document.querySelectorAll('${dialog} .startup-group-order-label')).map(e=>e.textContent.trim())`
              )
            result.orderBefore = await labels()
            await activate(
              `${dialog} .startup-group-order-item:first-child .startup-group-order-actions button:nth-child(2)`
            )
            result.orderAfter = await labels()
            assert.equal(result.orderAfter[1], result.orderBefore[0])
            assert.equal(result.orderAfter[0], result.orderBefore[1])
            result.order = await measure()
            assertLayout(result.order)
            result.screenshots.push(await screenshot(prefix, 'order'))
            result.focusTrap = true
            for (let i = 0; i < 24; i++) {
              await key('Tab')
              if (
                !(await js(`document.querySelector('${dialog}').contains(document.activeElement)`))
              )
                result.focusTrap = false
            }
            assert.ok(result.focusTrap, 'Focus must remain inside the dialog')
            if (checkFailures)
              result.addFailure = await saveFailure(prefix, 'add', {
                name: 'Fixture workbench group',
                description: 'Fixture draft description retained after failure',
                continueOnFailure: true
              })
            await activate(`${dialog} .el-dialog__footer button.el-button--primary`)
            await waitFor(`!document.querySelector('${dialog}')`)
            result.saved = await js('window.hallmark.startupGroupSnapshot()')
            assert.equal(result.saved.groups.length, 1)
            assert.equal(result.saved.groups[0].name, 'Fixture workbench group')
            assert.equal(result.saved.groups[0].items.length, 4)
            assert.deepEqual(
              result.saved.groups[0].items.map((item) => item.module),
              ['php-fpm', 'apache', 'php-fpm', 'node']
            )
            if (checkFailures) {
              assert.equal(
                await js('window.hallmark.startupGroupFaultSnapshot().save.calls'),
                result.addFailure.expectedNextCall
              )
              assert.deepEqual(
                await js('window.hallmark.startupGroupPersistedSnapshot()'),
                result.saved
              )
            }
            await waitFor("!!document.querySelector('.startup-group-card button[aria-label]')")
            const edit = locale === 'vi' ? 'Sửa' : 'Edit'
            const selector = `.startup-group-card button[aria-label="${edit}"]`
            await js(`window.groupEditLauncher=document.querySelector(${JSON.stringify(selector)})`)
            await activate(selector)
            await waitFor(`!!document.querySelector('${dialog} input')`, 2500)
            await sleep(350)
            result.editName = await js(`document.querySelector('${dialog} input').value`)
            assert.equal(result.editName, 'Fixture workbench group')
            await key('Escape')
            await waitFor(`!document.querySelector('${dialog}')`)
            await sleep(350)
            result.focusRestored = await js('document.activeElement===window.groupEditLauncher')
            assert.ok(result.focusRestored, 'Edit launcher must receive focus after Escape')
            const checkbox = '.startup-group-card .el-checkbox input'
            await activate(checkbox, 0, 'Space')
            result.defaultAfterSpace = await js('window.hallmark.startupGroupSnapshot()')
            assert.equal(result.defaultAfterSpace.defaultStartupGroupId, result.saved.groups[0].id)
            if (checkDiscard) result.discard = await discardDrafts(selector, result.orderAfter)
            if (checkFailures) {
              await activate(selector)
              await waitFor(`!!document.querySelector('${dialog} input')`)
              await sleep(350)
              const updated = {
                name: 'Updated after storage failure',
                description: 'Keep the edited description',
                continueOnFailure: false
              }
              await changeText(`${dialog} .el-input input`, updated.name)
              await changeText(`${dialog} textarea`, updated.description)
              await activate(`${dialog} .startup-group-failure-policy input`, 0, 'Space')
              await activate(`${dialog} .el-dialog__footer button.el-button--primary`)
              await activate(`${dialog} .el-dialog__footer button.el-button--primary`)
              await activate(
                `${dialog} .startup-group-order-item:first-child .startup-group-order-actions button:nth-child(2)`
              )
              await activate(
                `${dialog} .startup-group-order-item:last-child .startup-group-order-actions button:last-child`
              )
              result.updateFailure = await saveFailure(prefix, 'update', updated)
              await activate(`${dialog} .el-dialog__footer button.el-button--primary`)
              await waitFor(`!document.querySelector('${dialog}')`)
              result.afterUpdate = await js('window.hallmark.startupGroupSnapshot()')
              assert.equal(result.afterUpdate.groups.length, 1)
              assert.equal(result.afterUpdate.groups[0].id, result.saved.groups[0].id)
              assert.equal(result.afterUpdate.groups[0].name, updated.name)
              assert.equal(result.afterUpdate.groups[0].description, updated.description)
              assert.equal(
                !!result.afterUpdate.groups[0].continueOnFailure,
                updated.continueOnFailure
              )
              assert.deepEqual(
                result.afterUpdate.groups[0].items.map((item) => item.id),
                [
                  result.saved.groups[0].items[1].id,
                  result.saved.groups[0].items[0].id,
                  result.saved.groups[0].items[2].id
                ]
              )
              assert.equal(
                await js('window.hallmark.startupGroupFaultSnapshot().save.calls'),
                result.updateFailure.expectedNextCall
              )
              assert.deepEqual(
                await js('window.hallmark.startupGroupPersistedSnapshot()'),
                result.afterUpdate
              )
            }
            const deleteLabel = locale === 'vi' ? 'Xóa' : 'Delete'
            await activate(`.startup-group-card button[aria-label="${deleteLabel}"]`)
            await waitFor("!!document.querySelector('.el-message-box')")
            await key('Escape')
            await waitFor("!document.querySelector('.el-message-box')")
            result.afterDeleteCancel = await js('window.hallmark.startupGroupSnapshot()')
            assert.equal(result.afterDeleteCancel.groups.length, 1)
            result.errors = await js('[...window.hallmark.errors]')
            result.consoleErrors = [...consoleErrors]
            assert.deepEqual(result.errors, [])
            assert.deepEqual(result.consoleErrors, [])
            result.pass = true
          } catch (error) {
            result.error = String(error)
            result.errors = await js('window.hallmark?.errors || []').catch(() => [])
            result.consoleErrors = [...consoleErrors]
            result.screenshots.push(await screenshot(prefix, 'failure'))
            process.exitCode = 1
          }
          report.cases.push(result)
          fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2))
          console.log(result.pass ? 'PASS' : 'FAIL', prefix, result.error || '')
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
