// ponytail: renderer visual coverage only; use native-platform smoke tests for real IPC.
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const os = require('node:os')
const { app, BrowserWindow } = require('electron')
const platform = process.env.HALLMARK_PLATFORM || 'windows'
const out = path.resolve('tmp/hallmark/audit', process.env.HALLMARK_RUN || platform)
fs.mkdirSync(out, { recursive: true })
app.setPath('userData', fs.mkdtempSync(path.join(os.tmpdir(), 'qtenvdev-visual-')))
app.commandLine.appendSwitch('force-device-scale-factor', '1')
app.commandLine.appendSwitch('disable-backgrounding-occluded-windows')
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
app.whenReady().then(async () => {
  const win = new BrowserWindow({
    show: false,
    frame: false,
    width: 1280,
    height: 900,
    webPreferences: { offscreen: true, backgroundThrottling: false }
  })
  const js = (source) => win.webContents.executeJavaScript(source, true)
  const report = { platform, routes: [], states: [], tabs: [], errors: [] }
  const waitFor = async (source, timeout = 30000) => {
    const end = Date.now() + timeout
    while (!(await js(source))) {
      if (Date.now() > end) throw new Error('Timed out: ' + source)
      await sleep(50)
    }
  }
  const settle = async () => {
    await js(
      'document.fonts.ready.then(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))))'
    )
    await sleep(100)
    win.webContents.invalidate()
    await sleep(50)
  }
  const resize = async (width) => {
    win.setContentSize(width, 900)
    await waitFor(`innerWidth === ${width}`)
    await settle()
  }
  const snap = async (name) => {
    await settle()
    const screenshot = await win.webContents.capturePage()
    const width = await js('innerWidth')
    assert.equal(screenshot.getSize().width, width, 'Screenshot width must match CSS viewport')
    fs.writeFileSync(path.join(out, name + '.png'), screenshot.toPNG())
  }
  const measure = () =>
    js(`(() => {
    const root = document.querySelector('#container > .main-right-panel');
    const visible = e => e.getClientRects().length && getComputedStyle(e).visibility !== 'hidden';
    const clipped = root ? [...root.querySelectorAll('button,input,[role="tab"],.el-radio-button__inner')].filter(visible).filter(e=>{
      if(e.closest('.el-table,.monaco-editor,.el-tree,.el-tabs__nav-scroll'))return false;
      const r=e.getBoundingClientRect(); return r.width>0&&(r.right>innerWidth+2||r.left<0);
    }).map(e=>({tag:e.tagName,text:(e.innerText||e.getAttribute('aria-label')||e.getAttribute('placeholder')||'').slice(0,60),x:Math.round(e.getBoundingClientRect().x),width:Math.round(e.getBoundingClientRect().width)})).slice(0,12):[];
    return {current:location.hash,width:innerWidth,scroll:document.documentElement.scrollWidth,root:!!root,text:root?.innerText.slice(0,700),clipped,errors:[...window.hallmark.errors]};
  })()`)
  try {
    await win.loadURL('http://127.0.0.1:5201/hallmark-preview?platform=' + platform)
    await waitFor('!!window.hallmark', 90000)
    await settle()
    const all = await js('["/setup","/customer-module",...window.hallmark.routes.map(r=>r.route)]')
    const requested = process.env.HALLMARK_ROUTES?.split(',')
    const routes = requested || all
    const widths = (process.env.HALLMARK_WIDTHS || '320,375,414,768,960,1280,1440')
      .split(',')
      .map(Number)
    for (const route of routes) {
      await js(`window.hallmark.navigate(${JSON.stringify(route)})`)
      await settle()
      const current = await js('location.hash')
      if (current !== '#' + route) {
        const expected =
          platform === 'windows' && ['/pure-ftpd', '/clickhouse', '/typesense'].includes(route)
        report.routes.push({ route, redirect: current, expected })
        assert.ok(expected, 'Unexpected route redirect: ' + route + ' to ' + current)
        continue
      }
      for (const theme of ['light', 'dark']) {
        await js(`document.documentElement.className=${JSON.stringify(theme)}`)
        for (const width of widths) {
          await resize(width)
          await js(`window.hallmark.store.asideExpanded=${width >= 960}`)
          await settle()
          const measurement = await measure()
          report.routes.push({ route, theme, ...measurement })
          if ([320, 1280].includes(width)) await snap(route.slice(1) + '-' + theme + '-' + width)
        }
      }
      if (process.env.HALLMARK_TABS === '1') {
        await resize(1280)
        await js("document.documentElement.className='light'")
        const tabCount = await js(
          "document.querySelectorAll('.app-workbench-page > .el-radio-group .el-radio-button,.app-workbench-page > .app-settings-tabs button').length"
        )
        for (let i = 0; i < tabCount; i++) {
          await js(
            `window.hallmark.errors.length=0; document.querySelectorAll('.app-workbench-page > .el-radio-group .el-radio-button,.app-workbench-page > .app-settings-tabs button')[${i}].click()`
          )
          await settle()
          for (const theme of ['light', 'dark']) {
            await js(`document.documentElement.className=${JSON.stringify(theme)}`)
            for (const width of [320, 1280]) {
              await resize(width)
              await js(`window.hallmark.store.asideExpanded=${width >= 960}`)
              await settle()
              report.tabs.push({ route, tab: i, theme, ...(await measure()) })
              await snap(route.slice(1) + '-tab-' + i + '-' + theme + '-' + width)
            }
          }
        }
      }
      fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2))
      console.log('Reviewed', route)
    }
    if (process.env.HALLMARK_STATES === '1') {
      await js("window.hallmark.AppModuleTab.apache=0;window.hallmark.navigate('/apache')")
      await resize(1280)
      for (const state of ['empty', 'loading', 'populated', 'busy']) {
        await js(`window.hallmark.setServiceState('apache',${JSON.stringify(state)})`)
        for (const theme of ['light', 'dark']) {
          await js(`document.documentElement.className=${JSON.stringify(theme)}`)
          await settle()
          report.states.push({ state, theme, ...(await measure()) })
          await snap('service-' + state + '-' + theme)
        }
      }
    }
    if (process.env.HALLMARK_SCENARIOS === '1') {
      const scenarios = {
        '/codex': ['cli-installed', 'cli-loading', 'cli-sessions', 'cli-sessions-loading'],
        '/mcp': ['mcp-running', 'mcp-starting'],
        '/node': ['project-populated', 'project-loading'],
        '/podman': ['podman-empty', 'podman-stopped', 'podman-compose', 'podman-loading'],
        '/setup': ['plugins-loading', 'plugins-error', 'plugins-success', 'plugins-populated'],
        '/customer-module': ['custom-populated'],
        '/startup-group': ['groups-populated']
      }
      for (const [route, states] of Object.entries(scenarios)) {
        if (requested && !requested.includes(route)) continue
        await js(`window.hallmark.navigate(${JSON.stringify(route)})`)
        await settle()
        for (const state of states) {
          await js(`window.hallmark.scenario(${JSON.stringify(state)})`)
          await settle()
          for (const theme of ['light', 'dark']) {
            await js(`document.documentElement.className=${JSON.stringify(theme)}`)
            for (const width of [320, 1280]) {
              await resize(width)
              await js(`window.hallmark.store.asideExpanded=${width >= 960}`)
              await settle()
              report.states.push({ route, state, theme, ...(await measure()) })
              await snap(state + '-' + theme + '-' + width)
            }
          }
        }
        fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2))
      }
    }
  } catch (error) {
    report.errors.push(String(error))
    console.error(error)
    process.exitCode = 1
  } finally {
    fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2))
    const issues = [...report.routes, ...report.tabs, ...report.states].filter(
      (r) => r.errors?.length || r.clipped?.length || r.scroll > r.width || r.root === false
    )
    if (issues.length || report.errors.length) process.exitCode = 1
    console.log(
      JSON.stringify({
        platform,
        measurements: report.routes.length,
        tabs: report.tabs.length,
        states: report.states.length,
        issues: issues.length,
        errors: report.errors
      })
    )
    win.destroy()
    app.exit(process.exitCode || 0)
  }
})
