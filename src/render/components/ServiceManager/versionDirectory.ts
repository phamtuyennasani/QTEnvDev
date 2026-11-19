import { reactive } from 'vue'
import localForage from 'localforage'

type Version = { bin: string; version: string }

export function createVersionDirectory(
  key: string,
  defaultPath: (base: string, version: Version) => string
) {
  const state = reactive({ saved: {} as Record<string, string>, loaded: false })
  let reading: Promise<void> | undefined
  let writing: Promise<void> | undefined

  async function load() {
    if (state.loaded) return
    reading ??= localForage
      .getItem<Record<string, string>>(key)
      .then((value) => {
        state.saved = value ?? {}
        state.loaded = true
      })
      .finally(() => {
        reading = undefined
      })
    await reading
  }

  function path(version: Version) {
    const base = window.Server?.BaseDir
    return state.saved[version.bin] || (base ? defaultPath(base, version) : '')
  }

  async function resolve(version: Version) {
    await load()
    await writing?.catch(() => {})
    return path(version)
  }

  async function setDirectory(bin: string, path: string, admit = () => true) {
    await load()
    if (!admit()) throw new Error('The selected version or service state changed. Choose again.')
    if (writing) throw new Error('A directory change is already being saved.')
    const snapshot = { ...state.saved, [bin]: path }
    writing = localForage
      .setItem(key, snapshot)
      .then(() => {
        state.saved = snapshot
      })
      .finally(() => {
        writing = undefined
      })
    await writing
  }

  return { state, load, path, resolve, setDirectory }
}
