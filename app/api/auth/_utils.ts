export function extractToken(payload: unknown): string | undefined {
  if (!payload || typeof payload !== 'object') return undefined
  const obj = payload as Record<string, unknown>
  const candidates = ['token', 'authToken', 'auth_token', 'accessToken', 'access_token']
  for (const key of candidates) {
    const value = obj[key]
    if (typeof value === 'string' && value.trim()) return value
  }
  return undefined
}

export function ensureEndpoint(pathOrUrl: string, name: string) {
  if (!pathOrUrl || pathOrUrl.includes('<PASTE_')) {
    throw new Error(`[CONFIG] Missing Xano endpoint for ${String(name)} in lib/xano/config.ts`)
  }
}

export function getUserVerificationFlag(user: unknown): boolean | undefined {
  if (!user || typeof user !== 'object') return undefined
  const u = user as Record<string, unknown>

  const candidates = ['email_verified', 'emailVerified', 'verified', 'is_verified', 'isVerified']
  for (const key of candidates) {
    const value = u[key]
    if (typeof value === 'boolean') return value
  }
  return undefined
}
