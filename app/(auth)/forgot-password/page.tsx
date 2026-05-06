import { AuthShell } from '@/components/auth/AuthShell'
import { ForgotPasswordForm } from '@/components/auth/ForgotPasswordForm'
import { Suspense } from 'react'

export default function ForgotPasswordPage() {
  return (
    <AuthShell title="Reset password" subtitle="We will email you a secure recovery link.">
      <Suspense fallback={null}>
        <ForgotPasswordForm />
      </Suspense>
    </AuthShell>
  )
}
