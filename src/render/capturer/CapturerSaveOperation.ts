import type { CapturerEvent } from '../../shared/CapturerContract'

type Dependencies = {
  exportImage(): Promise<string>
  hide(): Promise<unknown>
  save(base64: string, useConfig: boolean): Promise<CapturerEvent>
}

// A save can outlive the visible overlay. Keep its export, hide and native
// request under one owner so a second click cannot export another image.
export class CapturerSaveOperation {
  busy = false
  error = ''
  private flight?: Promise<boolean>
  constructor(private deps: Dependencies, private observationMs = 120_000) {}
  save(useConfig: boolean): Promise<boolean> {
    if (this.flight) return this.flight
    this.busy = true
    this.error = ''
    const timer = setTimeout(() => {
      this.error = 'Screenshot save outcome is unknown. Check the capture status before retrying.'
    }, this.observationMs)
    this.flight = Promise.resolve().then(async () => {
      try {
        const image = await this.deps.exportImage()
        if (!image.startsWith('data:image/png;base64,')) throw new Error('The selected region could not be exported as PNG.')
        await this.deps.hide()
        const result = await this.deps.save(image.slice('data:image/png;base64,'.length), useConfig)
        if (result.status === 'failed') throw new Error(result.error || 'Screenshot save failed.')
        this.error = ''
        return result.status === 'saved'
      } catch (error) {
        this.error = error instanceof Error ? error.message : String(error)
        return false
      } finally {
        clearTimeout(timer)
        this.busy = false
        this.flight = undefined
      }
    })
    return this.flight
  }
}
