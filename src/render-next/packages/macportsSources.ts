// Modules with a fork-side `portinfo` implementation.
export const macportsModules = [
  'apache',
  'caddy',
  'consul',
  'deno',
  'elasticsearch',
  'erlang',
  'java',
  'maven',
  'memcached',
  'mariadb',
  'mysql',
  'mongodb',
  'nginx',
  'php',
  'perl',
  'postgresql',
  'pure-ftpd',
  'python',
  'rabbitmq',
  'redis',
  'ruby',
  'zig',
  'golang',
  'gradle'
] as const

export function supportsMacPorts(flag: string, platform: { isMacOS?: boolean }) {
  return Boolean(platform.isMacOS && macportsModules.some((item) => item === flag))
}
