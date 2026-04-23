'use client'

import { cn } from '@/lib/utils'

export function MusicCoverBubble({
  src,
  alt,
  position = 'center',
  className,
}: {
  src: string
  alt: string
  position?: string
  className?: string
}) {
  return (
    <div
      className={cn(
        'relative shrink-0 overflow-hidden rounded-full border-2 border-white/80 bg-black/40 shadow-[0_10px_24px_rgba(0,0,0,0.45)]',
        className,
      )}
    >
      <img
        src={src}
        alt={alt}
        draggable={false}
        onDragStart={(event) => event.preventDefault()}
        className="h-full w-full select-none object-cover"
        style={{
          objectPosition: position,
          userSelect: 'none',
        }}
      />

      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_16%,rgba(255,255,255,0.18)_0%,rgba(255,255,255,0)_34%),linear-gradient(180deg,rgba(0,0,0,0)_42%,rgba(0,0,0,0.34)_100%)]" />
      <div className="pointer-events-none absolute inset-0 rounded-full shadow-[inset_0_1px_0_rgba(255,255,255,0.16),inset_0_0_0_1px_rgba(255,255,255,0.04)]" />
    </div>
  )
}
