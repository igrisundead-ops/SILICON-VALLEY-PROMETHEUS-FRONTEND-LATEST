'use client'

import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

export function RenderProcessingScroller({
  active,
  className,
}: {
  active: boolean
  className?: string
}) {
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-[24px] border border-white/10 bg-[linear-gradient(180deg,rgba(17,19,25,0.94)_0%,rgba(9,10,14,0.98)_100%)] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]',
        className,
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <Badge
          variant="outline"
          className={cn(
            'border-white/12 bg-white/[0.04] px-3 py-1 text-[10px] uppercase tracking-[0.22em] text-white/70',
            active && 'border-[#ff9a73]/28 bg-[#ff9a73]/10 text-[#ffd7cd]',
          )}
        >
          Render Signal
        </Badge>
        <div className="text-[10px] uppercase tracking-[0.22em] text-white/42">
          {active ? 'Live treatment' : 'Standby'}
        </div>
      </div>

      <div className="relative mt-4 overflow-hidden rounded-[20px] border border-white/10 bg-[#06080d]">
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.02)_0%,rgba(255,255,255,0)_18%,rgba(0,0,0,0.42)_100%),radial-gradient(circle_at_22%_22%,rgba(255,110,84,0.08)_0%,rgba(255,110,84,0)_24%),radial-gradient(circle_at_78%_12%,rgba(108,128,255,0.08)_0%,rgba(108,128,255,0)_22%)]" />

        <div className="relative z-10 p-4">
          <div className="rounded-[18px] border border-white/10 bg-black/22 p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="h-2 w-24 rounded-full bg-white/10" />
              <div className={cn('h-2 w-2 rounded-full bg-white/18', active && 'bg-[#ffd7cd] shadow-[0_0_12px_rgba(255,154,115,0.35)]')} />
            </div>

            <div className="mt-4 rounded-[16px] border border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.03)_0%,rgba(255,255,255,0.01)_100%)] p-4">
              <div className="grid gap-3">
                <div className="flex items-center gap-3">
                  <div className={cn('h-8 w-8 rounded-full border border-white/10 bg-white/[0.04]', active && 'border-[#ff9a73]/22 bg-[#ff9a73]/10')} />
                  <div className="h-2 flex-1 rounded-full bg-white/8" />
                </div>
                <div className="flex items-center gap-3">
                  <div className="h-2 w-16 rounded-full bg-white/8" />
                  <div className={cn('h-2 flex-1 rounded-full bg-white/6', active && 'bg-[linear-gradient(90deg,rgba(255,154,115,0.14)_0%,rgba(255,255,255,0.05)_100%)]')} />
                </div>
                <div className="flex items-center gap-3">
                  <div className="h-2 w-10 rounded-full bg-white/7" />
                  <div className="h-2 flex-1 rounded-full bg-white/8" />
                </div>
              </div>

              <div className="mt-5 flex flex-wrap gap-2">
                <span className="h-7 w-24 rounded-full border border-white/8 bg-white/[0.03]" />
                <span className="h-7 w-20 rounded-full border border-white/8 bg-white/[0.03]" />
                <span className="h-7 w-28 rounded-full border border-white/8 bg-white/[0.03]" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
