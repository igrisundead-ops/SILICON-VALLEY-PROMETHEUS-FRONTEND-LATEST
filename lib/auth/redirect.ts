const DEFAULT_NEXT_PATH = '/'

export function normalizeNextPath(rawPath: string | null | undefined, fallback = DEFAULT_NEXT_PATH) {
  if (!rawPath) return fallback
  if (!rawPath.startsWith('/') || rawPath.startsWith('//')) return fallback

  try {
    const url = new URL(rawPath, 'http://localhost')

    if (url.origin !== 'http://localhost') return fallback

    return `${url.pathname}${url.search}${url.hash}` || fallback
  } catch {
    return fallback
  }
}

export function buildAuthConfirmUrl(input: Request | URL | string, nextPath?: string) {
  const baseUrl =
    input instanceof Request ? new URL(input.url) : input instanceof URL ? input : new URL(input)

  const url = new URL('/auth/confirm', baseUrl.origin)
  const next = normalizeNextPath(nextPath)

  if (next !== DEFAULT_NEXT_PATH) {
    url.searchParams.set('next', next)
  }

  return url
}
