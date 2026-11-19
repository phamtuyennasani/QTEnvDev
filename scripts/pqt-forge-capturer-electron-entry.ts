import assert from 'node:assert/strict'
import { app, clipboard, desktopCapturer, dialog, globalShortcut, nativeImage, screen, shell } from 'electron'
import { windowManager } from '@xpf0000/node-window-manager'
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Capturer } from '../src/main/core/Capturer'
import type { CapturerEvent } from '../src/shared/CapturerContract'

const evidence = process.env.PQT_CAPTURER_EVIDENCE!
app.setPath('userData', join(evidence, 'electron-user-data'))
app.commandLine.appendSwitch('no-first-run')
app.on('window-all-closed', () => {})
const controllers: Capturer[] = []
const config = { dir: '', name: 'shot-{index}', key: [] as string[] }
const make = (id: string, dir: string) => {
  const controller = new Capturer()
  controllers.push(controller)
  controller.configUpdate({ ...config, dir })
  // Exercise the real native PNG validation/filesystem path without opening an
  // interactive overlay or a Save As dialog on the user's desktop.
  Object.assign(controller, { captureState: { id, status: 'opened' }, captureConfig: { ...config, dir } })
  return controller
}
const exists = async (path: string) => { try { await readFile(path); return true } catch { return false } }

