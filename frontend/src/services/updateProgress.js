const storageKey = 'somtop_active_update'
const feedPrefix = `${import.meta.env.BASE_URL}.update-status/`

export const validProgressUrl = value => {
  try {
    const url = new URL(value, window.location.origin)
    return url.origin === window.location.origin && url.pathname.startsWith(feedPrefix) &&
      /^[a-f0-9]{64}\.json$/.test(url.pathname.slice(feedPrefix.length)) && !url.search && !url.hash
  } catch { return false }
}

export const readActiveUpdate = () => {
  try {
    const saved = JSON.parse(sessionStorage.getItem(storageKey))
    if (saved?.status === 'running' && validProgressUrl(saved.progress_url) &&
        Date.now() - Date.parse(saved.started_at) < 24 * 60 * 60 * 1000) return saved
  } catch {}
  sessionStorage.removeItem(storageKey)
  return null
}

export const saveActiveUpdate = status => {
  if (status?.status === 'running' && validProgressUrl(status.progress_url)) {
    const { id, status: state, phase, started_at, progress_url, steps, events } = status
    sessionStorage.setItem(storageKey, JSON.stringify({ id, status: state, phase, started_at, progress_url, steps, events }))
  } else sessionStorage.removeItem(storageKey)
}
