export const homebrewMirrors = {
  default: 'common.value.default',
  tsinghua: 'setup.tsinghua',
  bfsu: 'setup.bfsu',
  tencent: 'setup.tencent',
  aliyun: 'setup.aliyun',
  ustc: 'setup.ustc'
} as const

export type HomebrewMirror = keyof typeof homebrewMirrors

export function isHomebrewMirror(value: unknown): value is HomebrewMirror {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(homebrewMirrors, value)
}

const origins = new Map<string, HomebrewMirror>([
  ['https://github.com/homebrew/brew', 'default'],
  ['https://mirrors.tuna.tsinghua.edu.cn/git/homebrew/brew', 'tsinghua'],
  ['https://mirrors.bfsu.edu.cn/git/homebrew/brew', 'bfsu'],
  ['https://mirrors.cloud.tencent.com/homebrew/brew', 'tencent'],
  ['https://mirrors.aliyun.com/homebrew/brew', 'aliyun'],
  ['https://mirrors.ustc.edu.cn/brew', 'ustc']
])

export function identifyHomebrewMirror(origin: string): HomebrewMirror | 'custom' {
  const normalizedOrigin = origin
    .trim()
    .toLowerCase()
    .replace(/\/$/, '')
    .replace(/\.git$/, '')
  return origins.get(normalizedOrigin) ?? 'custom'
}
