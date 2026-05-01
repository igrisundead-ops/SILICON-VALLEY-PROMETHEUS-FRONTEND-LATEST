'use client'

import * as React from 'react'
import { usePathname } from 'next/navigation'

import { BillingRequiredDialog } from '@/components/billing/billing-required-dialog'
import { EditorLoadingScreen } from '@/components/editor/editor-loading-screen'
import { buildBillingHref, hasBillingAccess } from '@/lib/billing'

export default function EditorLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [billingResolved, setBillingResolved] = React.useState(false)
  const [billingAllowed, setBillingAllowed] = React.useState(false)

  React.useEffect(() => {
    const allowed = hasBillingAccess()
    setBillingAllowed(allowed)
    setBillingResolved(true)
  }, [])

  if (!billingResolved) {
    return <EditorLoadingScreen caption="Checking billing access..." />
  }

  if (!billingAllowed) {
    return (
      <>
        <EditorLoadingScreen caption="Billing required before editing..." />
        <BillingRequiredDialog open redirectHref={buildBillingHref(pathname)} contextLabel="Editor access" />
      </>
    )
  }

  return <>{children}</>
}
