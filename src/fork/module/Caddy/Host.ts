import type { AppHost } from '@shared/app'
import { join } from 'path'
import { hostAlias, mkdirp, readFile, writeFile, removeByRoot } from '../../Fn'
import { vhostTmpl } from '../Host/Host'
import { vhostName } from '../Host/vhostName'
import { updateCaddyReverseProxy } from '../Host/CaddyReverseProxy'
import { existsSync } from 'fs'
import { isEqual } from 'lodash-es'
import { pathFixedToUnix } from '@shared/utils'

export const makeCaddyConf = async (host: AppHost, stage?: (path: string, content: string) => Promise<void>) => {
  const caddyvpath = join(global.Server.BaseDir!, 'vhost/caddy')
  if (!stage) await mkdirp(caddyvpath)
  const httpNames: string[] = []
  const httpsNames: string[] = []
  hostAlias(host).forEach((h) => {
    if (!host?.port?.caddy || host.port.caddy === 80) {
      httpNames.push(`http://${h}`)
    } else {
      httpNames.push(`http://${h}:${host.port.caddy}`)
    }
    if (host.useSSL) {
      httpsNames.push(`https://${h}:${host?.port?.caddy_ssl ?? 443}`)
    }
  })

  const tmpl = await vhostTmpl()

  const contentList: string[] = []

  // Log / conf files named by host.id to avoid same-name collisions. (#700)
  const fileBase = vhostName(host)
  const root = host.root
  const phpv = host.phpVersion
  const logFile = join(global.Server.BaseDir!, `vhost/logs/${fileBase}.caddy.log`)

  const httpHostNameAll = httpNames.join(',\n')
  let content = tmpl.caddy
    .replace('##HOST-ALL##', httpHostNameAll)
    .replace('##LOG-PATH##', pathFixedToUnix(logFile))
    .replace('##ROOT##', pathFixedToUnix(root))
  if (phpv) {
    content = content.replace('##PHP-VERSION##', `${phpv}`)
  } else {
    content = content.replace('import enable-php-select ##PHP-VERSION##', `##Static Site Caddy##`)
  }
  content = updateCaddyReverseProxy(host, content, 'file_server')
  contentList.push(content)

  if (host.useSSL) {
    let tls = 'internal'
    if (host.ssl.cert && host.ssl.key) {
      tls = `"${pathFixedToUnix(host.ssl.cert)}" "${pathFixedToUnix(host.ssl.key)}"`
    }
    const httpHostNameAll = httpsNames.join(',\n')
    let content = tmpl.caddySSL
      .replace('##HOST-ALL##', httpHostNameAll)
      .replace('##LOG-PATH##', pathFixedToUnix(logFile))
      .replace('##SSL##', tls)
      .replace('##ROOT##', pathFixedToUnix(root))
    if (phpv) {
      content = content.replace('##PHP-VERSION##', `${phpv}`)
    } else {
      content = content.replace('import enable-php-select ##PHP-VERSION##', `##Static Site Caddy##`)
    }
    content = updateCaddyReverseProxy(host, content, 'file_server')
    contentList.push(content)
  }

  const confFile = join(caddyvpath, `${fileBase}.conf`)
  await (stage ?? writeFile)(confFile, contentList.join('\n'))
}

