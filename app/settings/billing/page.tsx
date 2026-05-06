import { Suspense } from 'react'

import { BillingDashboard } from '@/components/billing/billing-dashboard'
import { PageHeader } from '@/components/page-header'
import { PrometheusShell } from '@/components/prometheus-shell'
import { Badge } from '@/components/ui/badge'

export default function SettingsBillingPage() {
  return (
    <PrometheusShell
      header={
        <PageHeader
          title="Billing & Access"
          description="Manage subscription status, pricing, and editor access from Settings."
          actions={
            <Badge variant="secondary" className="border-[#5ea8ff]/25 bg-[#5ea8ff]/10 text-[#cfe6ff]">
              Settings tab
            </Badge>
          }
        />
      }
    >
      <Suspense fallback={null}>
        <BillingDashboard />
      </Suspense>
    </PrometheusShell>
  )
}
