import { BillingSuccessPanel } from '@/components/billing/billing-success-panel'
import { PageHeader } from '@/components/page-header'
import { PrometheusShell } from '@/components/prometheus-shell'
import { Badge } from '@/components/ui/badge'
import { Suspense } from 'react'

export default function BillingSuccessPage() {
  return (
    <PrometheusShell
      header={
        <PageHeader
          title="Billing Confirmed"
          description="Stripe returned from checkout. We are validating the subscription and restoring workspace access."
          actions={
            <Badge variant="secondary" className="border-[#5ea8ff]/25 bg-[#5ea8ff]/10 text-[#cfe6ff]">
              Stripe checkout
            </Badge>
          }
        />
      }
    >
      <Suspense fallback={null}>
        <BillingSuccessPanel />
      </Suspense>
    </PrometheusShell>
  )
}
