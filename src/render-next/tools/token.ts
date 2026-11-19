export function generateToken(length: number, alphabet: string, random: Pick<Crypto, 'getRandomValues'> = crypto): string {
  if (!Number.isInteger(length) || length < 1 || length > 512) throw new Error('Length must be an integer from 1 to 512.')
  const characters = [...new Set(Array.from(alphabet))]
  if (!characters.length) throw new Error('Select at least one character set or enter a custom alphabet.')
  if (characters.length > 65536) throw new Error('Use up to 65,536 unique alphabet characters.')
  const limit = Math.floor(0x100000000 / characters.length) * characters.length
  let value = ''
  for (let remaining = length; remaining > 0;) {
    const bytes = new Uint32Array(Math.max(16, remaining * 2))
    random.getRandomValues(bytes)
    for (const byte of bytes) {
      if (byte >= limit) continue
      value += characters[byte % characters.length]
      if (--remaining === 0) break
    }
  }
  return value
}
