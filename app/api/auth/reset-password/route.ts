import { NextResponse } from 'next/server'

import { buildAuthConfirmUrl } from '@/lib/auth/redirect'
import { createClient } from '@/lib/supabase/server'

import { getErrorMessage } from '../_utils'

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { email?: string }
    const email = body.email ?? ''

    const supabase = await createClient()
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: buildAuthConfirmUrl(req, '/reset-password').toString(),
    })

    if (error) {
      throw error
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    const message = getErrorMessage(err, 'Reset password failed')
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
