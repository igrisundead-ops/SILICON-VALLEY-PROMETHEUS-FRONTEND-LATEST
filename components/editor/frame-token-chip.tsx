'use client'

import * as React from 'react'
import { motion } from 'framer-motion'

import { useStableReducedMotion } from '@/hooks/use-stable-reduced-motion'
import { cn } from '@/lib/utils'

type FrameTokenChipProps = {
  label: string
  sublabel?: string | null
  icon?: React.ReactNode
  tone?: 'blue' | 'neutral' | 'rose'
  selected?: boolean
  className?: string
}

const TONE_CLASSES: Record<NonNullable<FrameTokenChipProps['tone']>, string> = {
  blue: 'border-[#7ff2d4]/22 bg-[linear-gradient(180deg,rgba(60,144,255,0.92)_0%,rgba(36,112,230,0.9)_100%)] text-white shadow-[0_16px_34px_-22px_rgba(73,153,255,0.72),0_0_24px_rgba(127,242,212,0.18)]',
  neutral:
    'border-white/10 bg-white/[0.05] text-white/72 shadow-[0_14px_28px_-22px_rgba(0,0,0,0.68)]',
  rose:
    'border-rose-300/16 bg-[linear-gradient(180deg,rgba(115,24,42,0.9)_0%,rgba(69,14,25,0.88)_100%)] text-rose-50 shadow-[0_16px_30px_-22px_rgba(153,27,50,0.36)]',
}

export function FrameTokenChip({
  label,
  sublabel,
  icon,
  tone = 'blue',
  selected = true,
  className,
}: FrameTokenChipProps) {
  const reduceMotion = useStableReducedMotion()

  return (
    <motion.span
      initial={reduceMotion ? false : { opacity: 0, y: 2, scale: 0.98 }}
      animate={reduceMotion ? undefined : { opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: reduceMotion ? 0 : 0.22, ease: [0.22, 1, 0.36, 1] }}
      className={cn(
        'inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[11px] font-medium tracking-[0.01em] backdrop-blur-md',
        selected ? TONE_CLASSES[tone] : 'border-white/8 bg-white/[0.04] text-white/58',
        className,
      )}
    >
      {icon ? <span className="flex items-center justify-center">{icon}</span> : null}
      <span>{label}</span>
      {sublabel ? <span className="text-white/62">{sublabel}</span> : null}
    </motion.span>
  )
}
