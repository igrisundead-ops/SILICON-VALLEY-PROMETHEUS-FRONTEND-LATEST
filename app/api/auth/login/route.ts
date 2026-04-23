import { NextResponse } from 'next/server'

import { setXanoToken } from '@/lib/auth/cookies'
import { ENDPOINTS } from '@/lib/xano/config'
import { xanoFetch } from '@/lib/xano/server'

import { extractToken, ensureEndpoint, getUserVerificationFlag } from '../_utils'

type LoginBody = {
  email: string
  password: string
}

export async function POST(req: Request) {
  const startedAt = Date.now()
  try {
    ensureEndpoint(ENDPOINTS.login, 'login')
    const body = (await req.json()) as Partial<LoginBody>

    const payload = {
      email: body.email ?? '',
      password: body.password ?? '',
    }

    console.info('[api/auth/login] incoming', {
      email: payload.email,
      hasPassword: Boolean(payload.password),
      ip: req.headers.get('x-forwarded-for') ?? req.headers.get('x-real-ip') ?? null,
    })

    const res = await xanoFetch<any>(ENDPOINTS.login, { method: 'POST', body: payload })
    const token = extractToken(res)
    if (token) await setXanoToken(token)

    const user = res?.user ?? res?.data?.user ?? res?.data ?? null
    const verified = getUserVerificationFlag(user)
    const requiresVerification =
      verified === false ||
      Boolean(res?.verification_required) ||
      Boolean(res?.verificationRequired) ||
      res?.status === 'verification_required'

    console.info('[api/auth/login] ok', {
      ms: Date.now() - startedAt,
      requiresVerification,
      hasUser: Boolean(user),
      hasToken: Boolean(token),
    })
    return NextResponse.json({ user, requiresVerification })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Login failed'
    console.error('[api/auth/login] error', { ms: Date.now() - startedAt, message })
    return NextResponse.json({ error: message }, { status: 401 })
  }
}
