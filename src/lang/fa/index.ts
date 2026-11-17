import aiFA from './ai.json'
import apacheFA from './apache.json'
import appLogFA from './appLog.json'
import asideFA from './aside.json'
import baseFA from './base.json'
import confFA from './conf.json'
import feedbackFA from './feedback.json'
import forkFA from './fork.json'
import hostFA from './host.json'
import mailpitFA from './mailpit.json'
import menuFA from './menu.json'
import mysqlFA from './mysql.json'
import nginxFA from './nginx.json'
import nodejsFA from './nodejs.json'
import phpFA from './php.json'
import promptFA from './prompt.json'
import redisFA from './redis.json'
import serviceFA from './service.json'
import setupFA from './setup.json'
import tokenGeneratorFA from './token-generator.json'
import toolsFA from './tools.json'
import toolTypeFA from './toolType.json'
import trayFA from './tray.json'
import updateFA from './update.json'
import utilFA from './util.json'
import versionmanagerFA from './versionmanager.json'
import licensesFA from './licenses.json'
import requestTimer from './requestTimer.json'
import meilisearch from './meilisearch.json'
import minio from './minio.json'
import podman from './podman.json'
import n8n from './n8n.json'
import rustfs from './rustfs.json'
import mkcert from './mkcert.json'
import flutter from './flutter.json'
import cron from './cron.json'
import common from './common.json'

export default {
  fa: {
    common,
    cron,
    rustfs,
    mkcert,
    flutter,
    n8n,
    podman,
    minio,
    meilisearch,
    requestTimer,
    licenses: licensesFA,
    ai: aiFA,
    apache: apacheFA,
    appLog: appLogFA,
    aside: asideFA,
    base: baseFA,
    conf: confFA,
    feedback: feedbackFA,
    fork: forkFA,
    host: hostFA,
    mailpit: mailpitFA,
    menu: menuFA,
    mysql: mysqlFA,
    nginx: nginxFA,
    nodejs: nodejsFA,
    php: phpFA,
    prompt: promptFA,
    redis: redisFA,
    service: serviceFA,
    setup: setupFA,
    'token-generator': tokenGeneratorFA,
    tools: toolsFA,
    toolType: toolTypeFA,
    tray: trayFA,
    update: updateFA,
    util: utilFA,
    versionmanager: versionmanagerFA
  }
}
