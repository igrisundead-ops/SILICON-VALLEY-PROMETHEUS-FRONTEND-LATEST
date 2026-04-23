import { NextResponse } from 'next/server'

import { ENDPOINTS } from '@/lib/xano/config'
import { xanoFetch } from '@/lib/xano/server'

import { ensureEndpoint } from '../_utils'

export async function POST(req: Request) {
  try {
    ensureEndpoint(ENDPOINTS.resendVerification, 'resendVerification')
    const body = (await req.json()) as { email?: string }
    const email = body.email ?? ''

    const res = await xanoFetch<any>(ENDPOINTS.resendVerification, {
      method: 'POST',
      body: { email },
    })

    return NextResponse.json({ ok: true, data: res ?? null })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Resend failed'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
