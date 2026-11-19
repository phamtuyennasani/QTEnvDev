import type { WebsiteHost, ProjectItem } from './types'
import { buildSiteHostnames, isDirectProjectSite, isTomcatSite } from '@shared/siteRuntime'

export const cloneHost = (host: Readonly<WebsiteHost>): WebsiteHost =>
  JSON.parse(JSON.stringify(host))
export function newWebsite(): WebsiteHost {
  return {
    id: Date.now(),
    type: 'php',
    name: '',
    alias: '',
    projectName: '',
    root: '',
    url: '',
    useSSL: false,
    autoSSL: true,
    ssl: { cert: '', key: '' },
    port: {
      nginx: 80,
      apache: 80,
      caddy: 80,
      frankenphp: 80,
      tomcat: 8080,
      nginx_ssl: 443,
      apache_ssl: 443,
      caddy_ssl: 443,
      frankenphp_ssl: 443,
      tomcat_ssl: 8443
    },
    nginx: { rewrite: '' },
    reverseProxy: []
  }
}
export function normalizeWebsite(input: Readonly<WebsiteHost>): WebsiteHost {
  const host = cloneHost(input)
  const raw = host.name.trim()
  const url = new URL(raw.includes('://') ? raw : 'http://' + raw)
  if (
    !['http:', 'https:'].includes(url.protocol) ||
    !url.hostname ||
    url.username ||
    url.password ||
    (url.pathname && url.pathname !== '/') ||
    url.search ||
    url.hash
  ) {
    throw new Error('Enter a hostname such as app.test, without a path or credentials.')
  }
  if (url.port)
    throw new Error('Set listening ports in the Ports section, separately from the hostname.')
  host.name = url.hostname.toLowerCase()
  host.alias = (host.alias || '')
    .split(/[\s,]+/)
    .filter(Boolean)
    .map((alias) => {
      const parsed = new URL('http://' + alias)
      if (
        parsed.host !== alias.toLowerCase() ||
        parsed.pathname !== '/' ||
        parsed.search ||
        parsed.hash ||
        parsed.username ||
        parsed.password ||
        parsed.port
      )
        throw new Error('Aliases must contain one hostname per line, without ports.')
      return parsed.hostname.toLowerCase()
    })
    .filter((alias, index, aliases) => alias !== host.name && aliases.indexOf(alias) === index)
    .join('\n')
  host.root = host.root.trim()
  if (!host.root) throw new Error('Choose the website root directory.')
  if (
    isDirectProjectSite(host) &&
    (!Number.isInteger(host.projectPort) ||
      !host.projectPort ||
      host.projectPort < 1 ||
      host.projectPort > 65535)
  ) {
    throw new Error('Project port must be an integer from 1 to 65535.')
  }
  for (const [name, port] of Object.entries(host.port)) {
    if (name.endsWith('_ssl') && !host.useSSL) continue
    if (port !== undefined && (!Number.isInteger(port) || port < 1 || port > 65535))
      throw new Error('Port ' + name + ' must be an integer from 1 to 65535.')
  }
  if (host.useSSL && !host.autoSSL && (!host.ssl.cert.trim() || !host.ssl.key.trim()))
    throw new Error('Select both a certificate and private key, or enable automatic SSL.')
  for (const proxy of host.reverseProxy || []) {
    if (!proxy.path.startsWith('/')) throw new Error('Each reverse proxy path must start with /.')
    const target = new URL(proxy.url)
    if (!['http:', 'https:'].includes(target.protocol))
      throw new Error('Reverse proxy targets must use HTTP or HTTPS.')
  }
  return host
}
export const editableWebsite = (host: WebsiteHost) =>
  !host.type || host.type === 'php' || isTomcatSite(host) || isDirectProjectSite(host)
export const projectFromHost = (host: WebsiteHost): ProjectItem => ({
  id: host.id,
  name: host.projectName?.trim() || host.name,
  domain: host.name,
  path: host.root,
  ssl: host.useSSL,
  runtime: host.phpVersionFull
    ? 'PHP ' + host.phpVersionFull
    : host.phpVersion
      ? 'PHP ' + host.phpVersion
      : host.type && host.type !== 'php'
        ? host.type
        : 'Static',
  host: cloneHost(host)
})
export const websiteServers = [
  { flag: 'nginx', label: 'Nginx' },
  { flag: 'apache', label: 'Apache' },
  { flag: 'caddy', label: 'Caddy' },
  { flag: 'frankenphp', label: 'FrankenPHP' }
] as const
type WebServer = (typeof websiteServers)[number]['flag'] | 'tomcat'
const websiteHasTls = (host: WebsiteHost) => Boolean(host.useSSL && host.ssl?.cert && host.ssl?.key)

export function websitePort(host: WebsiteHost, server: WebServer, https = websiteHasTls(host)) {
  if (isDirectProjectSite(host)) return host.projectPort
  if (isTomcatSite(host)) server = 'tomcat'
  const key = (https ? String(server) + '_ssl' : server) as keyof WebsiteHost['port']
  return (
    host.port?.[key] ??
    (server === 'frankenphp' ? host.port?.[https ? 'caddy_ssl' : 'caddy'] : undefined) ??
    (https ? 443 : 80)
  )
}

export function websiteUrl(
  host: WebsiteHost,
  server: WebServer = 'nginx',
  hostname = host.name,
  https = websiteHasTls(host)
): string {
  if (isDirectProjectSite(host)) {
    hostname = '127.0.0.1'
    https = false
    if (
      !Number.isInteger(host.projectPort) ||
      !host.projectPort ||
      host.projectPort < 1 ||
      host.projectPort > 65535
    ) {
      throw new Error('The project has no valid configured port.')
    }
  }
  const port = websitePort(host, server, https)
  const url = new URL((https ? 'https://' : 'http://') + hostname)
  if (url.username || url.password || url.pathname !== '/' || url.search || url.hash || url.port) {
    throw new Error('The stored website hostname is invalid.')
  }
  if (port && port !== (https ? 443 : 80)) url.port = String(port)
  return url.href
}

export function websiteLinks(host: WebsiteHost) {
  if (isDirectProjectSite(host)) {
    try {
      return [{ label: 'Project runtime', url: websiteUrl(host) }]
    } catch {
      return []
    }
  }
  const servers = isTomcatSite(host)
    ? ([{ flag: 'tomcat', label: 'Tomcat' }] as const)
    : websiteServers
  const modes = websiteHasTls(host) ? [false, true] : [false]
  const links = new Map<string, string[]>()
  for (const hostname of buildSiteHostnames(host)) {
    for (const server of servers) {
      for (const https of modes) {
        try {
          const url = websiteUrl(host, server.flag, hostname, https)
          const labels = links.get(url) ?? []
          labels.push(server.label)
          links.set(url, labels)
        } catch {
          // A malformed alias in an old site must not hide the other endpoints.
        }
      }
    }
  }
  return Array.from(links, ([url, labels]) => ({ url, label: labels.join(', ') }))
}
