import { readConfigValue, unquoteConfigValue } from '@shared/ServiceWebAddress'
import YAML from 'yamljs'

type Address = { port: unknown; host?: string; protocol?: string; path?: string }
type Policy = {
  label: string
  file?: string | ((version: string) => string)
  address: (contents: string) => Address
}

function localPort(port: unknown, path?: string): Address {
  return { port, path }
}

function listenAddress(value: string, fallbackPort: number, useHost = false): Address {
  if (!value) return localPort(fallbackPort)
  const match = /^(?:(\[[\da-f:.]+\]|[^:\s]+)?:)?(\d+)$/i.exec(value)
  if (!match) throw new Error('Invalid dashboard listen address.')
  return { host: useHost ? match[1] : undefined, port: match[2] }
}

function installedVersion(version: string) {
  if (!/^\d[\w.+-]*$/.test(version)) throw new Error('Invalid installed version.')
  return version
}

const dashboardPolicies = {
  consul: {
    label: 'Open Consul UI',
    file: (version) => 'consul/consul-' + installedVersion(version).split('.')[0] + '.json',
    address: (contents) =>
      localPort((contents ? JSON.parse(contents).ports?.http : undefined) ?? 8500, '/ui/')
  },
  minio: {
    label: 'Open Minio console',
    file: 'minio/minio.conf',
    address: (contents) =>
      listenAddress(readConfigValue(contents, 'MINIO_CONSOLE_ADDRESS'), 9001, true)
  },
  rustfs: {
    label: 'Open RustFS console',
    file: 'rustfs/rustfs.conf',
    address: (contents) => listenAddress(readConfigValue(contents, 'RUSTFS_CONSOLE_ADDRESS'), 9001)
  },
  meilisearch: {
    label: 'Open Meilisearch',
    file: 'meilisearch/meilisearch.toml',
    address: (contents) => listenAddress(readConfigValue(contents, 'http_addr'), 7700)
  },
  mailpit: {
    label: 'Open Mailpit',
    file: 'mailpit/mailpit.conf',
    address: (contents) => listenAddress(readConfigValue(contents, 'MP_UI_BIND_ADDR'), 8025)
  },
  n8n: {
    label: 'Open N8N dashboard',
    file: 'n8n/n8n.env',
    address: (contents) => ({
      protocol: readConfigValue(contents, 'N8N_PROTOCOL') || 'http',
      host: readConfigValue(contents, 'N8N_HOST') || undefined,
      port: readConfigValue(contents, 'N8N_PORT') || 5678,
      path: readConfigValue(contents, 'N8N_PATH') || '/'
    })
  },
  rabbitmq: {
    label: 'Open RabbitMQ management',
    address: () => ({ host: 'localhost', port: 15672 })
  },
  qdrant: {
    label: 'Open Qdrant dashboard',
    address: () => localPort(6333, '/dashboard')
  },
  zincsearch: {
    label: 'Open ZincSearch',
    file: 'zincsearch/zincsearch.env',
    address: (contents) => ({
      host: readConfigValue(contents, 'ZINC_SERVER_ADDRESS') || undefined,
      port: readConfigValue(contents, 'ZINC_SERVER_PORT') || 4080
    })
  },
  rnacos: {
    label: 'Open R-Nacos console',
    file: 'rnacos/rnacos.env',
    address: (contents) =>
      localPort(readConfigValue(contents, 'RNACOS_HTTP_CONSOLE_PORT') || 10848, '/rnacos/')
  },
  numa: {
    label: 'Open Numa',
    file: 'numa/numa.toml',
    address: (contents) => localPort(readConfigValue(contents, 'api_port') || 5380)
  },
  cliproxyapi: {
    label: 'Open CLIProxyAPI management',
    file: 'cliproxyapi/config.yaml',
    address: (contents) =>
      localPort((contents ? YAML.parse(contents)?.port : undefined) ?? 8317, '/management.html')
  },
  'temporal-cli': {
    label: 'Open Temporal CLI UI',
    file: (version) => 'temporal-cli/temporal-cli-v' + installedVersion(version) + '.conf',
    address: (contents) => localPort(readConfigValue(contents, 'ui-port') || 8233)
  }
} satisfies Record<string, Policy>

export type DashboardServiceFlag = keyof typeof dashboardPolicies

export function dashboardPolicy(flag?: string): Policy | undefined {
  if (flag && Object.hasOwn(dashboardPolicies, flag)) {
    return dashboardPolicies[flag as DashboardServiceFlag]
  }
  return undefined
}

function browserHost(input = '127.0.0.1') {
  if (['0.0.0.0', '::', '[::]', '*'].includes(input)) return '127.0.0.1'
  if (/^\[[\da-f:.]+\]$/i.test(input) || /^[a-z\d.-]+$/i.test(input)) return input
  if (/^[\da-f:.]+$/i.test(input) && input.includes(':')) return '[' + input + ']'
  throw new Error('Invalid dashboard hostname.')
}

export function dashboardUrl(policy: Policy, contents: string) {
  const { host, port, protocol = 'http', path = '/' } = policy.address(contents)
  const scheme = protocol.toLowerCase()
  const portValue =
    typeof port === 'number'
      ? String(port)
      : typeof port === 'string'
        ? unquoteConfigValue(port)
        : ''
  if (
    !['http', 'https'].includes(scheme) ||
    !/^\d+$/.test(portValue) ||
    Number(portValue) < 1 ||
    Number(portValue) > 65535
  ) {
    throw new Error('Invalid dashboard protocol or port.')
  }
  if (path.startsWith('//') || path.includes('://') || /[?#@\\\s]/.test(path)) {
    throw new Error('Invalid dashboard path.')
  }
  const suffix = path.startsWith('/') ? path : '/' + path
  const url = new URL(scheme + '://' + browserHost(host) + ':' + portValue + suffix)
  if (url.username || url.password) throw new Error('Invalid dashboard credentials.')
  return url.href
}
