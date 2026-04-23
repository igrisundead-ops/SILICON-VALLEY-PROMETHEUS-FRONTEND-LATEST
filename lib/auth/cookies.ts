import 'server-only'

import { cookies } from 'next/headers'

const COOKIE_NAME = 'xano_token'

export async function getXanoToken(): Promise<string | undefined> {
  const jar = await cookies()
  return jar.get(COOKIE_NAME)?.value
}

export async function setXanoToken(token: string) {
  const jar = await cookies()
  jar.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
  })
}

export async function clearXanoToken() {
  const jar = await cookies()
  jar.set(COOKIE_NAME, '', {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 0,
  })
}
