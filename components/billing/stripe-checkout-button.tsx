'use client'

import * as React from 'react'
import { ArrowUpRight } from 'lucide-react'
import { toast } from 'sonner'

import type { BillingPlanId } from '@/lib/billing'
import { cn } from '@/lib/utils'

import { Button } from '@/components/ui/button'

type StripeCheckoutButtonProps = {
  planId: BillingPlanId
  nextPath?: string | null
  ctaLabel: string
  className?: string
}

export function StripeCheckoutButton({ planId, nextPath, ctaLabel, className }: StripeCheckoutButtonProps) {
  const [isLoading, setIsLoading] = React.useState(false)

  return (
    <Button
      size="lg"
      disabled={isLoading}
      className={cn('h-12 w-full rounded-[14px] bg-[#1782ff] text-lg font-semibold text-white hover:bg-[#2a8cff]', className)}
      onClick={async () => {
        try {
          setIsLoading(true)

          const response = await fetch('/api/billing/checkout', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              planId,
              nextPath,
            }),
          })

          const data = (await response.json().catch(() => null)) as { error?: string; url?: string } | null

          if (!response.ok || !data?.url) {
            throw new Error(data?.error ?? 'Unable to start Stripe checkout.')
          }

          window.location.assign(data.url)
        } catch (error) {
          toast.error(error instanceof Error ? error.message : 'Unable to start Stripe checkout.')
          setIsLoading(false)
        }
      }}
    >
      {isLoading ? 'Opening checkout...' : ctaLabel}
      <ArrowUpRight className="size-4" />
    </Button>
  )
}
