'use client'

import * as React from 'react'
import Link from 'next/link'
import { Bell, Link2, Shield } from 'lucide-react'

import { PrometheusShell } from '@/components/prometheus-shell'
import { PageHeader } from '@/components/page-header'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'

export default function SettingsPage() {
  const [reducedMotion, setReducedMotion] = React.useState(false)
  const [notifications, setNotifications] = React.useState(true)
  const [safeMode, setSafeMode] = React.useState(true)
  const [signingOut, setSigningOut] = React.useState(false)

  return (
    <PrometheusShell
      header={<PageHeader title="Settings" description="Preferences and integrations (UI scaffolding)." />}
    >
      <div className="px-8 py-6 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="size-4 text-white/60" />
              Notifications
            </CardTitle>
            <CardDescription>Mock toggles for future alerts.</CardDescription>
          </CardHeader>
          <CardContent className="pt-0 space-y-3">
            <div className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-4">
              <div>
                <div className="text-sm font-medium text-white/85">Processing completion</div>
                <div className="mt-1 text-xs text-white/45">Notify when edits are ready.</div>
              </div>
              <Switch checked={notifications} onCheckedChange={setNotifications} />
            </div>
            <div className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-4">
              <div>
                <div className="text-sm font-medium text-white/85">Reduced motion override</div>
                <div className="mt-1 text-xs text-white/45">UI-only. Respects system preference by default.</div>
              </div>
              <Switch checked={reducedMotion} onCheckedChange={setReducedMotion} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Link2 className="size-4 text-white/60" />
              Integrations
            </CardTitle>
            <CardDescription>Mock connect states.</CardDescription>
          </CardHeader>
          <CardContent className="pt-0 space-y-3">
            <div className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-4">
              <div className="min-w-0">
                <div className="text-sm font-medium text-white/85">Google Drive</div>
                <div className="mt-1 text-xs text-white/45 truncate">Connect to import sources.</div>
              </div>
              <Badge variant="secondary">Mock</Badge>
            </div>
            <div className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-4">
              <div className="min-w-0">
                <div className="text-sm font-medium text-white/85">Dropbox</div>
                <div className="mt-1 text-xs text-white/45 truncate">Connect to import sources.</div>
              </div>
              <Badge variant="secondary">Mock</Badge>
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="size-4 text-white/60" />
              Billing & access
            </CardTitle>
            <CardDescription>Where users manage payment and unlock editing rights.</CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="flex flex-col gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="text-sm font-medium text-white/85">Editor access is subscription-gated</div>
                <div className="mt-1 text-xs text-white/45">
                  Unpaid users are redirected here before they can open or run edits.
                </div>
              </div>
              <Button asChild>
                <Link href="/settings/billing">Open billing</Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="size-4 text-white/60" />
              Safety
            </CardTitle>
            <CardDescription>Editing guardrails (UI only).</CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-4">
              <div>
                <div className="text-sm font-medium text-white/85">Safe mode</div>
                <div className="mt-1 text-xs text-white/45">Conservative pacing and captioning.</div>
              </div>
              <Switch checked={safeMode} onCheckedChange={setSafeMode} />
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Account</CardTitle>
            <CardDescription>Session controls for the current workspace login.</CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="flex flex-col gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="text-sm font-medium text-white/85">Signed-in session</div>
                <div className="mt-1 text-xs text-white/45">Sign out here if you want to switch accounts.</div>
              </div>
              <Button
                variant="outline"
                disabled={signingOut}
                onClick={async () => {
                  setSigningOut(true)

                  try {
                    await fetch('/api/auth/logout', { method: 'POST' })
                  } finally {
                    window.location.assign('/login')
                  }
                }}
              >
                {signingOut ? 'Signing out...' : 'Sign out'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </PrometheusShell>
  )
}

