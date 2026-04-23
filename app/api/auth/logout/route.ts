import { NextResponse } from 'next/server'

import { clearXanoToken } from '@/lib/auth/cookies'

export async function POST() {
  await clearXanoToken()
  return NextResponse.json({ ok: true })
}
