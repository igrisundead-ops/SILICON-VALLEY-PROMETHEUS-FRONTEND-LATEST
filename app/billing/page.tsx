'use client'

import { CreditCard, Zap } from 'lucide-react'

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
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'

export default function BillingPage() {
  const used = 62

  return (
    <PrometheusShell
      header={<PageHeader title="Usage & Billing" description="UI scaffolding only — no paid API wiring." />}
    >
      <div className="px-8 py-6 grid gap-4 lg:grid-cols-[1fr_420px]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="size-4 text-white/60" />
              Usage
            </CardTitle>
            <CardDescription>Monthly credits (mock).</CardDescription>
          </CardHeader>
          <CardContent className="pt-0 space-y-4">
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm font-medium text-white/85">Processing minutes</div>
                <div className="text-xs text-white/45 tabular-nums">{used}/100</div>
              </div>
              <div className="mt-3">
                <Progress value={used} />
              </div>
              <div className="mt-2 text-xs text-white/45">
                UI-only. Hook up server-side usage later.
              </div>
            </div>

            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-medium text-white/85">Current plan</div>
                  <div className="mt-1 text-xs text-white/45">Starter (mock)</div>
                </div>
                <Badge variant="secondary">Mock</Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="h-fit">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="size-4 text-white/60" />
              Plans
            </CardTitle>
            <CardDescription>Upgrade CTA only.</CardDescription>
          </CardHeader>
          <CardContent className="pt-0 space-y-3">
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm font-semibold text-white/90">Starter</div>
                <Badge variant="secondary">$0</Badge>
              </div>
              <div className="mt-2 text-xs text-white/45">
                Limited exports · Basic templates · Local mock pipeline
              </div>
            </div>
            <div className="rounded-xl border border-purple-400/30 bg-gradient-to-br from-purple-500/12 via-white/[0.02] to-fuchsia-500/10 p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm font-semibold text-white/90">Pro</div>
                <Badge variant="success">Popular</Badge>
              </div>
              <div className="mt-2 text-xs text-white/45">
                Premium export presets · Team workflows · Brand kit automation
              </div>
              <div className="mt-4">
                <Button className="w-full bg-white text-black hover:bg-white/90">
                  Upgrade (Mock)
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </PrometheusShell>
  )
}

