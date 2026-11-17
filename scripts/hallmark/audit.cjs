/* eslint-disable @typescript-eslint/no-require-imports -- Electron launches this isolated audit as a CommonJS entry. */
// Renderer visual coverage only; native-platform smoke tests cover real IPC.
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
  const report = {
    platform,
    routes: [],
    states: [],
    tabs: [],
    overlays: [],
    keyboard: [],
    contrast: [],
    errors: []
  }
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
  const resize = async (width, height = width <= 800 ? 600 : 800) => {
    win.setContentSize(width, height)
    await waitFor(`innerWidth === ${width} && innerHeight === ${height}`)
    await settle()
  }
  const snap = async (name) => {
    await settle()
    const captured = await win.webContents.capturePage()
    const width = await js('innerWidth')
    const screenshot = captured.getSize().width === width ? captured : captured.resize({ width })
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
    return {current:location.hash,width:innerWidth,height:innerHeight,scroll:document.documentElement.scrollWidth,root:!!root,text:root?.innerText.slice(0,700),clipped,errors:[...window.hallmark.errors]};
  })()`)
  try {
    await win.loadURL('http://127.0.0.1:5201/hallmark-preview?platform=' + platform)
    await waitFor('!!window.hallmark', 90000)
    win.webContents.debugger.attach('1.3')
    await win.webContents.debugger.sendCommand('Emulation.setFocusEmulationEnabled', {
      enabled: true
    })
    win.webContents.focus()
    await settle()
    const all = await js('["/setup","/customer-module",...window.hallmark.routes.map(r=>r.route)]')
    const requested = process.env.HALLMARK_ROUTES?.split(',')
    const routes = requested || all
    const widths = (process.env.HALLMARK_WIDTHS || '320,375,414,768,960,1280,1440')
      .split(',')
      .map(Number)
    const sizes = process.env.HALLMARK_SIZES
      ? process.env.HALLMARK_SIZES.split(',').map((size) => {
          const match = /^(\d+)x(\d+)$/.exec(size.trim())
          assert.ok(match, 'Invalid viewport size: ' + size)
          const width = Number(match[1])
          const height = Number(match[2])
          assert.ok(width > 0 && height > 0, 'Viewport dimensions must be positive')
          return { width, height, label: `${width}x${height}` }
        })
      : widths.map((width) => ({
          width,
          height: width <= 800 ? 600 : 800,
          label: String(width)
        }))
    report.viewports = sizes.map(({ width, height }) => ({ width, height }))
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
        await js(`window.hallmark.setTheme(${JSON.stringify(theme)})`)
        for (const { width, height, label } of sizes) {
          await resize(width, height)
          await js(`window.hallmark.store.asideExpanded=${width >= 960}`)
          await settle()
          const measurement = await measure()
          report.routes.push({ route, theme, ...measurement })
          await snap(route.slice(1) + '-' + theme + '-' + label)
        }
      }
      if (process.env.HALLMARK_TABS === '1') {
        await resize(1280)
        await js("window.hallmark.setTheme('light')")
        const tabCount = await js(
          "document.querySelectorAll('.app-workbench-page > .el-radio-group .el-radio-button,.app-settings-nav button').length"
        )
        for (let i = 0; i < tabCount; i++) {
          await js(
            `window.hallmark.errors.length=0; document.querySelectorAll('.app-workbench-page > .el-radio-group .el-radio-button,.app-settings-nav button')[${i}].click()`
          )
          await settle()
          for (const theme of ['light', 'dark']) {
            await js(`window.hallmark.setTheme(${JSON.stringify(theme)})`)
            for (const { width, height, label } of sizes) {
              await resize(width, height)
              await js(`window.hallmark.store.asideExpanded=${width >= 960}`)
              await settle()
              report.tabs.push({ route, tab: i, theme, ...(await measure()) })
              await snap(route.slice(1) + '-tab-' + i + '-' + theme + '-' + label)
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
          await js(`window.hallmark.setTheme(${JSON.stringify(theme)})`)
          await settle()
          report.states.push({ state, theme, ...(await measure()) })
          await snap('service-' + state + '-' + theme)
        }
      }
    }
    if (process.env.HALLMARK_SCENARIOS === '1') {
      const scenarios = {
        '/node': ['project-populated', 'project-loading'],
        '/php': ['project-php-populated'],
        '/hosts': ['hosts-populated'],
        '/podman': [
          'podman-empty',
          'podman-stopped',
          'podman-compose',
          'podman-loading',
          'podman-containers'
        ],
        '/customer-module': ['custom-populated'],
        '/startup-group': ['groups-populated'],
        '/tools': ['json-populated', 'json-invalid']
      }
      for (const [route, states] of Object.entries(scenarios)) {
        if (requested && !requested.includes(route)) continue
        await js(`window.hallmark.navigate(${JSON.stringify(route)})`)
        await settle()
        for (const state of states) {
          await js(`window.hallmark.scenario(${JSON.stringify(state)})`)
          await settle()
          if (state === 'hosts-populated') {
            assert.ok(
              await js("document.querySelector('.host-list')?.innerText.includes('qtenvdev.test')"),
              'Hosts populated fixture must render a site row before capture'
            )
          }
          for (const theme of ['light', 'dark']) {
            await js(`window.hallmark.setTheme(${JSON.stringify(theme)})`)
            for (const { width, height, label } of sizes) {
              await resize(width, height)
              await js(`window.hallmark.store.asideExpanded=${width >= 960}`)
              await settle()
              report.states.push({ route, state, theme, ...(await measure()) })
              await snap(state + '-' + theme + '-' + label)
            }
          }
        }
        fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2))
      }
    }
    if (process.env.HALLMARK_DEEP === '1') {
      const key = async (keyCode, modifiers = []) => {
        win.webContents.sendInputEvent({ type: 'keyDown', keyCode, modifiers })
        win.webContents.sendInputEvent({ type: 'keyUp', keyCode, modifiers })
        await sleep(30)
      }
      for (const route of routes) {
        await js(`window.hallmark.navigate(${JSON.stringify(route)})`)
        await resize(1200)
        await js('window.hallmark.store.asideExpanded=true; document.activeElement?.blur()')
        await settle()
        const steps = []
        for (let index = 0; index < 24; index++) {
          await key('Tab')
          steps.push(
            await js(`(() => {
            const e = document.activeElement, s = getComputedStyle(e), r = e.getBoundingClientRect();
            return {tag:e.tagName, name:(e.getAttribute('aria-label')||e.innerText||e.getAttribute('placeholder')||'').slice(0,100), focusVisible:e.matches(':focus-visible'), documentFocused:document.hasFocus(), outline:s.outlineStyle, outlineWidth:s.outlineWidth, offscreen:r.right>innerWidth+2||r.left<0};
          })()`)
          )
        }
        report.keyboard.push({ route, steps })
      }
      const overlays = process.env.HALLMARK_OVERLAYS?.split(',') || [
        'host-edit',
        'podman-machine',
        'podman-container',
        'php-extensions',
        'php-config'
      ]
      for (const name of overlays) {
        await js(
          `window.hallmark.navigate(${JSON.stringify(name.startsWith('php-') ? '/php' : name.startsWith('podman-') ? '/podman' : '/hosts')})`
        )
        await js('document.querySelector(".app-nav-collapse")?.focus()')
        for (const { width, height, label } of sizes) {
          await resize(width, height)
          for (const theme of ['light', 'dark']) {
            await js(
              `window.hallmark.setTheme(${JSON.stringify(theme)}); window.hallmark.openOverlay(${JSON.stringify(name)})`
            )
            await waitFor(
              '!!document.querySelector(".app-workbench-dialog, .app-workbench-drawer")?.getBoundingClientRect().width'
            )
            await sleep(450)
            await settle()
            const measurement = await js(`(() => {
              const e=document.querySelector('.app-workbench-dialog, .app-workbench-drawer'), r=e.getBoundingClientRect();
              const visible=c=>{const q=c.getBoundingClientRect();return q.width&&q.height&&q.bottom>r.top&&q.top<r.bottom&&getComputedStyle(c).visibility!=='hidden'};
              return {width:innerWidth,height:innerHeight,dialogWidth:r.width,scroll:document.documentElement.scrollWidth,errors:[...window.hallmark.errors],clipped:[...e.querySelectorAll('button,input,select')].filter(visible).filter(c=>{const q=c.getBoundingClientRect();return q.right>innerWidth+2||q.left<0}).map(c=>c.getAttribute('aria-label')||c.tagName),focusedInside:e.contains(document.activeElement)};
            })()`)
            await snap(name + '-' + theme + '-' + label)
            const focusSteps = []
            const focusOutside = []
            const focusTrace = []
            for (let index = 0; index < 30; index++) {
              await key('Tab')
              focusTrace.push(
                await js(
                  'document.activeElement?.tagName + "." + document.activeElement?.className'
                )
              )
              focusSteps.push(
                await js(
                  'document.querySelector(".app-workbench-dialog, .app-workbench-drawer")?.contains(document.activeElement)'
                )
              )
              if (!focusSteps.at(-1)) {
                focusOutside.push(
                  await js(
                    '({tag:document.activeElement?.tagName, className:document.activeElement?.className, name:document.activeElement?.getAttribute("aria-label"), html:document.activeElement?.outerHTML?.slice(0,240)})'
                  )
                )
              }
            }
            measurement.focusTrap = focusSteps.every(Boolean)
            measurement.focusOutside = focusOutside
            measurement.focusTrace = focusTrace
            report.overlays.push(measurement)
            Object.assign(measurement, { name, theme })
            await key('Escape')
            await sleep(450)
            await settle()
            measurement.escapeClosed = await js(
              '!document.querySelector(".app-workbench-dialog, .app-workbench-drawer")?.getClientRects().length'
            )
            await js('window.hallmark.closeOverlay()')
            await settle()
          }
        }
      }
      for (const theme of ['light', 'dark']) {
        await js(`window.hallmark.setTheme(${JSON.stringify(theme)})`)
        report.contrast.push(
          await js(`(() => {
          const cs=getComputedStyle(document.documentElement), canvas=document.createElement('canvas'),ctx=canvas.getContext('2d');
          const rgb=token=>{ctx.clearRect(0,0,1,1);ctx.fillStyle=cs.getPropertyValue('--color-'+token).trim();ctx.fillRect(0,0,1,1);return [...ctx.getImageData(0,0,1,1).data].slice(0,3)};
          const lum=a=>a.map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4}).reduce((s,v,i)=>s+v*[.2126,.7152,.0722][i],0);
          const ratio=(a,b)=>{a=lum(rgb(a));b=lum(rgb(b));return (Math.max(a,b)+.05)/(Math.min(a,b)+.05)};
          const pairs=[];for(const bg of ['canvas','surface','surface-muted','surface-hover'])for(const fg of ['ink','ink-muted','ink-faint','accent','success','warning','danger','focus','rule-strong'])pairs.push({fg,bg,ratio:Math.round(ratio(fg,bg)*100)/100,min:['focus','rule-strong'].includes(fg)?3:4.5});
          pairs.push({fg:'accent-ink',bg:'accent',ratio:Math.round(ratio('accent-ink','accent')*100)/100,min:4.5});
          return {theme:document.documentElement.className,pairs};
        })()`)
        )
      }
    }
  } catch (error) {
    report.errors.push(String(error))
    console.error(error)
    process.exitCode = 1
  } finally {
    fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2))
    const issues = [...report.routes, ...report.tabs, ...report.states, ...report.overlays].filter(
      (r) =>
        r.errors?.length ||
        r.clipped?.length ||
        r.scroll > r.width ||
        r.root === false ||
        r.focusTrap === false ||
        r.escapeClosed === false
    )
    const contrastFailures = report.contrast.flatMap((r) =>
      r.pairs.filter((pair) => pair.ratio < pair.min).map((pair) => ({ theme: r.theme, ...pair }))
    )
    if (issues.length || contrastFailures.length || report.errors.length) process.exitCode = 1
    console.log(
      JSON.stringify({
        platform,
        measurements: report.routes.length,
        tabs: report.tabs.length,
        states: report.states.length,
        overlays: report.overlays.length,
        issues: issues.length,
        contrastFailures: contrastFailures.length,
        errors: report.errors
      })
    )
    win.destroy()
    app.exit(process.exitCode || 0)
  }
})
