import { NextResponse } from 'next/server'

import { setXanoToken } from '@/lib/auth/cookies'
import { ENDPOINTS } from '@/lib/xano/config'
import { xanoFetch } from '@/lib/xano/server'

import { extractToken, ensureEndpoint, getUserVerificationFlag } from '../_utils'

type SignupBody = {
  fullName: string
  email: string
  password: string
}

export async function POST(req: Request) {
  const startedAt = Date.now()
  try {
    ensureEndpoint(ENDPOINTS.signup, 'signup')
    const body = (await req.json()) as Partial<SignupBody>

    const email = body.email ?? ''
    const password = body.password ?? ''
    const fullName = body.fullName ?? ''

    console.info('[api/auth/signup] incoming', {
      email,
      hasPassword: Boolean(password),
      fullNameLen: fullName.length,
      ip: req.headers.get('x-forwarded-for') ?? req.headers.get('x-real-ip') ?? null,
    })

    // Try "name" first (most common), then fall back to "username" if Xano rejects.
    const payloadName = { name: fullName, email, password }
    const payloadUsername = { username: fullName, email, password }

    let res: any
    try {
      res = await xanoFetch<any>(ENDPOINTS.signup, { method: 'POST', body: payloadName })
    } catch (err) {
      // Retry once with username mapping.
      res = await xanoFetch<any>(ENDPOINTS.signup, { method: 'POST', body: payloadUsername })
    }
    const token = extractToken(res)
    if (token) await setXanoToken(token)

    const user = res?.user ?? res?.data?.user ?? res?.data ?? res?.user_data ?? null
    const verified = getUserVerificationFlag(user)
    const requiresVerification =
      verified === false ||
      Boolean(res?.verification_required) ||
      Boolean(res?.verificationRequired) ||
      res?.status === 'verification_required'

    console.info('[api/auth/signup] ok', {
      ms: Date.now() - startedAt,
      requiresVerification,
      hasUser: Boolean(user),
      hasToken: Boolean(token),
    })
    return NextResponse.json({ user, requiresVerification })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Signup failed'
    console.error('[api/auth/signup] error', { ms: Date.now() - startedAt, message })
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
