import { AuthShell } from '@/components/auth/AuthShell'
import { SignupForm } from '@/components/auth/SignupForm'
import { Suspense } from 'react'

export default function SignupPage() {
  return (
    <AuthShell title="Create account" subtitle="Create a new account in under a minute.">
      <Suspense fallback={null}>
        <SignupForm />
      </Suspense>
    </AuthShell>
  )
}

