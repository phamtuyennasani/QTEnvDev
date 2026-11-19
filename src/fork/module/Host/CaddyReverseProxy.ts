import type { AppHost } from '@shared/app'

const begin = '#PWS-REVERSE-PROXY-BEGIN#'
const end = '#PWS-REVERSE-PROXY-END#'
const generatedBlock =
  /^[ \t]*#PWS-REVERSE-PROXY-BEGIN#[\s\S]*?^[ \t]*#PWS-REVERSE-PROXY-END#[ \t]*\r?\n/gm

export function updateCaddyReverseProxy(
  host: AppHost,
  content: string,
  handler: 'file_server' | 'php_server'
) {
  const withoutProxy = content.replace(generatedBlock, '')
  const proxies = host.reverseProxy
  if (!proxies?.length) return withoutProxy

  const eol = withoutProxy.includes('\r\n') ? '\r\n' : '\n'
  const handlerLine = new RegExp(`^([ \\t]*)${handler}(?=[ \\t\\r\\n{]|$)`, 'gm')
  return withoutProxy.replace(handlerLine, (match, indent: string) => {
    const lines = [begin]
    for (const { path, url } of proxies) {
      // A plain website route is a prefix, while Caddy treats it as an exact matcher.
      const matcher = path.includes('*') ? path : `${path}*`
      lines.push(
        `reverse_proxy ${matcher} {`,
        `    to ${url}`,
        '    header_up X-Real-IP {remote}',
        '    header_up X-Forwarded-For {remote}',
        '    header_up X-Forwarded-Proto {scheme}',
        '}'
      )
    }
    lines.push(end)
    return lines.map((line) => indent + line).join(eol) + eol + match
  })
}
