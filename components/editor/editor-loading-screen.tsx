'use client'

import { cn } from '@/lib/utils'

import { InfinityTrailLoader } from './infinity-trail-loader'

interface EditorLoadingScreenProps {
  caption?: string
  className?: string
}

export function EditorLoadingScreen({
  caption = 'Loading...',
  className,
}: EditorLoadingScreenProps) {
  return (
    <div className={cn('relative min-h-screen overflow-hidden bg-[#050507] text-white', className)}>
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/2 top-1/2 h-[28rem] w-[28rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgba(124,77,255,0.2)_0%,rgba(124,77,255,0.08)_32%,rgba(0,0,0,0)_72%)] blur-3xl" />
        <div className="absolute left-[18%] top-[18%] h-44 w-44 rounded-full bg-[radial-gradient(circle,rgba(38,125,255,0.14)_0%,rgba(38,125,255,0)_72%)] blur-3xl" />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.03)_0%,rgba(255,255,255,0)_18%,rgba(0,0,0,0.22)_100%)]" />
      </div>

      <div className="relative flex min-h-screen items-center justify-center px-6 py-10">
        <InfinityTrailLoader label={caption} className="w-full max-w-[720px]" />
      </div>
    </div>
  )
}
