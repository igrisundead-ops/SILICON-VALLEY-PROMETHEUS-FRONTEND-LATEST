'use client'

import * as React from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Check, CreditCard, Info, Sparkles, Zap } from 'lucide-react'

import { StripeCheckoutButton } from '@/components/billing/stripe-checkout-button'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import {
  BILLING_DASHBOARD_PATH,
  clearBillingAccess,
  readBillingAccessState,
  setBillingAccess,
} from '@/lib/billing'
import { BILLING_PLAN_DEFINITIONS, BILLING_PLAN_ORDER } from '@/lib/billing-plans'
import { cn } from '@/lib/utils'

const PLANS = BILLING_PLAN_ORDER.map((planId) => BILLING_PLAN_DEFINITIONS[planId])

const USAGE_STATS = [
  {
    label: 'Credits used',
    value: '3,120',
    meta: 'out of 5,000 this month',
  },
  {
    label: 'Workspace seats',
    value: '4',
    meta: '1 owner, 3 collaborators',
  },
  {
    label: 'Renewal',
    value: 'May 12',
    meta: 'Next billing cycle date',
  },
]

export function BillingDashboard() {
  const searchParams = useSearchParams()
  const nextPath = searchParams.get('next')
  const [billingState, setBillingState] = React.useState(readBillingAccessState)
  const used = 62
  const currentPlan = PLANS.find((plan) => plan.id === billingState.planId) ?? PLANS[1]

  const refreshBillingState = React.useCallback(() => {
    setBillingState(readBillingAccessState())
  }, [])

  React.useEffect(() => {
    const handleFocus = () => refreshBillingState()
    const handleStorage = () => refreshBillingState()
    window.addEventListener('focus', handleFocus)
    window.addEventListener('storage', handleStorage)
    return () => {
      window.removeEventListener('focus', handleFocus)
      window.removeEventListener('storage', handleStorage)
    }
  }, [refreshBillingState])

  const hasAccess = billingState.status === 'active'

  return (
    <div className="px-4 py-5 md:px-6 md:py-6">
      <section className="overflow-hidden rounded-[30px] border border-white/12 bg-[radial-gradient(circle_at_top,rgba(63,122,255,0.16)_0%,rgba(10,10,16,0)_30%),linear-gradient(180deg,rgba(18,18,23,0.98)_0%,rgba(13,13,16,1)_100%)] p-5 shadow-[0_48px_120px_-64px_rgba(0,0,0,0.95),inset_0_1px_0_rgba(255,255,255,0.06)] md:p-7">
        <div className="flex flex-col gap-8">
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_420px]">
            <div className="space-y-4">
              <Badge className="border-[#2f8eff]/25 bg-[#2f8eff]/10 text-[#cae2ff]">Prometheus Plans</Badge>
              <div className="max-w-3xl">
                <h2 className="text-[clamp(2.2rem,4.2vw,4rem)] font-semibold leading-[0.92] tracking-[-0.04em] text-white">
                  Choose the right plan for your workspace and unlock editing access.
                </h2>
                <p className="mt-4 max-w-2xl text-sm leading-7 text-white/60 md:text-[15px]">
                  Compare plans, manage your workspace access, and activate the subscription that fits your production
                  needs.
                </p>
              </div>

              <div className="grid gap-3 md:grid-cols-3">
                {USAGE_STATS.map((stat) => (
                  <div
                    key={stat.label}
                    className="rounded-[22px] border border-white/10 bg-white/[0.03] px-4 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]"
                  >
                    <div className="text-[11px] uppercase tracking-[0.18em] text-white/38">{stat.label}</div>
                    <div className="mt-3 text-2xl font-semibold tracking-tight text-white">{stat.value}</div>
                    <div className="mt-1 text-xs text-white/48">{stat.meta}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.06)_0%,rgba(255,255,255,0.02)_100%)] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.07)]">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 text-sm font-medium text-white/86">
                    <Zap className="size-4 text-[#6ab1ff]" />
                    Billing access
                  </div>
                  <div className="mt-3 text-3xl font-semibold tracking-tight text-white">
                    {hasAccess ? currentPlan.name : 'Locked'}
                  </div>
                  <div className="mt-1 text-sm text-white/48">
                    {hasAccess
                      ? `Active ${currentPlan.name} access${billingState.activatedAt ? ` since ${new Date(billingState.activatedAt).toLocaleDateString()}` : ''}.`
                      : 'An active subscription is required before users can open or run edits.'}
                  </div>
                </div>
                <Badge
                  className={cn(
                    hasAccess
                      ? 'border-emerald-400/25 bg-emerald-400/10 text-emerald-100'
                      : 'border-amber-300/25 bg-amber-400/10 text-amber-100',
                  )}
                >
                  {hasAccess ? 'Active' : 'Payment required'}
                </Badge>
              </div>

              <div className="mt-6 rounded-[22px] border border-white/10 bg-black/20 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm text-white/70">Monthly credit usage</div>
                  <div className="text-xs tabular-nums text-white/45">{used}/100</div>
                </div>
                <div className="mt-3">
                  <Progress value={used} />
                </div>
                <div className="mt-2 text-xs text-white/42">
                  Temporary mock metric until real subscription and usage tracking are connected.
                </div>
              </div>

              <div className="mt-5 flex flex-wrap gap-2">
                <Badge variant="secondary">{hasAccess ? currentPlan.creditsLabel : 'Editor locked'}</Badge>
                <Badge variant="secondary">{hasAccess ? 'Processing unlocked' : 'Upgrade required'}</Badge>
                <Badge variant="secondary">{hasAccess ? 'Workspace enabled' : 'Billing gate active'}</Badge>
              </div>

              {hasAccess && nextPath ? (
                <div className="mt-5">
                  <Button asChild className="w-full rounded-[14px] bg-white text-black hover:bg-white/90">
                    <Link href={nextPath}>Continue to workspace</Link>
                  </Button>
                </div>
              ) : null}
            </div>
          </div>

          <div className="grid gap-5 xl:grid-cols-3">
            {PLANS.map((plan) => (
              <article
                key={plan.id}
                className={cn(
                  'group relative overflow-hidden rounded-[30px] border bg-[linear-gradient(180deg,#17181a_0%,#111214_100%)] p-6 shadow-[0_36px_84px_-56px_rgba(0,0,0,0.95),inset_0_1px_0_rgba(255,255,255,0.05)] transition-transform duration-300 hover:-translate-y-1',
                  plan.featured ? 'border-[#4a9eff]/28' : 'border-white/10',
                )}
              >
                <div
                  aria-hidden
                  className={cn(
                    'pointer-events-none absolute inset-x-0 top-0 h-40 bg-gradient-to-b opacity-90 blur-3xl',
                    `bg-gradient-to-b ${plan.accent}`,
                  )}
                />

                <div className="relative z-10 flex h-full flex-col">
                  <div className="flex items-start justify-between gap-3">
                    <div className="text-[2rem] font-semibold tracking-tight text-white">{plan.name}</div>
                    {plan.featured ? (
                      <Badge className="border-[#4da1ff]/30 bg-[#4da1ff]/10 text-[#d8ecff]">Best for teams</Badge>
                    ) : null}
                  </div>

                  <div className="mt-7 flex items-end gap-1 text-white">
                    <span className="text-[3.4rem] font-semibold leading-none tracking-[-0.06em]">{plan.priceWhole}</span>
                    <span className="pb-2 text-[1.5rem] font-semibold text-[#c8d5e3]">{plan.priceFraction}</span>
                    <span className="pb-2 text-[1.65rem] text-[#91a4bc]">{plan.monthlyLabel}</span>
                  </div>

                  <div className="mt-6 inline-flex items-center gap-3 rounded-full border border-[#2c76c7]/24 bg-[#102131] px-3 py-2 text-[1rem] font-semibold text-white">
                    <span className="grid size-6 place-items-center rounded-full bg-[#1d84ff]">
                      <Sparkles className="size-3.5 text-white" />
                    </span>
                    <span>{plan.creditsLabel}</span>
                  </div>

                  <div className="mt-7 space-y-4">
                    {plan.features.map((feature) => (
                      <div key={feature.label} className="flex items-start gap-3 text-white/74">
                        <Check className="mt-[3px] size-4 shrink-0 text-white/80" />
                        <div className="min-w-0">
                          <div className={cn('text-[1.02rem] leading-7', feature.emphasized && 'font-medium text-white')}>
                            {feature.label}
                            {feature.hint ? <Info className="ml-2 inline size-3.5 text-white/42" /> : null}
                          </div>
                          {feature.hint ? <div className="text-sm leading-6 text-white/42">{feature.hint}</div> : null}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="mt-8">
                    {plan.contactOnly ? (
                      <Button
                        asChild
                        size="lg"
                        className="h-12 w-full rounded-[14px] bg-[#1782ff] text-lg font-semibold text-white hover:bg-[#2a8cff]"
                      >
                        <a href="mailto:sales@prometheus.ai?subject=Prometheus%20Cinema%20Plan">{plan.ctaLabel}</a>
                      </Button>
                    ) : (
                      <StripeCheckoutButton planId={plan.id} nextPath={nextPath} ctaLabel={plan.ctaLabel} />
                    )}
                  </div>
                </div>
              </article>
            ))}
          </div>

          {process.env.NODE_ENV === 'development' ? (
            <div className="rounded-[26px] border border-white/10 bg-white/[0.03] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <div className="text-sm font-semibold text-white/88">Local billing access controls</div>
                  <div className="mt-1 text-sm text-white/50">
                    Development-only shortcut so you can test the editor lock before Stripe is connected.
                  </div>
                </div>
                <Badge variant="secondary">Dev only</Badge>
              </div>

              <div className="mt-4 flex flex-wrap gap-3">
                {PLANS.map((plan) => (
                  <Button
                    key={`activate-${plan.id}`}
                    variant="outline"
                    className="border-white/12 bg-white/[0.03] text-white hover:bg-white/[0.06]"
                    onClick={() => {
                      setBillingAccess(plan.id, 'demo')
                      refreshBillingState()
                    }}
                  >
                    Unlock {plan.name}
                  </Button>
                ))}

                <Button
                  variant="outline"
                  className="border-white/12 bg-white/[0.03] text-white hover:bg-white/[0.06]"
                  onClick={() => {
                    clearBillingAccess()
                    refreshBillingState()
                  }}
                >
                  Reset to unpaid
                </Button>
              </div>
            </div>
          ) : null}

          <div className="flex flex-col gap-3 rounded-[24px] border border-white/10 bg-white/[0.03] px-5 py-4 text-sm text-white/54 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-2">
              <CreditCard className="size-4 text-white/55" />
              Stripe-hosted checkout is wired in for subscription plans. The final production step is persisting
              webhook-driven access on the server.
            </div>
            <div className="text-xs uppercase tracking-[0.18em] text-white/35">
              Billing route: {BILLING_DASHBOARD_PATH}
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
