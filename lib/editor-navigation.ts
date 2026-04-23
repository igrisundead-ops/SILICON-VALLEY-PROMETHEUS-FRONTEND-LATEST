const EDITOR_RETURN_PATH_SESSION_KEY = 'prometheus.editor-return-path.v1'
const EDITOR_PENDING_NAVIGATION_SESSION_KEY = 'prometheus.editor-pending-navigation.v1'

function isBrowser() {
  return typeof window !== 'undefined'
}

function normalizeAppPath(path: string | null | undefined) {
  if (!path) return null
  if (!path.startsWith('/')) return null
  return path
}

export function rememberEditorReturnPath(path: string | null | undefined) {
  if (!isBrowser()) return

  const normalizedPath = normalizeAppPath(path)
  if (!normalizedPath) return

  window.sessionStorage.setItem(EDITOR_RETURN_PATH_SESSION_KEY, normalizedPath)
}

export function rememberCurrentPathForEditorReturn() {
  if (!isBrowser()) return
  rememberEditorReturnPath(`${window.location.pathname}${window.location.search}${window.location.hash}`)
}

export function getRememberedEditorReturnPath() {
  if (!isBrowser()) return null
  return normalizeAppPath(window.sessionStorage.getItem(EDITOR_RETURN_PATH_SESSION_KEY))
}

export function markPendingEditorNavigation(path: string | null | undefined) {
  if (!isBrowser()) return

  const normalizedPath = normalizeAppPath(path)
  if (!normalizedPath) return

  window.sessionStorage.setItem(EDITOR_PENDING_NAVIGATION_SESSION_KEY, normalizedPath)
}

export function getPendingEditorNavigation() {
  if (!isBrowser()) return null
  return normalizeAppPath(window.sessionStorage.getItem(EDITOR_PENDING_NAVIGATION_SESSION_KEY))
}

export function clearPendingEditorNavigation(path?: string | null) {
  if (!isBrowser()) return

  const currentPendingPath = getPendingEditorNavigation()
  if (!currentPendingPath) return

  if (path && normalizeAppPath(path) !== currentPendingPath) return

  window.sessionStorage.removeItem(EDITOR_PENDING_NAVIGATION_SESSION_KEY)
}
