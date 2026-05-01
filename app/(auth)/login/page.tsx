import { AuthShell } from '@/components/auth/AuthShell'
import { LoginForm } from '@/components/auth/LoginForm'
import { Suspense } from 'react'

export default function LoginPage() {
  return (
    <AuthShell title="Sign in" subtitle="Use OAuth or your email and password.">
      <Suspense fallback={null}>
        <LoginForm />
      </Suspense>
    </AuthShell>
  )
}

