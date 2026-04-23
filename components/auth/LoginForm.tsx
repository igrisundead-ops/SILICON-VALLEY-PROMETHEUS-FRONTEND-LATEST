'use client'

import * as React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { AtSignIcon, LockIcon } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

function isValidEmail(email: string) {
  return email.includes('@')
}

export function LoginForm() {
  const router = useRouter()
  const [email, setEmail] = React.useState('')
  const [password, setPassword] = React.useState('')
  const [submitting, setSubmitting] = React.useState(false)
  const [serverError, setServerError] = React.useState<string | null>(null)

  const [errors, setErrors] = React.useState<{ email?: string; password?: string }>({})

  const validate = () => {
    const next: typeof errors = {}
    if (!email.trim() || !isValidEmail(email)) next.email = 'Enter a valid email.'
    if (!password || password.length < 8) next.password = 'Password must be at least 8 characters.'
    setErrors(next)
    return Object.keys(next).length === 0
  }

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault()
        setServerError(null)
        if (!validate()) return
        setSubmitting(true)
        window.setTimeout(async () => {
          try {
            const res = await fetch('/api/auth/login', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ email, password }),
            })
            const data = (await res.json()) as { user?: unknown; requiresVerification?: boolean; error?: string }
            if (!res.ok) throw new Error(data.error || 'Login failed')
            console.log('login', { email })
            router.push(data.requiresVerification ? '/verify' : '/')
          } catch (err) {
            setServerError(err instanceof Error ? err.message : 'Login failed')
          } finally {
            setSubmitting(false)
          }
        }, 800)
      }}
      className="space-y-4"
    >
      <div>
        <label className="text-sm font-medium" htmlFor="login-email">
          Email
        </label>
        <div className="mt-2 relative">
          <AtSignIcon className="text-muted-foreground absolute start-3 top-1/2 size-4 -translate-y-1/2" />
          <Input
            id="login-email"
            type="email"
            placeholder="you@domain.com"
            className="peer ps-9"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
          />
        </div>
        {errors.email ? (
          <div className="mt-1 text-xs text-red-500/80">{errors.email}</div>
        ) : null}
      </div>

      <div>
        <label className="text-sm font-medium" htmlFor="login-password">
          Password
        </label>
        <div className="mt-2 relative">
          <LockIcon className="text-muted-foreground absolute start-3 top-1/2 size-4 -translate-y-1/2" />
          <Input
            id="login-password"
            type="password"
            placeholder="Your password"
            className="peer ps-9"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
          />
        </div>
        {errors.password ? (
          <div className="mt-1 text-xs text-red-500/80">{errors.password}</div>
        ) : null}
      </div>

      <div className="flex items-center justify-between">
        <div />
        <Link href="/forgot-password" className="text-muted-foreground text-sm hover:text-primary underline underline-offset-4">
          Forgot password?
        </Link>
      </div>

      {serverError ? <div className="text-xs text-red-500/80">{serverError}</div> : null}

      <Button
        type="submit"
        size="lg"
        className="w-full"
        disabled={submitting}
      >
        {submitting ? 'Signing in...' : 'Sign in'}
      </Button>

      <div className="text-muted-foreground text-sm">
        Don&apos;t have an account?{' '}
        <Link
          href="/signup"
          className="hover:text-primary underline underline-offset-4"
        >
          Sign up
        </Link>
      </div>
    </form>
  )
}
