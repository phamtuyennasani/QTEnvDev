import { ForkPromise } from '@shared/ForkPromise'

const hostTransactions = new Set([
  'websiteBackupImport',
  'websiteBackupExport',
  'reorderHost',
  'handleHost',
  'restoreConfig',
  'addRandomSite',
  'addPhpMyAdminSite',
  'writeHosts'
])

export function isWebsiteForkTransaction(module: string, command: string) {
  return (
    (module === 'host' && hostTransactions.has(command)) ||
    (module === 'tomcat' && command === 'saveSite')
  )
}

type Reply = {
  code: number
  msg?: string
  errorCode?: string
  data?: { outcome?: string; message?: string }
}

export class WebsiteForkQueue {
  private tail: Promise<void> = Promise.resolve()
  private uncertain = false

  run(dispatch: (progress: (reply: Reply) => void) => PromiseLike<Reply>) {
    return new ForkPromise<Reply>((resolve, reject, progress) => {
      const flight = this.tail.then(async () => {
        if (this.uncertain) {
          return {
            code: 1,
            msg: 'A previous website write has an unknown result. Check the saved configuration before restarting the app.'
          }
        }
        const reply = await dispatch(progress)
        if (
          reply.errorCode === 'WEBSITE_WRITE_OUTCOME_UNKNOWN' ||
          reply.errorCode === 'TOMCAT_SITE_OUTCOME_UNKNOWN' ||
          reply.data?.outcome === 'unknown'
        ) {
          this.uncertain = true
        }
        return reply
      })
      this.tail = flight.then(
        () => undefined,
        () => undefined
      )
      flight.then(resolve, reject)
    })
  }
}
