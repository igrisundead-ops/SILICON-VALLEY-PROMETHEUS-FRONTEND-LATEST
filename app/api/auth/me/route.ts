import { NextResponse } from 'next/server'

import { createClient } from '@/lib/supabase/server'

import { getErrorMessage } from '../_utils'

export async function GET() {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser()

    if (error || !user) {
      return NextResponse.json({ user: null }, { status: 401 })
    }

    return NextResponse.json({ user })
  } catch (err) {
    const message = getErrorMessage(err, 'Failed to fetch user')
    return NextResponse.json({ error: message }, { status: 401 })
  }
}
