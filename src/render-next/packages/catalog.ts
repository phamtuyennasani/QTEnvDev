export type PackageModule = { flag: string; label: string; group: 'Runtimes' | 'Services' | 'Databases' | 'Utilities'; catalog?: 'node' | 'static' }

// Backend capabilities, not guessed IPC flags. Node has its own version-manager protocol.
export const packageModules: PackageModule[] = [
  ...[
    ['php', 'PHP'], ['node', 'Node.js'], ['python', 'Python'], ['golang', 'Go'],
    ['java', 'Java'], ['ruby', 'Ruby'], ['rust', 'Rust'], ['bun', 'Bun'], ['deno', 'Deno'],
    ['dotnet', '.NET'], ['erlang', 'Erlang'], ['perl', 'Perl'], ['zig', 'Zig'],
    ['flutter', 'Flutter'], ['gradle', 'Gradle'], ['swoole-cli', 'Swoole CLI']
  ].map(([flag, label]) => ({ flag, label, group: 'Runtimes' as const, catalog: flag === 'node' ? 'node' as const : 'static' as const })),
  ...[
    ['apache', 'Apache'], ['nginx', 'Nginx'], ['caddy', 'Caddy'], ['tomcat', 'Tomcat'], ['pure-ftpd', 'Pure-FTPd'], ['ftp-srv', 'FTP Server'],
    ['memcached', 'Memcached'], ['rabbitmq', 'RabbitMQ'], ['mailpit', 'Mailpit'], ['minio', 'Minio'],
    ['typesense', 'Typesense'], ['meilisearch', 'Meilisearch'], ['zincsearch', 'ZincSearch'],
    ['etcd', 'ETCD'], ['consul', 'Consul'], ['cloudflared', 'Cloudflared'], ['roadrunner', 'RoadRunner'],
    ['frankenphp', 'FrankenPHP'], ['n8n', 'N8N'], ['rustfs', 'RustFS'], ['rnacos', 'RNacos'], ['cloudflare-tunnel', 'Cloudflare Tunnel'],
    ['numa', 'Numa'], ['temporal', 'Temporal']
  ].map(([flag, label]) => ({ flag, label, group: 'Services' as const, catalog: 'static' as const })),
  ...[
    ['mysql', 'MySQL'], ['mariadb', 'MariaDB'], ['postgresql', 'PostgreSQL'], ['redis', 'Redis'],
    ['mongodb', 'MongoDB'], ['clickhouse', 'ClickHouse'], ['neo4j', 'Neo4j'],
    ['elasticsearch', 'Elasticsearch'], ['qdrant', 'Qdrant']
  ].map(([flag, label]) => ({ flag, label, group: 'Databases' as const, catalog: 'static' as const })),
  ...[
    ['git', 'Git'], ['mkcert', 'mkcert'], ['cliproxyapi', 'CLIProxyAPI'], ['temporal-cli', 'Temporal CLI'],
    ['composer', 'Composer'], ['maven', 'Maven']
  ].map(([flag, label]) => ({ flag, label, group: 'Utilities' as const, catalog: 'static' as const })),
  { flag: 'podman', label: 'Podman', group: 'Services' }
]

export function packageModule(flag: string) {
  const item = packageModules.find((item) => item.flag === flag)
  if (!item) throw new Error(`No package provider is registered for ${flag}`)
  return item
}

export const packageFlagForName = (name: string) => packageModules.find((item) => item.label === name)?.flag
