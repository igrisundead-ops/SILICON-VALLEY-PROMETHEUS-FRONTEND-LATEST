import { NextResponse, type NextRequest } from 'next/server'

function shouldBypassAuth(req: NextRequest) {
  // Local dev convenience: bypass auth unless explicitly disabled.
  // You can force auth checks in dev with DEV_AUTH_BYPASS=0.
  const envToggle = process.env.DEV_AUTH_BYPASS
  if (envToggle === '1') return true
  if (envToggle === '0') return false

  const queryOverride = req.nextUrl.searchParams.get('devAuthBypass')
  if (queryOverride === '1') return true
  if (queryOverride === '0') return false

  return process.env.NODE_ENV !== 'production'
}

function isPublicPath(pathname: string) {
  if (pathname.startsWith('/api')) return true
  if (pathname.startsWith('/_next')) return true
  if (pathname === '/favicon.ico') return true
  if (pathname === '/robots.txt') return true
  if (pathname === '/sitemap.xml') return true

  // Auth pages remain public
  if (pathname === '/login') return true
  if (pathname === '/signup') return true
  if (pathname === '/verify') return true

  return false
}

function isProtectedPath(pathname: string) {
  // Explicit protected areas
  if (pathname.startsWith('/dashboard')) return true

  // Protect the main app routes (projects, editor, etc.)
  const protectedPrefixes = [
    '/projects',
    '/editor',
    '/exports',
    '/templates',
    '/assets',
    '/settings',
    '/billing',
    '/captions',
    '/highlights',
    '/broll',
    '/team',
  ]
  return protectedPrefixes.some((p) => pathname === p || pathname.startsWith(`${p}/`))
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  if (isPublicPath(pathname)) return NextResponse.next()
  if (!isProtectedPath(pathname)) return NextResponse.next()
  if (shouldBypassAuth(req)) return NextResponse.next()

  const token = req.cookies.get('xano_token')?.value
  if (!token) {
    const url = req.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('next', pathname)
    return NextResponse.redirect(url)
  }

  // Gate by verification as well.
  try {
    const meUrl = new URL('/api/auth/me', req.nextUrl.origin)
    const cookieHeader = req.headers.get('cookie') ?? ''

    const res = await fetch(meUrl, {
      headers: {
        cookie: cookieHeader,
      },
      cache: 'no-store',
    })

    if (res.status === 401) {
      const url = req.nextUrl.clone()
      url.pathname = '/login'
      url.searchParams.set('next', pathname)
      return NextResponse.redirect(url)
    }

    const data = (await res.json()) as { user?: any }
    const user = data?.user
    const verified =
      user?.email_verified ??
      user?.emailVerified ??
      user?.verified ??
      user?.is_verified ??
      user?.isVerified

    if (verified === false) {
      const url = req.nextUrl.clone()
      url.pathname = '/verify'
      url.searchParams.set('next', pathname)
      return NextResponse.redirect(url)
    }
  } catch {
    // Fail closed: if we cannot confirm auth, redirect to login.
    const url = req.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('next', pathname)
    return NextResponse.redirect(url)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
