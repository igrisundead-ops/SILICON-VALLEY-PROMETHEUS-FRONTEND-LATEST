'use client'

import * as React from 'react'
import { motion, useReducedMotion } from 'framer-motion'

import { cn } from '@/lib/utils'

export interface TextShimmerWaveProps {
  children: React.ReactNode
  className?: string
}

export function TextShimmerWave({ children, className }: TextShimmerWaveProps) {
  const reduced = useReducedMotion()

  if (reduced) {
    return <span className={cn('text-white/60', className)}>{children}</span>
  }

  return (
    <motion.span
      className={cn(
        'relative inline-block text-white/65',
        'bg-[linear-gradient(110deg,rgba(255,255,255,0.18),rgba(255,255,255,0.55),rgba(255,255,255,0.18))] bg-[length:200%_100%] bg-clip-text text-transparent',
        className,
      )}
      initial={{ backgroundPositionX: '0%' }}
      animate={{ backgroundPositionX: ['0%', '200%'] }}
      transition={{ duration: 2.6, ease: 'linear', repeat: Infinity }}
    >
      {children}
    </motion.span>
  )
}

