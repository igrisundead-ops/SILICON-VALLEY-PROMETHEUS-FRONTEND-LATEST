import { NextResponse } from 'next/server'

import { setXanoToken } from '@/lib/auth/cookies'
import { ENDPOINTS } from '@/lib/xano/config'
import { xanoFetch } from '@/lib/xano/server'

import { extractToken, ensureEndpoint } from '../_utils'

export async function POST(req: Request) {
  try {
    ensureEndpoint(ENDPOINTS.verifyEmail, 'verifyEmail')
    const body = (await req.json()) as { code?: string; token?: string }
    const code = body.code?.trim()
    const token = body.token?.trim()

    if (!code && !token) {
      return NextResponse.json({ error: 'Missing code or token' }, { status: 400 })
    }

    const res = await xanoFetch<any>(ENDPOINTS.verifyEmail, {
      method: 'POST',
      body: token ? { token } : { code },
    })

    const nextToken = extractToken(res)
    if (nextToken) await setXanoToken(nextToken)

    return NextResponse.json({ ok: true, data: res ?? null })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Verification failed'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}