async function main() {
  await app.whenReady()
  const temp = await mkdtemp(join(tmpdir(), 'qtenvdev-capturer-test-'))
  const originalClipboardWrite = clipboard.writeImage
  const originalReveal = shell.showItemInFolder
  const originalDialog = dialog.showSaveDialog
  const originalErrorBox = dialog.showErrorBox
  const originalRegister = globalShortcut.register
  const originalUnregister = globalShortcut.unregister
  const events: CapturerEvent[] = []
  try {
    // No captured desktop pixels are persisted. Preserve the user's clipboard
    // and avoid opening Explorer while testing supplementary failure outcomes.
    clipboard.writeImage = () => { throw new Error('fixture clipboard unavailable') }
    shell.showItemInFolder = () => { throw new Error('fixture reveal unavailable') }
    dialog.showErrorBox = () => {}
    const image = nativeImage.createFromBitmap(Buffer.from([255, 0, 0, 255, 0, 255, 0, 255, 0, 0, 255, 255, 255, 255, 255, 255]), { width: 2, height: 2 })
    const png = image.toPNG()
    const payload = png.toString('base64')
    const controller = make('save', temp)
    controller.setCallback((event) => events.push(event))
    const first = controller.saveImage(payload, true)
    assert.equal(controller.saveImage('not another request', true), first)
    const saved = await first
    assert.equal(saved.status, 'saved')
    assert.deepEqual(await readFile(saved.path!), png)
    assert.deepEqual(nativeImage.createFromPath(saved.path!).getSize(), { width: 2, height: 2 })
    assert.match(saved.warning!, /Clipboard copy failed/)
    assert.match(saved.warning!, /Reveal file failed/)
    assert.deepEqual(events.map((event) => event.status), ['saving', 'saved'])

    const notificationFailure = make('notification-failure', temp)
    notificationFailure.setCallback(() => { throw new Error('fixture renderer disconnected') })
    const stillSaved = await notificationFailure.saveImage(payload, true)
    assert.equal(stillSaved.status, 'saved', 'A disconnected status observer must not invalidate a completed write')
    assert.deepEqual(await readFile(stillSaved.path!), png)

    const badDirectory = join(temp, 'not-a-directory')
    await writeFile(badDirectory, 'existing file')
    const failedWrite = make('write-failure', badDirectory)
    await assert.rejects(failedWrite.saveImage(payload, true))
    assert.equal(failedWrite.status().status, 'failed')
    assert.equal(await readFile(badDirectory, 'utf8'), 'existing file')

    const collision = make('collision', temp)
    Object.assign(collision, { captureConfig: { ...config, dir: temp, name: 'fixed' } })
    await writeFile(join(temp, 'fixed.png'), 'existing')
    await assert.rejects(collision.saveImage(payload, true), /already exists/)
    assert.equal(await readFile(join(temp, 'fixed.png'), 'utf8'), 'existing')
    assert.equal(collision.status().status, 'failed')

    const invalid = make('invalid', temp)
    await assert.rejects(invalid.saveImage(Buffer.alloc(30).toString('base64'), true), /must be a PNG/)
    assert.equal(invalid.status().status, 'failed')

    let resolveDialog!: (value: Electron.SaveDialogReturnValue) => void
    dialog.showSaveDialog = (() => new Promise<Electron.SaveDialogReturnValue>((resolve) => { resolveDialog = resolve })) as typeof dialog.showSaveDialog
    const pending = make('cancel-dialog', temp)
    const pendingSave = pending.saveImage(payload)
    assert.equal(pending.status().status, 'saving')
    pending.stopCapturer()
    await assert.rejects(pending.initWatchPointWindow('replacement'), /already active/)
    const cancelledPath = join(temp, 'cancelled.png')
    resolveDialog({ canceled: false, filePath: cancelledPath })
    assert.equal((await pendingSave).status, 'cancelled')
    assert.equal(await exists(cancelledPath), false)

    const stale = make('old', temp)
    const staleSave = stale.saveImage(payload)
    Object.assign(stale, { captureState: { id: 'new', status: 'opened' } })
    const stalePath = join(temp, 'stale.png')
    resolveDialog({ canceled: false, filePath: stalePath })
    assert.deepEqual(await staleSave, { id: 'new', status: 'opened' })
    assert.equal(await exists(stalePath), false)

    const registered = new Set<string>()
    globalShortcut.register = ((accelerator: string) => { if (accelerator === 'Control+Shift+Y') return false; registered.add(accelerator); return true }) as typeof globalShortcut.register
    globalShortcut.unregister = (accelerator: string) => { registered.delete(accelerator) }
    const shortcut = make('shortcut', temp)
    assert.throws(() => shortcut.configUpdate({ ...config, dir: temp, key: ['Escape'] }), /reserved/)
    shortcut.configUpdate({ ...config, dir: temp, key: ['Control', 'Shift', 'X'] })
    assert.throws(() => shortcut.configUpdate({ ...config, dir: temp, key: ['Control', 'Shift', 'Y'] }), /could not be registered/)
    assert.equal(registered.has('Control+Shift+X'), true)
    assert.deepEqual(shortcut.config.key, ['Control', 'Shift', 'X'])
    shortcut.configUpdate({ ...config, dir: temp, key: [] })
    assert.equal(registered.size, 0)

    const failedWindow = make('load-failure', temp)
    let destroyed = false
    const windowStub = { isDestroyed: () => destroyed, destroy: () => { destroyed = true } }
    failedWindow.timer = setInterval(() => {}, 1000)
    Object.assign(failedWindow, { window: windowStub })
    ;(failedWindow as any).handleWindowLoadError(windowStub, 'load-failure', new Error('fixture window load failed'))
    assert.equal(failedWindow.status().status, 'failed')
    assert.equal(failedWindow.timer, undefined)
    assert.equal(destroyed, true)

    const desktop: Record<string, unknown> = { primary: screen.getPrimaryDisplay().size }
    if (process.platform === 'win32') {
      const value = windowManager.captureWindow(windowManager.getDesktopWindowID())
      const captured = typeof value === 'string' ? nativeImage.createFromBuffer(Buffer.from(value, 'base64')) : nativeImage.createEmpty()
      desktop.nodeWindowManager = { decoded: !captured.isEmpty(), size: captured.getSize() }
    }
    const sources = await desktopCapturer.getSources({ types: ['screen'], thumbnailSize: { width: 64, height: 64 } })
    desktop.electron = sources.map((source) => ({ displayId: source.display_id, decoded: !source.thumbnail.isEmpty(), size: source.thumbnail.getSize() }))
    assert.ok(sources.some((source) => !source.thumbnail.isEmpty()), 'The actual desktop API must produce an image')
    await writeFile(join(evidence, 'result.json'), JSON.stringify({ success: true, tests: ['native PNG decode and exact file bytes', 'duplicate save identity', 'supplementary failures preserve success', 'disconnected status observer preserves write', 'required filesystem failure propagates', 'collision refuses overwrite', 'invalid PNG rejected', 'cancel pending dialog blocks reopen and write', 'stale save cannot affect new session', 'shortcut failure retains previous config', 'Escape reserved for cancellation'], events, desktop, tempFiles: await readdir(temp), limitations: ['Native Save As responses and clipboard/reveal failure cases use controlled adapters.', 'Interactive overlay selection, annotations and actual Save As acceptance were not exercised.'] }, null, 2))
  } finally {
    clipboard.writeImage = originalClipboardWrite
    shell.showItemInFolder = originalReveal
    dialog.showSaveDialog = originalDialog
    dialog.showErrorBox = originalErrorBox
    globalShortcut.register = originalRegister
    globalShortcut.unregister = originalUnregister
    for (const controller of controllers) { clearTimeout(controller.destroyTimer); clearInterval(controller.timer) }
    await rm(temp, { recursive: true, force: true })
  }
}
main().then(() => { console.log('CAPTURER_ELECTRON_PASS'); app.exit(0) }).catch(async (error) => { console.error(error); await writeFile(join(evidence, 'failure.txt'), String(error?.stack || error)); app.exit(1) })
