'use client'

import * as React from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export function VerifyForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get('token') ?? undefined

  const [email, setEmail] = React.useState('')
  const [code, setCode] = React.useState('')
  const [submitting, setSubmitting] = React.useState(false)
  const [serverError, setServerError] = React.useState<string | null>(null)
  const [success, setSuccess] = React.useState(false)

  const verify = React.useCallback(
    async (payload: { token?: string; code?: string }) => {
      setServerError(null)
      setSubmitting(true)
      window.setTimeout(() => {
        ;(async () => {
          try {
            const res = await fetch('/api/auth/verify', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload),
            })
            const data = (await res.json()) as { error?: string }
            if (!res.ok) throw new Error(data.error || 'Verification failed')
            setSuccess(true)
            router.push('/')
          } catch (err) {
            setServerError(err instanceof Error ? err.message : 'Verification failed')
          } finally {
            setSubmitting(false)
          }
        })()
      }, 800)
    },
    [router]
  )

  React.useEffect(() => {
    if (!token) return
    verify({ token })
  }, [token, verify])

  return (
    <div className="space-y-4">
      <p className="text-muted-foreground text-sm">
        Enter the verification code from your email, or open the verification link you received.
      </p>

      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault()
          const trimmed = code.trim()
          if (!trimmed) {
            setServerError('Enter your verification code.')
            return
          }
          verify({ code: trimmed })
        }}
      >
        <div>
          <label className="text-sm font-medium" htmlFor="verify-code">
            Verification code
          </label>
          <div className="mt-2 relative">
            <Input
              id="verify-code"
              type="text"
              placeholder="123456"
              className="peer"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              autoComplete="one-time-code"
              inputMode="numeric"
            />
          </div>
        </div>

        {serverError ? <div className="text-xs text-red-500/80">{serverError}</div> : null}
        {success ? <div className="text-xs text-emerald-500/90">Verified. Redirecting...</div> : null}

        <Button type="submit" size="lg" className="w-full" disabled={submitting}>
          {submitting ? 'Verifying...' : 'Verify email'}
        </Button>
      </form>

      <div className="space-y-2">
        <div className="text-sm font-medium">Resend verification</div>
        <div className="text-muted-foreground text-sm">If you did not receive an email, resend it.</div>
        <div className="flex gap-2">
          <Input
            type="email"
            placeholder="you@domain.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
          />
          <Button
            type="button"
            variant="outline"
            disabled={submitting || !email.trim()}
            onClick={async () => {
              setServerError(null)
              try {
                const res = await fetch('/api/auth/resend-verification', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ email }),
                })
                const data = (await res.json()) as { error?: string }
                if (!res.ok) throw new Error(data.error || 'Resend failed')
              } catch (err) {
                setServerError(err instanceof Error ? err.message : 'Resend failed')
              }
            }}
          >
            Resend
          </Button>
        </div>
      </div>
    </div>
  )
}
