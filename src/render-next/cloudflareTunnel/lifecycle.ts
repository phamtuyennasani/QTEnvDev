import store from '@/core/CloudflareTunnel/CloudflareTunnelStore'

export async function changeCloudflareTunnels(action: 'start' | 'stop' | 'restart') {
  await store.init()
  if (!store.items.length) return action === 'stop' ? true : 'No tunnels are configured.'

  const items = [...store.items]
  const results = await Promise.allSettled(
    items.map(async (item) => {
      if (item.running) return 'Wait for the current operation to finish.'
      if ((action === 'stop' && !item.run) || (action === 'start' && item.run)) return true
      if (action === 'restart' && !item.run) return item.start()
      return item[action]()
    })
  )
  const failures = results.flatMap((result, index) => {
    if (result.status === 'fulfilled' && result.value === true) return []
    const issue =
      result.status === 'rejected'
        ? String(result.reason)
        : result.value || 'The tunnel did not confirm the change.'
    return [(items[index].tunnelName || items[index].id) + ' · ' + issue]
  })
  return failures.length ? failures.join('\n') : true
}
