import { AuthShell } from '@/components/auth/AuthShell'
import { ResetPasswordForm } from '@/components/auth/ResetPasswordForm'

export default function ResetPasswordPage() {
  return (
    <AuthShell title="Create a new password" subtitle="Choose a strong password for your workspace.">
      <ResetPasswordForm />
    </AuthShell>
  )
}
