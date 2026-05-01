'use client'

import * as React from 'react'
import { AppleIcon, GithubIcon } from 'lucide-react'
import { useSearchParams } from 'next/navigation'

import { Button } from '@/components/ui/button'
import { normalizeNextPath } from '@/lib/auth/redirect'
import { createClient } from '@/lib/supabase/client'

import { GoogleIcon } from './auth-visuals'

type SocialProvider = 'google' | 'apple' | 'github'

const SOCIAL_OPTIONS: Array<{
  provider: SocialProvider
  label: string
  Icon: React.ComponentType<{ className?: string }>
}> = [
  { provider: 'google', label: 'Continue with Google', Icon: GoogleIcon },
  { provider: 'apple', label: 'Continue with Apple', Icon: AppleIcon },
  { provider: 'github', label: 'Continue with GitHub', Icon: GithubIcon },
]

const SUPABASE_CLIENT_READY = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
)

export function SocialAuthButtons() {
  const searchParams = useSearchParams()
  const [busyProvider, setBusyProvider] = React.useState<SocialProvider | null>(null)
  const [serverError, setServerError] = React.useState<string | null>(null)

  const nextPath = normalizeNextPath(searchParams.get('next'))

  React.useEffect(() => {
    const resetBusyState = () => {
      setBusyProvider(null)
    }

    // Browsers can restore this page from bfcache after an OAuth redirect attempt.
    window.addEventListener('pageshow', resetBusyState)

    return () => {
      window.removeEventListener('pageshow', resetBusyState)
    }
  }, [])

  const handleOAuth = React.useCallback(
    async (provider: SocialProvider) => {
      if (!SUPABASE_CLIENT_READY) {
        setServerError('Supabase client env vars are missing. Add them to .env.local first.')
        return
      }

      setBusyProvider(provider)
      setServerError(null)

      try {
        const supabase = createClient()
        const redirectTo = new URL('/auth/confirm', window.location.origin)

        if (nextPath !== '/') {
          redirectTo.searchParams.set('next', nextPath)
        }

        const { error } = await supabase.auth.signInWithOAuth({
          provider,
          options: {
            redirectTo: redirectTo.toString(),
          },
        })

        if (error) {
          throw error
        }
      } catch (error) {
        setServerError(error instanceof Error ? error.message : 'OAuth sign-in failed')
        setBusyProvider(null)
      }
    },
    [nextPath],
  )

  return (
    <div className="space-y-2">
      {SOCIAL_OPTIONS.map(({ provider, label, Icon }) => (
        <Button
          key={provider}
          type="button"
          size="lg"
          className="w-full"
          disabled={busyProvider !== null}
          onClick={() => {
            void handleOAuth(provider)
          }}
        >
          <Icon className="size-4 me-2" />
          {busyProvider === provider ? 'Redirecting...' : label}
        </Button>
      ))}

      {serverError ? <div className="text-xs text-red-500/80">{serverError}</div> : null}
    </div>
  )
}