export const updateCaddyConf = async (host: AppHost, old: AppHost) => {
  const logpath = join(global.Server.BaseDir!, 'vhost/logs')
  const caddyvpath = join(global.Server.BaseDir!, 'vhost/caddy')
  await mkdirp(caddyvpath)
  await mkdirp(logpath)

  // conf / log files named by host.id (rename-stable) — no move on rename. (#700)
  const fileBase = vhostName(host)
  const caddyConfPath = join(caddyvpath, `${fileBase}.conf`)
  let hasChanged = false

  if (!existsSync(caddyConfPath)) {
    await makeCaddyConf(host)
  }

  let contentCaddyConf = await readFile(caddyConfPath, 'utf-8')

  const find: Array<string> = []
  const replace: Array<string> = []
  const oldAliasArr = hostAlias(old)
  const newAliasArr = hostAlias(host)

  if (
    !isEqual(oldAliasArr, newAliasArr) ||
    old.port.caddy !== host.port.caddy ||
    old.port.caddy_ssl !== host.port.caddy_ssl
  ) {
    hasChanged = true
    const oldHttpNames: string[] = []
    const oldHttpsNames: string[] = []
    const hostHttpNames: string[] = []
    const hostHttpsNames: string[] = []

    oldAliasArr.forEach((h) => {
      if (!old?.port?.caddy || old.port.caddy === 80) {
        oldHttpNames.push(`http://${h}`)
      } else {
        oldHttpNames.push(`http://${h}:${old.port.caddy}`)
      }
      if (old.useSSL) {
        oldHttpsNames.push(`https://${h}:${old?.port?.caddy_ssl ?? 443}`)
      }
    })

    newAliasArr.forEach((h) => {
      if (!host?.port?.caddy || host.port.caddy === 80) {
        hostHttpNames.push(`http://${h}`)
      } else {
        hostHttpNames.push(`http://${h}:${host.port.caddy}`)
      }
      if (host.useSSL) {
        hostHttpsNames.push(`https://${h}:${host?.port?.caddy_ssl ?? 443}`)
      }
    })

    find.push(...[oldHttpNames.join(',\n'), oldHttpsNames.join(',\n')])
    replace.push(...[hostHttpNames.join(',\n'), hostHttpsNames.join(',\n')])
  }

  if (host.ssl.cert !== old.ssl.cert || host.ssl.key !== old.ssl.key) {
    hasChanged = true
    find.push(`tls (.*?)\\n`)
    replace.push(`tls "${pathFixedToUnix(host.ssl.cert)}" "${pathFixedToUnix(host.ssl.key)}"\n`)
  }
  if (host.root !== old.root) {
    hasChanged = true
    find.push(`root \\* (.*?)\\n`)
    replace.push(`root * "${pathFixedToUnix(host.root)}"\n`)
  }
  if (host.phpVersion !== old.phpVersion) {
    hasChanged = true
    if (old.phpVersion) {
      find.push(...[`import(\\s+)enable-php-select(.*?)\\r\\n`])
      find.push(...[`import(\\s+)enable-php-select(.*?)\\n`])
    } else {
      find.push(...[`import(\\s+)enable-php-select(.*?)\\r\\n`])
      find.push(...[`import(\\s+)enable-php-select(.*?)\\n`])
      find.push(...['##Static Site Caddy##'])
    }
    if (host.phpVersion) {
      if (old.phpVersion) {
        replace.push(...[`import enable-php-select ${host.phpVersion}\r\n`])
        replace.push(...[`import enable-php-select ${host.phpVersion}\n`])
      } else {
        replace.push(...[`import enable-php-select ${host.phpVersion}\r\n`])
        replace.push(...[`import enable-php-select ${host.phpVersion}\n`])
        replace.push(...[`import enable-php-select ${host.phpVersion}`])
      }
    } else {
      if (old.phpVersion) {
        replace.push(...['##Static Site Caddy##\r\n'])
        replace.push(...['##Static Site Caddy##\n'])
      } else {
        replace.push(...['##Static Site Caddy##\r\n'])
        replace.push(...['##Static Site Caddy##\n'])
        replace.push(...['##Static Site Caddy##'])
      }
    }
  }
  if (!isEqual(host?.reverseProxy, old?.reverseProxy)) {
    hasChanged = true
  }
  if (hasChanged) {
    find.forEach((s, i) => {
      contentCaddyConf = contentCaddyConf.replace(new RegExp(s, 'g'), replace[i])
      contentCaddyConf = contentCaddyConf.replace(s, replace[i])
    })
    contentCaddyConf = updateCaddyReverseProxy(host, contentCaddyConf, 'file_server')
    await writeFile(caddyConfPath, contentCaddyConf)
  }
}

export const delVhost = async (host: AppHost) => {
  const caddyvpath = join(global.Server.BaseDir!, 'vhost/caddy')
  const logpath = join(global.Server.BaseDir!, 'vhost/logs')
  const fileBase = vhostName(host)
  const cvhost = join(caddyvpath, `${fileBase}.conf`)
  const caddylog = join(logpath, `${fileBase}.caddy.log`)
  // Also remove legacy name-based files for sites created before #700.
  const legacy = [join(caddyvpath, `${host.name}.conf`), join(logpath, `${host.name}.caddy.log`)]
  const arr = [cvhost, caddylog, ...legacy]
  for (const f of arr) {
    if (existsSync(f)) {
      try {
        await removeByRoot(f)
      } catch {}
    }
  }
}
