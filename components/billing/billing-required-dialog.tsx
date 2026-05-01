'use client'

import * as React from 'react'
import { AlertTriangle, ArrowRight, CreditCard } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

type BillingRequiredDialogProps = {
  open: boolean
  redirectHref: string
  contextLabel?: string
}

const REDIRECT_DELAY_SECONDS = 4

export function BillingRequiredDialog({
  open,
  redirectHref,
  contextLabel = 'Editing access',
}: BillingRequiredDialogProps) {
  const [secondsLeft, setSecondsLeft] = React.useState(REDIRECT_DELAY_SECONDS)

  React.useEffect(() => {
    if (!open) return

    setSecondsLeft(REDIRECT_DELAY_SECONDS)

    const intervalId = window.setInterval(() => {
      setSecondsLeft((current) => {
        if (current <= 1) {
          window.clearInterval(intervalId)
          window.location.assign(redirectHref)
          return 0
        }

        return current - 1
      })
    }, 1000)

    return () => window.clearInterval(intervalId)
  }, [open, redirectHref])

  return (
    <Dialog open={open}>
      <DialogContent className="max-w-[520px] border-white/12 bg-[#0e1016]/95 text-white">
        <DialogHeader>
          <div className="inline-flex size-12 items-center justify-center rounded-2xl border border-amber-300/18 bg-amber-400/10 text-amber-200">
            <AlertTriangle className="size-5" />
          </div>
          <DialogTitle className="pt-4 text-2xl tracking-tight">{contextLabel} is locked</DialogTitle>
          <DialogDescription className="text-sm leading-7 text-white/62">
            You need an active paid plan before you can run or open edits. We&apos;re redirecting you to the billing
            dashboard so you can subscribe and unlock the editor.
          </DialogDescription>
        </DialogHeader>

        <div className="mx-6 rounded-[22px] border border-white/10 bg-white/[0.03] px-4 py-4">
          <div className="flex items-center gap-3 text-sm text-white/78">
            <CreditCard className="size-4 text-[#67afff]" />
            Redirecting to billing in {secondsLeft}s
          </div>
        </div>

        <DialogFooter className="pt-4">
          <Button
            size="lg"
            className="h-11 w-full rounded-[14px] bg-[#1782ff] text-white hover:bg-[#2b8cff]"
            onClick={() => {
              window.location.assign(redirectHref)
            }}
          >
            Go to Billing
            <ArrowRight className="size-4" />
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
