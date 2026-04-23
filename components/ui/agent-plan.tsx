'use client'

import * as React from 'react'
import { motion } from 'framer-motion'
import { CheckCircle2, Circle, Loader2, XCircle } from 'lucide-react'

import { useStableReducedMotion } from '@/hooks/use-stable-reduced-motion'
import { cn } from '@/lib/utils'

export type PlanStatus = 'pending' | 'running' | 'completed' | 'error'

export interface PlanItem {
  id: string
  title: string
  status: PlanStatus
  progress?: number
  meta?: string
}

export interface PlanProps {
  items: PlanItem[]
  className?: string
}

export function Plan({ items, className }: PlanProps) {
  const reduced = useStableReducedMotion()

  return (
    <div className={cn('space-y-3', className)}>
      {items.map((item) => {
        const icon =
          item.status === 'completed' ? (
            <CheckCircle2 className="size-4 text-emerald-300" />
          ) : item.status === 'error' ? (
            <XCircle className="size-4 text-red-300" />
          ) : item.status === 'running' ? (
            <Loader2 className="size-4 text-white/70 animate-spin" />
          ) : (
            <Circle className="size-4 text-white/25" />
          )

        const progress = Math.max(0, Math.min(1, item.progress ?? (item.status === 'completed' ? 1 : 0)))

        return (
          <div
            key={item.id}
            className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 backdrop-blur-sm"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                {icon}
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium text-white/90">
                    {item.title}
                  </div>
                  {item.meta ? (
                    <div className="truncate text-xs text-white/45">{item.meta}</div>
                  ) : null}
                </div>
              </div>
              <div className="text-xs tabular-nums text-white/40">
                {item.status === 'completed'
                  ? '100%'
                  : item.status === 'running'
                    ? `${Math.round(progress * 100)}%`
                    : ''}
              </div>
            </div>

            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10">
              {reduced ? (
                <div
                  className="h-full bg-gradient-to-r from-violet-400/70 via-indigo-400/70 to-fuchsia-400/70"
                  style={{ width: `${Math.round(progress * 100)}%` }}
                />
              ) : (
                <motion.div
                  className="h-full bg-gradient-to-r from-violet-400/70 via-indigo-400/70 to-fuchsia-400/70"
                  initial={false}
                  animate={{ width: `${Math.round(progress * 100)}%` }}
                  transition={{ type: 'spring', stiffness: 120, damping: 18 }}
                />
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
