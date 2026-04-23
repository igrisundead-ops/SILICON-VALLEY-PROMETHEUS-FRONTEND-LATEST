'use client'

import Image from 'next/image'
import * as React from 'react'
import {
  AnimatePresence,
  motion,
  useMotionValue,
  useSpring,
  useTransform,
} from 'framer-motion'

import { cn } from '@/lib/utils'

type TooltipItem = {
  id: number
  name: string
  designation: string
  image: string
}

export function AnimatedTooltip({
  items,
  className,
  onItemClick,
  activeId,
}: {
  items: TooltipItem[]
  className?: string
  onItemClick?: (item: TooltipItem) => void
  activeId?: number | null
}) {
  const [hoveredIndex, setHoveredIndex] = React.useState<number | null>(null)
  const springConfig = { stiffness: 100, damping: 5 }
  const x = useMotionValue(0)
  const rotate = useSpring(useTransform(x, [-100, 100], [-45, 45]), springConfig)
  const translateX = useSpring(useTransform(x, [-100, 100], [-50, 50]), springConfig)

  const handleMouseMove = (event: React.MouseEvent<HTMLImageElement>) => {
    const halfWidth = event.currentTarget.offsetWidth / 2
    x.set(event.nativeEvent.offsetX - halfWidth)
  }

  return (
    <div className={cn('flex items-center gap-2', className)}>
      {items.map((item) => (
        <button
          type="button"
          key={item.name}
          aria-pressed={activeId === item.id}
          className="-mr-4 relative cursor-pointer group"
          onMouseEnter={() => setHoveredIndex(item.id)}
          onMouseLeave={() => setHoveredIndex(null)}
          onClick={() => onItemClick?.(item)}
        >
          <AnimatePresence mode="popLayout">
            {hoveredIndex === item.id ? (
              <motion.div
                initial={{ opacity: 0, y: 20, scale: 0.6 }}
                animate={{
                  opacity: 1,
                  y: 0,
                  scale: 1,
                  transition: {
                    type: 'spring',
                    stiffness: 260,
                    damping: 10,
                  },
                }}
                exit={{ opacity: 0, y: 20, scale: 0.6 }}
                style={{
                  translateX,
                  rotate,
                  whiteSpace: 'nowrap',
                }}
                className="absolute -top-18 left-1/2 z-50 flex -translate-x-1/2 flex-col items-center justify-center border border-white/12 bg-[#0f1118]/96 px-4 py-2 text-xs shadow-[0_24px_60px_-34px_rgba(0,0,0,0.92)] backdrop-blur-xl"
              >
                <div className="absolute inset-x-10 bottom-0 z-30 h-px bg-gradient-to-r from-transparent via-[#ff6b57] to-transparent" />
                <div className="absolute left-10 bottom-0 z-30 h-px w-[40%] bg-gradient-to-r from-transparent via-[#7db4ff] to-transparent" />
                <div className="relative z-30 text-base font-bold text-white">{item.name}</div>
                <div className="text-[11px] uppercase tracking-[0.18em] text-white/55">
                  {item.designation}
                </div>
              </motion.div>
            ) : null}
          </AnimatePresence>

          <div
            className={cn(
              'relative h-14 w-14 overflow-hidden rounded-full border bg-[#090b12] shadow-[0_18px_30px_-20px_rgba(0,0,0,0.95),0_0_0_1px_rgba(255,255,255,0.04)] transition duration-500 group-hover:z-30 group-hover:scale-105',
              activeId === item.id
                ? 'border-[#ff7d68] ring-2 ring-[#ff7d68]/45 shadow-[0_0_0_1px_rgba(255,125,104,0.72),0_0_34px_rgba(255,102,78,0.34),0_18px_30px_-20px_rgba(0,0,0,0.95)]'
                : 'border-white/12 group-hover:border-[#ff6b57]/32',
            )}
          >
            <div className="pointer-events-none absolute inset-0 z-10 rounded-full bg-[radial-gradient(circle_at_50%_16%,rgba(255,255,255,0.18),rgba(255,255,255,0)_34%),linear-gradient(180deg,rgba(0,0,0,0)_42%,rgba(0,0,0,0.34)_100%)]" />
            <Image
              onMouseMove={handleMouseMove}
              height={100}
              width={100}
              src={item.image}
              alt={item.name}
              className="h-full w-full rounded-full object-cover object-top !m-0 !p-0"
            />
          </div>
        </button>
      ))}
    </div>
  )
}
