/* eslint-disable @typescript-eslint/no-require-imports -- Electron runs this isolated renderer regression as CommonJS. */
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { app, BrowserWindow } = require('electron')

const out = path.resolve('tmp/hallmark/audit', process.env.HALLMARK_RUN || 'editor-lifecycle')
fs.mkdirSync(out, { recursive: true })
app.setPath('userData', fs.mkdtempSync(path.join(os.tmpdir(), 'qtenvdev-editor-test-')))
app.commandLine.appendSwitch('disable-backgrounding-occluded-windows')
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

app.whenReady().then(async () => {
  const report = { platform: process.platform, cases: [], rendererErrors: [], errors: [] }
  const win = new BrowserWindow({
    show: false,
    width: 1200,
    height: 800,
    webPreferences: { offscreen: true, backgroundThrottling: false }
  })
  const js = (source) => win.webContents.executeJavaScript(source, true)
  const waitFor = async (source) => {
    const end = Date.now() + 90000
    while (!(await js(source))) {
      if (Date.now() > end) throw new Error('Timed out: ' + source)
      await sleep(50)
    }
  }
  const check = async (name, source, expectedError) => {
    await js(`(async () => {
      const { EditorCreate, EditorDestroy } = await import('/util/Editor.ts');
      const root = document.createElement('div');
      root.style.cssText = 'position:fixed;inset:80px 80px 80px 240px;z-index:9999;display:grid;grid-template-columns:1fr 1fr';
      document.body.append(root);
      const first = document.createElement('div'), second = document.createElement('div');
      root.append(first, second);
      const options = {value:'first = value\\nsecond = value', language:'ini', automaticLayout:true};
      window.editorLifecycle = {EditorCreate, EditorDestroy, root, first, second, options};
    })()`)
    const errorStart = await js('window.hallmark.errors.length')
    try {
      const result = await js(source)
      await sleep(150)
      const errors = await js(`window.hallmark.errors.slice(${errorStart})`)
      if (expectedError) {
        assert.ok(errors.length > 0, name + ' must report the injected failure')
        assert.ok(
          errors.every((error) => error.includes(expectedError)),
          name + ' must report only the original injected failure'
        )
      } else {
        assert.deepEqual(errors, [], name + ' must not raise renderer errors')
      }
      assert.equal(result.pass, true, name + ': ' + JSON.stringify(result))
      report.cases.push({ name, ...result, errors, expectedError })
    } catch (error) {
      report.cases.push({
        name,
        pass: false,
        error: String(error),
        errors: await js(`window.hallmark.errors.slice(${errorStart})`)
      })
      process.exitCode = 1
    } finally {
      await js(`(async () => {
        const {editor} = await import('/@fs/' + ${JSON.stringify(path.resolve('node_modules/monaco-editor/esm/vs/editor/editor.api.js'))});
        const root = window.editorLifecycle.root;
        for (const instance of editor.getEditors()) {
          if (root.contains(instance.getDomNode())) instance.dispose();
        }
        root.remove();
      })()`)
      await sleep(100)
    }
  }
  try {
    await win.loadURL('http://127.0.0.1:5201/hallmark-preview?platform=macos')
    await waitFor('!!window.hallmark')
    win.webContents.debugger.attach('1.3')
    await win.webContents.debugger.sendCommand('Emulation.setFocusEmulationEnabled', {
      enabled: true
    })
    win.webContents.focus()
    await check(
      'destroy without instance preserves live models',
      `(() => {
      const f = window.editorLifecycle;
      const a = f.EditorCreate(f.first, f.options), model = a.getModel();
      f.EditorDestroy();
      const pass = !model.isDisposed() && a.getModel() === model;
      f.EditorDestroy(a);
      return {pass};
    })()`
    )
    await check(
      'destroy one editor preserves its sibling',
      `(() => {
      const f = window.editorLifecycle;
      const a = f.EditorCreate(f.first, f.options), b = f.EditorCreate(f.second, f.options);
      const firstModel = a.getModel(), siblingModel = b.getModel();
      f.EditorDestroy(a);
      let editable = false;
      if (!siblingModel.isDisposed()) { b.setValue('sibling still editable'); editable = b.getValue() === 'sibling still editable'; }
      const result = {pass:firstModel.isDisposed() && !siblingModel.isDisposed() && editable, firstDisposed:firstModel.isDisposed(), siblingDisposed:siblingModel.isDisposed(), editable};
      f.EditorDestroy(b);
      return result;
    })()`
    )
    await check(
      'same DOM creates a fresh editor after disposal',
      `(() => {
      const f = window.editorLifecycle;
      const a = f.EditorCreate(f.first, f.options);
      f.EditorDestroy(a);
      f.EditorDestroy(a);
      const b = f.EditorCreate(f.first, {...f.options, value:'fresh model'});
      const result = {pass:b !== a && b.getValue() === 'fresh model' && !b.getModel().isDisposed()};
      f.EditorDestroy(b);
      return result;
    })()`
    )
    await check(
      'borrowed model remains owned by its original editor',
      `(() => {
      const f = window.editorLifecycle;
      const owner = f.EditorCreate(f.first, f.options), model = owner.getModel();
      const borrower = f.EditorCreate(f.second, {model});
      f.EditorDestroy(borrower);
      const preservedWhileBorrowerClosed = !model.isDisposed() && owner.getModel() === model;
      f.EditorDestroy(owner);
      return {pass:preservedWhileBorrowerClosed && model.isDisposed(), disposedAfterOwnerClose:model.isDisposed()};
    })()`
    )
    await check(
      'direct dispose clears DOM cache',
      `(() => {
      const f = window.editorLifecycle;
      const a = f.EditorCreate(f.first, f.options);
      a.dispose();
      const b = f.EditorCreate(f.first, {...f.options, value:'direct disposal recreated'});
      const pass = b !== a && b.getValue() === 'direct disposal recreated';
      f.EditorDestroy(b);
      return {pass};
    })()`
    )
    await check(
      'pending word highlight cancels safely on immediate close',
      `(async () => {
      const f = window.editorLifecycle;
      const results = [];
      for (let index = 0; index < 8; index++) {
        const instance = f.EditorCreate(f.first, f.options);
        await new Promise(resolve => setTimeout(resolve, 150));
        instance.focus();
        instance.setPosition({lineNumber:1, column:3});
        results.push({focused:instance.hasTextFocus(), highlighter:!!instance.getContribution('editor.contrib.wordHighlighter')});
        f.EditorDestroy(instance);
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      return {pass:results.every(item => item.focused && item.highlighter), results};
    })()`
    )
    await check(
      'Settings UI to Hosts repeated navigation',
      `(async () => {
      const transitions = [];
      for (let index = 0; index < 6; index++) {
        await window.hallmark.navigate('/setup');
        document.querySelectorAll('.app-settings-nav button')[2].click();
        const deadline = Date.now() + 5000;
        while (!document.querySelector('.editor-config .monaco-editor')) {
          if (Date.now() > deadline) throw new Error('Settings preview editor did not mount');
          await new Promise(resolve => setTimeout(resolve, 20));
        }
        await new Promise(resolve => setTimeout(resolve, 150));
        document.querySelector('.editor-config .monaco-editor textarea')?.focus();
        const focused = document.activeElement?.closest('.editor-config .monaco-editor');
        await window.hallmark.navigate('/hosts');
        await new Promise(resolve => setTimeout(resolve, 150));
        transitions.push(!!focused && location.hash === '#/hosts' && !document.querySelector('.editor-config .monaco-editor'));
      }
      return {pass:transitions.every(Boolean), transitions};
    })()`
    )
    await check(
      'unexpected highlight failure still reaches the renderer error handler',
      `(async () => {
      const f = window.editorLifecycle;
      const instance = f.EditorCreate(f.first, f.options);
      await new Promise(resolve => setTimeout(resolve, 150));
      const highlighter = instance.getContribution('editor.contrib.wordHighlighter')?.wordHighlighter;
      if (!highlighter) throw new Error('Word highlighter was not created');
      highlighter._onPositionChanged = () => {throw new Error('QTEnvDev injected WordHighlighter failure')};
      instance.focus();
      instance.setPosition({lineNumber:1, column:3});
      await new Promise(resolve => setTimeout(resolve, 150));
      f.EditorDestroy(instance);
      return {pass:true, injected:true};
    })()`,
      'QTEnvDev injected WordHighlighter failure'
    )
    report.rendererErrors = [
      ...new Set([
        ...report.cases.flatMap((item) => item.errors),
        ...(await js('[...window.hallmark.errors]'))
      ])
    ]
    const expectedErrors = report.cases
      .filter((item) => item.pass && item.expectedError)
      .flatMap((item) => item.errors)
    report.unexpectedRendererErrors = report.rendererErrors.filter(
      (error) => !expectedErrors.includes(error)
    )
    if (report.unexpectedRendererErrors.length) process.exitCode = 1
  } catch (error) {
    report.errors.push(String(error))
    process.exitCode = 1
  } finally {
    fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2))
    console.log(JSON.stringify(report))
    win.destroy()
    app.exit(process.exitCode || 0)
  }
})
