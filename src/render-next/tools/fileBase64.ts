const MAX_FILE_BYTES = 20 * 1024 * 1024
export function validateBase64File(input: string): string {
  const raw = input.replace(/^data:[^,]*;base64,/i, '').replace(/\s/g, '')
  if (!raw || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}(?:==)?|[A-Za-z0-9+/]{3}=?|)?$/.test(raw)) throw new Error('Invalid Base64 file data.')
  if (Math.floor(raw.length * 3 / 4) - (raw.endsWith('==') ? 2 : raw.endsWith('=') ? 1 : 0) > MAX_FILE_BYTES) throw new Error('Use files up to 20 MB.')
  return raw
}
export function fileToDataUrl(file: File): Promise<string> {
  if (file.size > MAX_FILE_BYTES) return Promise.reject(new Error('Use files up to 20 MB.'))
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error('The selected file could not be read.'))
    reader.readAsDataURL(file)
  })
}
