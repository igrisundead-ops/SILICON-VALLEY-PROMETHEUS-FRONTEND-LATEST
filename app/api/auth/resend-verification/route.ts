import { NextResponse } from 'next/server'

import { buildAuthConfirmUrl } from '@/lib/auth/redirect'
import { createClient } from '@/lib/supabase/server'

import { getErrorMessage } from '../_utils'

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { email?: string; next?: string }
    const email = body.email ?? ''
    const next = body.next

    const supabase = await createClient()
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email,
      options: {
        emailRedirectTo: buildAuthConfirmUrl(req, next).toString(),
      },
    })

    if (error) {
      throw error
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    const message = getErrorMessage(err, 'Resend failed')
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
