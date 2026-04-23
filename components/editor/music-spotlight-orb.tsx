'use client'

import * as React from 'react'
import { motion } from 'framer-motion'
import { X } from 'lucide-react'

import { MusicCoverBubble } from '@/components/editor/music-cover-bubble'
import { useStableReducedMotion } from '@/hooks/use-stable-reduced-motion'
import { buildPopVariants } from '@/lib/motion'
import { cn } from '@/lib/utils'
import type { MusicRecommendation } from '@/lib/types'

export function MusicSpotlightOrb({
  recommendation,
  status = 'staged',
  className,
  onDismiss,
}: {
  recommendation: MusicRecommendation
  status?: 'staged' | 'previewing'
  className?: string
  onDismiss?: () => void
}) {
  const reduceMotion = useStableReducedMotion()
  const popVariants = React.useMemo(() => buildPopVariants({ scale: 0.7, distance: 5, blur: 8 }), [])

  return (
    <motion.div
      role="img"
      aria-label={`${recommendation.title} by ${recommendation.artist}`}
      initial={reduceMotion ? false : 'hidden'}
      animate={reduceMotion ? undefined : 'visible'}
      exit={reduceMotion ? undefined : 'exit'}
      variants={reduceMotion ? undefined : popVariants}
      className={cn(
        'group pointer-events-auto relative isolate inline-flex shrink-0 cursor-grab select-none active:cursor-grabbing',
        className,
      )}
      drag={reduceMotion ? false : true}
      dragConstraints={reduceMotion ? undefined : { left: -14, right: 14, top: -10, bottom: 10 }}
      dragElastic={0.16}
      dragMomentum={false}
      dragSnapToOrigin={!reduceMotion}
      dragTransition={{ bounceStiffness: 680, bounceDamping: 28 }}
      whileHover={reduceMotion ? undefined : { scale: 1.05 }}
      whileTap={reduceMotion ? undefined : { scale: 0.98 }}
      style={{ transformOrigin: '50% 50%' }}
    >
      <MusicCoverBubble
        src={recommendation.coverArtUrl}
        alt={recommendation.title}
        position={recommendation.coverArtPosition ?? 'center'}
        className={cn(
          'size-11',
          status === 'previewing'
            ? 'border-[#7ff2d4]/36 shadow-[0_10px_24px_rgba(0,0,0,0.45),0_0_0_1px_rgba(127,242,212,0.16),0_0_30px_rgba(127,242,212,0.18)]'
            : 'shadow-[0_10px_24px_rgba(0,0,0,0.45)]',
        )}
      />
      <button
        type="button"
        aria-label="Close spotlight"
        onPointerDown={(event) => event.stopPropagation()}
        onClick={(event) => {
          event.stopPropagation()
          onDismiss?.()
        }}
        className="pointer-events-auto absolute -bottom-2.5 -right-2.5 grid size-6 place-items-center rounded-full border border-white/14 bg-black/78 text-white/78 opacity-0 shadow-[0_10px_18px_-12px_rgba(0,0,0,0.95)] transition-[opacity,transform,background-color,border-color,color] duration-200 ease-out hover:border-white/22 hover:bg-black/86 hover:text-white focus:outline-none focus:ring-2 focus:ring-white/22 group-hover:scale-100 group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:scale-100 group-focus-within:translate-y-0 group-focus-within:opacity-100 scale-75 translate-y-1 cursor-pointer"
      >
        <X className="size-3.5" />
      </button>
    </motion.div>
  )
}
