import { AuthShell } from '@/components/auth/AuthShell'
import { VerifyForm } from '@/components/auth/VerifyForm'
import { Suspense } from 'react'

export default function VerifyPage() {
  return (
    <AuthShell title="Check your email" subtitle="Confirm your address to unlock the workspace.">
      <Suspense fallback={null}>
        <VerifyForm />
      </Suspense>
    </AuthShell>
  )
}
