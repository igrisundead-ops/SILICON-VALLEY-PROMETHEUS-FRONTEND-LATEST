'use client'

import * as React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { AtSignIcon, LockIcon, UserIcon } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

function isValidEmail(email: string) {
  return email.includes('@')
}

export function SignupForm() {
  const router = useRouter()
  const [name, setName] = React.useState('')
  const [email, setEmail] = React.useState('')
  const [password, setPassword] = React.useState('')
  const [confirmPassword, setConfirmPassword] = React.useState('')
  const [submitting, setSubmitting] = React.useState(false)
  const [serverError, setServerError] = React.useState<string | null>(null)

  const [errors, setErrors] = React.useState<{
    name?: string
    email?: string
    password?: string
    confirmPassword?: string
  }>({})

  const validate = () => {
    const next: typeof errors = {}
    if (!name.trim()) next.name = 'Full name is required.'
    if (!email.trim() || !isValidEmail(email)) next.email = 'Enter a valid email.'
    if (!password || password.length < 8) next.password = 'Password must be at least 8 characters.'
    if (confirmPassword !== password) next.confirmPassword = 'Passwords must match.'
    setErrors(next)
    return Object.keys(next).length === 0
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        setServerError(null)
        if (!validate()) return
        setSubmitting(true)
        window.setTimeout(() => {
          ;(async () => {
            try {
              const res = await fetch('/api/auth/signup', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ fullName: name, email, password }),
              })
              const data = (await res.json()) as {
                user?: unknown
                requiresVerification?: boolean
                error?: string
              }
              if (!res.ok) throw new Error(data.error || 'Signup failed')
              console.log('signup', { email })
              if (data.requiresVerification) return router.push('/verify')
              router.push('/')
            } catch (err) {
              setServerError(err instanceof Error ? err.message : 'Signup failed')
            } finally {
              setSubmitting(false)
            }
          })()
        }, 800)
      }}
      className="space-y-4"
    >
      <div>
        <label className="text-sm font-medium" htmlFor="signup-name">
          Full name
        </label>
        <div className="mt-2 relative">
          <UserIcon className="text-muted-foreground absolute start-3 top-1/2 size-4 -translate-y-1/2" />
          <Input
            id="signup-name"
            type="text"
            placeholder="Your name"
            className="peer ps-9"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="name"
          />
        </div>
        {errors.name ? (
          <div className="mt-1 text-xs text-red-500/80">{errors.name}</div>
        ) : null}
      </div>

      <div>
        <label className="text-sm font-medium" htmlFor="signup-email">
          Email
        </label>
        <div className="mt-2 relative">
          <AtSignIcon className="text-muted-foreground absolute start-3 top-1/2 size-4 -translate-y-1/2" />
          <Input
            id="signup-email"
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
        <label className="text-sm font-medium" htmlFor="signup-password">
          Password
        </label>
        <div className="mt-2 relative">
          <LockIcon className="text-muted-foreground absolute start-3 top-1/2 size-4 -translate-y-1/2" />
          <Input
            id="signup-password"
            type="password"
            placeholder="Create a password"
            className="peer ps-9"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
          />
        </div>
        {errors.password ? (
          <div className="mt-1 text-xs text-red-500/80">{errors.password}</div>
        ) : null}
      </div>

      <div>
        <label className="text-sm font-medium" htmlFor="signup-confirm">
          Confirm password
        </label>
        <div className="mt-2 relative">
          <LockIcon className="text-muted-foreground absolute start-3 top-1/2 size-4 -translate-y-1/2" />
          <Input
            id="signup-confirm"
            type="password"
            placeholder="Repeat your password"
            className="peer ps-9"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            autoComplete="new-password"
          />
        </div>
        {errors.confirmPassword ? (
          <div className="mt-1 text-xs text-red-500/80">{errors.confirmPassword}</div>
        ) : null}
      </div>

      <Button
        type="submit"
        size="lg"
        className="w-full"
        disabled={submitting}
      >
        {submitting ? 'Creating account...' : 'Create account'}
      </Button>

      {serverError ? <div className="text-xs text-red-500/80">{serverError}</div> : null}

      <div className="text-muted-foreground text-sm">
        Already have an account?{' '}
        <Link
          href="/login"
          className="hover:text-primary underline underline-offset-4"
        >
          Sign in
        </Link>
      </div>
    </form>
  )
}
