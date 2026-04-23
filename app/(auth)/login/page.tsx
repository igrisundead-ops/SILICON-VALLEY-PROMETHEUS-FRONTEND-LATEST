import { AuthShell } from '@/components/auth/AuthShell'
import { LoginForm } from '@/components/auth/LoginForm'

export default function LoginPage() {
  return (
    <AuthShell title="Sign in" subtitle="Use OAuth or your email and password.">
      <LoginForm />
    </AuthShell>
  )
}

