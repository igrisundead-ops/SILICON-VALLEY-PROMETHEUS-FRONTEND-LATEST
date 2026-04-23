'use client'

import * as React from 'react'
import { GripVertical } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

type MediaUpscaleComparisonProps = {
  src: string
  alt: string
  kind: 'video' | 'image'
  className?: string
  viewportClassName?: string
}

export function MediaUpscaleComparison({
  src,
  alt,
  kind,
  className,
  viewportClassName,
}: MediaUpscaleComparisonProps) {
  const containerRef = React.useRef<HTMLDivElement>(null)
  const enhancedVideoRef = React.useRef<HTMLVideoElement>(null)
  const originalVideoRef = React.useRef<HTMLVideoElement>(null)
  const [split, setSplit] = React.useState(56)
  const [isDragging, setIsDragging] = React.useState(false)

  const updateSplit = React.useCallback((clientX: number) => {
    const bounds = containerRef.current?.getBoundingClientRect()
    if (!bounds) return

    const next = ((clientX - bounds.left) / bounds.width) * 100
    setSplit(Math.min(88, Math.max(12, next)))
  }, [])

  React.useEffect(() => {
    if (!isDragging) return

    const handlePointerMove = (event: PointerEvent) => updateSplit(event.clientX)
    const handlePointerUp = () => setIsDragging(false)

    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerUp)

    return () => {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
    }
  }, [isDragging, updateSplit])

  React.useEffect(() => {
    if (kind !== 'video') return

    const enhanced = enhancedVideoRef.current
    const original = originalVideoRef.current

    if (!enhanced || !original) return

    const syncOriginal = () => {
      if (Math.abs(original.currentTime - enhanced.currentTime) > 0.08) {
        try {
          original.currentTime = enhanced.currentTime
        } catch {
          // Ignore sync failures while metadata is loading.
        }
      }
    }

    const playOriginal = () => {
      original.playbackRate = enhanced.playbackRate
      const playPromise = original.play()
      if (playPromise && typeof playPromise.catch === 'function') {
        playPromise.catch(() => {})
      }
    }

    const pauseOriginal = () => original.pause()
    const syncRate = () => {
      original.playbackRate = enhanced.playbackRate
    }

    const playEnhanced = enhanced.play()
    if (playEnhanced && typeof playEnhanced.catch === 'function') {
      playEnhanced.catch(() => {})
    }
    playOriginal()

    enhanced.addEventListener('play', playOriginal)
    enhanced.addEventListener('pause', pauseOriginal)
    enhanced.addEventListener('seeking', syncOriginal)
    enhanced.addEventListener('timeupdate', syncOriginal)
    enhanced.addEventListener('ratechange', syncRate)

    return () => {
      enhanced.removeEventListener('play', playOriginal)
      enhanced.removeEventListener('pause', pauseOriginal)
      enhanced.removeEventListener('seeking', syncOriginal)
      enhanced.removeEventListener('timeupdate', syncOriginal)
      enhanced.removeEventListener('ratechange', syncRate)
    }
  }, [kind, src])

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    updateSplit(event.clientX)
    setIsDragging(true)
  }

  const mediaClassName = 'h-full w-full object-contain'

  const renderMedia = (variant: 'enhanced' | 'original') => {
    const visualTreatment =
      variant === 'enhanced'
        ? 'contrast-[1.08] saturate-[1.18] brightness-[1.05]'
        : 'contrast-[0.84] saturate-[0.72] brightness-[0.88] blur-[1.2px]'

    if (kind === 'image') {
      return (
        <img
          src={src}
          alt={alt}
          draggable={false}
          className={cn(mediaClassName, visualTreatment)}
        />
      )
    }

    return (
      <video
        ref={variant === 'enhanced' ? enhancedVideoRef : originalVideoRef}
        src={src}
        muted
        loop
        playsInline
        preload="metadata"
        autoPlay
        className={cn(mediaClassName, visualTreatment)}
      />
    )
  }

  return (
    <div className={cn('flex h-full w-full max-w-[470px] flex-col', className)}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <Badge variant="outline" className="border-white/12 bg-white/[0.04] px-3 py-1 text-[10px] uppercase tracking-[0.22em] text-white/70">
          Enhance Preview
        </Badge>
        <div className="text-[10px] uppercase tracking-[0.22em] text-white/38">Drag to compare</div>
      </div>

      <div
        ref={containerRef}
        className={cn(
          'relative h-[300px] overflow-hidden rounded-[24px] border border-white/10 bg-[#04060b] shadow-[0_28px_60px_-42px_rgba(0,0,0,0.9)] select-none',
          viewportClassName,
        )}
        onPointerDown={handlePointerDown}
      >
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_22%_18%,rgba(255,110,84,0.16),transparent_24%),radial-gradient(circle_at_76%_14%,rgba(108,128,255,0.15),transparent_20%),linear-gradient(180deg,rgba(255,255,255,0.03)_0%,rgba(0,0,0,0.38)_100%)]" />

        <div className="absolute left-4 top-4 z-20">
          <Badge className="border-emerald-400/20 bg-emerald-400/10 text-[10px] uppercase tracking-[0.2em] text-emerald-100">
            4K Finish
          </Badge>
        </div>
        <div className="absolute right-4 top-4 z-20">
          <Badge variant="outline" className="border-white/12 bg-black/28 text-[10px] uppercase tracking-[0.2em] text-white/66">
            Original
          </Badge>
        </div>

        <div className="absolute inset-0 p-3">
          <div className="relative h-full w-full overflow-hidden rounded-[18px] border border-white/10 bg-black/50">
            <div className="absolute inset-0 scale-[0.985]">{renderMedia('original')}</div>

            <div
              className="absolute inset-0 z-10 overflow-hidden"
              style={{ clipPath: `inset(0 ${100 - split}% 0 0)` }}
            >
              <div className="absolute inset-0">{renderMedia('enhanced')}</div>
              <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.05)_0%,rgba(255,255,255,0)_24%,rgba(0,0,0,0.16)_100%)]" />
            </div>
          </div>
        </div>

        <div
          className="pointer-events-none absolute inset-y-0 z-30 w-px bg-gradient-to-b from-white/0 via-white/75 to-white/0"
          style={{ left: `${split}%` }}
        />
        <button
          type="button"
          aria-label="Adjust enhancement comparison"
          className="absolute top-1/2 z-40 flex h-12 w-8 -translate-x-1/2 -translate-y-1/2 cursor-ew-resize items-center justify-center rounded-full border border-white/14 bg-[#0c1118]/90 text-white shadow-[0_16px_34px_-20px_rgba(0,0,0,0.88),0_0_16px_rgba(255,255,255,0.08)] backdrop-blur-md transition-transform duration-200 hover:scale-105"
          style={{ left: `${split}%` }}
          onPointerDown={(event) => {
            event.preventDefault()
            event.stopPropagation()
            handlePointerDown(event as unknown as React.PointerEvent<HTMLDivElement>)
          }}
        >
          <GripVertical className="h-4 w-4" />
        </button>

        <div className="pointer-events-none absolute inset-x-4 bottom-4 z-20 flex items-center justify-between gap-3 text-[10px] uppercase tracking-[0.2em] text-white/45">
          <span>Sharper detail</span>
          <span>Raw source</span>
        </div>
      </div>
    </div>
  )
}
