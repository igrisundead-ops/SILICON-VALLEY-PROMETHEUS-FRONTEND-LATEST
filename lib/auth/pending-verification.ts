'use client'

const PENDING_VERIFICATION_EMAIL_SESSION_KEY = 'prometheus.pendingVerificationEmail.v1'

type PendingVerificationState = {
  email: string
  lastSentAt: number | null
}

function readPendingVerificationState(): PendingVerificationState | null {
  if (typeof window === 'undefined') return null

  try {
    const raw = window.sessionStorage.getItem(PENDING_VERIFICATION_EMAIL_SESSION_KEY)
    if (!raw) return null

    try {
      const parsed = JSON.parse(raw) as Partial<PendingVerificationState> | string
      if (typeof parsed === 'string') {
        const email = parsed.trim()
        return email ? { email, lastSentAt: null } : null
      }

      const email = typeof parsed?.email === 'string' ? parsed.email.trim() : ''
      const lastSentAt =
        typeof parsed?.lastSentAt === 'number' && Number.isFinite(parsed.lastSentAt) ? parsed.lastSentAt : null

      return email ? { email, lastSentAt } : null
    } catch {
      const email = raw.trim()
      return email ? { email, lastSentAt: null } : null
    }
  } catch {
    return null
  }
}

export function readPendingVerificationEmail() {
  return readPendingVerificationState()?.email ?? ''
}

export function readPendingVerificationLastSentAt(email?: string) {
  const state = readPendingVerificationState()
  if (!state?.email) return 0

  if (email?.trim() && state.email.toLowerCase() !== email.trim().toLowerCase()) {
    return 0
  }

  return state.lastSentAt ?? 0
}

export function writePendingVerificationEmail(email: string, options?: { lastSentAt?: number | null }) {
  if (typeof window === 'undefined') return

  try {
    const normalizedEmail = email.trim()

    if (!normalizedEmail) {
      window.sessionStorage.removeItem(PENDING_VERIFICATION_EMAIL_SESSION_KEY)
      return
    }

    const currentState = readPendingVerificationState()
    const nextState: PendingVerificationState = {
      email: normalizedEmail,
      lastSentAt:
        typeof options?.lastSentAt === 'number'
          ? options.lastSentAt
          : options?.lastSentAt === null
            ? null
            : currentState?.email.toLowerCase() === normalizedEmail.toLowerCase()
              ? currentState.lastSentAt
              : null,
    }

    window.sessionStorage.setItem(PENDING_VERIFICATION_EMAIL_SESSION_KEY, JSON.stringify(nextState))
  } catch {
    // Ignore session storage failures and fall back to query params only.
  }
}

export function markPendingVerificationEmailSent(email: string, sentAt = Date.now()) {
  writePendingVerificationEmail(email, { lastSentAt: sentAt })
}
