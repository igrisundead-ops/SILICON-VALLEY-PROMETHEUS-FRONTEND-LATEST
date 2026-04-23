'use client'

import * as React from 'react'

import { cn } from '@/lib/utils'

interface InfinityTrailLoaderProps {
  label?: string
  subtitle?: string
  className?: string
  variant?: 'compact' | 'stacked'
}

export function InfinityTrailLoader({
  label = 'Loading...',
  subtitle,
  className,
  variant = 'compact',
}: InfinityTrailLoaderProps) {
  const reactId = React.useId().replace(/:/g, '')
  const pathId = `editor-infinity-path-${reactId}`
  const isStacked = variant === 'stacked'

  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className={cn('relative flex flex-col items-center justify-center text-center', isStacked ? 'gap-5' : 'gap-3', className)}
    >
      <div className="editor-infinity-backdrop" aria-hidden />

      <div className="relative isolate">
        <svg
          viewBox="0 0 200 100"
          className="relative z-10 h-[clamp(110px,20vw,160px)] w-[clamp(210px,34vw,320px)] overflow-visible"
          aria-hidden
        >
          <defs>
            <path
              id={pathId}
              d="M 60 50 C 60 30 80 30 100 50 C 120 70 140 70 140 50 C 140 30 120 30 100 50 C 80 70 60 70 60 50"
              pathLength="100"
            />
          </defs>

          <use href={`#${pathId}`} className="editor-infinity-outline" />
          <use href={`#${pathId}`} className="editor-infinity-tail" />
          <use href={`#${pathId}`} className="editor-infinity-head" />
        </svg>
      </div>

      <div className={cn('space-y-2', !isStacked && 'space-y-0')}>
        {isStacked ? (
          <>
            <div className="text-[11px] uppercase tracking-[0.32em] text-white/42">{label}</div>
            {subtitle ? <div className="text-sm leading-6 text-white/54">{subtitle}</div> : null}
          </>
        ) : (
          <div className="text-[12px] leading-5 text-white/46">{label}</div>
        )}
      </div>
    </div>
  )
}
