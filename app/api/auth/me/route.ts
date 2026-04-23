import { NextResponse } from 'next/server'

import { getXanoToken } from '@/lib/auth/cookies'
import { ENDPOINTS } from '@/lib/xano/config'
import { xanoFetch } from '@/lib/xano/server'

import { ensureEndpoint } from '../_utils'

export async function GET() {
  try {
    ensureEndpoint(ENDPOINTS.me, 'me')
    const token = await getXanoToken()
    if (!token) return NextResponse.json({ user: null }, { status: 401 })

    const res = await xanoFetch<any>(ENDPOINTS.me, { method: 'GET' }, token)
    const user = res?.user ?? res?.data?.user ?? res?.data ?? res ?? null
    return NextResponse.json({ user })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch user'
    return NextResponse.json({ error: message }, { status: 401 })
  }
}
