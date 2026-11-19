// Providers exposed by the legacy version manager with an implemented brewinfo.
export const homebrewModules = [
  'apache', 'caddy', 'cliproxyapi', 'cloudflared', 'composer', 'consul', 'deno', 'dotnet',
  'erlang', 'etcd', 'frankenphp', 'golang', 'gradle', 'java', 'mailpit',
  'mariadb', 'maven', 'meilisearch', 'memcached', 'minio', 'mkcert', 'mongodb', 'mysql',
  'nginx', 'numa', 'perl', 'php', 'postgresql', 'pure-ftpd', 'python', 'rabbitmq',
  'redis', 'rnacos', 'ruby', 'rust', 'tomcat', 'typesense', 'zig'
] as const

export function supportsHomebrew(
  flag: string,
  platform: { isMacOS?: boolean; isLinux?: boolean }
) {
  return Boolean(
    (platform.isMacOS || platform.isLinux) && homebrewModules.some((module) => module === flag)
  )
}

export const homebrewTaps: Readonly<Partial<Record<string, string>>> = {
  php: 'shivammathur/php',
  mongodb: 'mongodb/brew',
  consul: 'hashicorp/tap',
  typesense: 'typesense/homebrew-tap'
}
