import { NextResponse } from 'next/server'

import { buildAuthConfirmUrl } from '@/lib/auth/redirect'
import { createClient } from '@/lib/supabase/server'

import { getErrorMessage } from '../_utils'

type SignupBody = {
  fullName: string
  email: string
  password: string
  next?: string
}

export async function POST(req: Request) {
  const startedAt = Date.now()
  try {
    const body = (await req.json()) as Partial<SignupBody>

    const email = body.email ?? ''
    const password = body.password ?? ''
    const fullName = body.fullName ?? ''
    const next = body.next

    console.info('[api/auth/signup] incoming', {
      email,
      hasPassword: Boolean(password),
      fullNameLen: fullName.length,
      ip: req.headers.get('x-forwarded-for') ?? req.headers.get('x-real-ip') ?? null,
    })

    const supabase = await createClient()
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
        },
        emailRedirectTo: buildAuthConfirmUrl(req, next).toString(),
      },
    })

    if (error) {
      throw error
    }

    const user = data.user
    const requiresVerification = Boolean(user && !data.session)

    console.info('[api/auth/signup] ok', {
      ms: Date.now() - startedAt,
      requiresVerification,
      hasUser: Boolean(user),
      hasSession: Boolean(data.session),
    })

    return NextResponse.json({ user, requiresVerification })
  } catch (err) {
    const message = getErrorMessage(err, 'Signup failed')
    console.error('[api/auth/signup] error', { ms: Date.now() - startedAt, message })
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
