'use client'

import * as React from 'react'
import { motion, useReducedMotion } from 'framer-motion'

import { cn } from '@/lib/utils'

export interface FlipTextRevealProps {
  text: string
  className?: string
}

export function FlipTextReveal({ text, className }: FlipTextRevealProps) {
  const reduced = useReducedMotion()
  const parts = React.useMemo(() => text.split(''), [text])

  if (reduced) {
    return (
      <div className={cn('text-3xl font-semibold tracking-tight text-white', className)}>
        {text}
      </div>
    )
  }

  return (
    <div
      className={cn(
        'flex flex-wrap items-baseline gap-x-0.5 text-3xl font-semibold tracking-tight text-white',
        className,
      )}
    >
      {parts.map((ch, i) => (
        <motion.span
          key={`${ch}-${i}`}
          className={cn(ch === ' ' ? 'w-2' : '')}
          initial={{ rotateX: 90, opacity: 0, y: 8 }}
          animate={{ rotateX: 0, opacity: 1, y: 0 }}
          transition={{ delay: i * 0.02, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          style={{ transformOrigin: '50% 70%' }}
        >
          {ch}
        </motion.span>
      ))}
    </div>
  )
}

