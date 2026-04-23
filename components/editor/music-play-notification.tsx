'use client'

import { ArrowUpRight, Play } from 'lucide-react'

import { MusicCoverBubble } from '@/components/editor/music-cover-bubble'
import { cn } from '@/lib/utils'
import type { MusicRecommendation } from '@/lib/types'

export function MusicPlayNotification({
  recommendation,
  sourceLabel,
  onPlayPreview,
  onOpenSource,
}: {
  recommendation: MusicRecommendation
  sourceLabel: string
  onPlayPreview: () => void
  onOpenSource?: () => void
}) {
  const producerLabel =
    recommendation.producer.trim() &&
    recommendation.producer.trim().toLowerCase() !== recommendation.artist.trim().toLowerCase()
      ? recommendation.producer.trim()
      : ''

  return (
    <div
      className={cn(
        'pointer-events-auto w-[min(24rem,calc(100vw-1.25rem))] rounded-[22px] border border-white/10 bg-[linear-gradient(180deg,rgba(13,13,18,0.98)_0%,rgba(8,8,12,0.98)_100%)] p-3 text-white shadow-[0_24px_48px_-30px_rgba(0,0,0,0.9)] backdrop-blur-xl',
      )}
    >
      <div className="flex items-start gap-3">
        <MusicCoverBubble
          src={recommendation.coverArtUrl}
          alt={recommendation.title}
          position={recommendation.coverArtPosition ?? 'center'}
          className="size-12"
        />

        <div className="min-w-0 flex-1">
          <div className="text-[10px] uppercase tracking-[0.28em] text-white/40">Track ready</div>
          <div className="truncate text-sm font-semibold leading-tight text-white">{recommendation.title}</div>
          <div className="truncate text-xs leading-tight text-white/58">
            {recommendation.artist}
            {producerLabel ? ` - ${producerLabel}` : ''}
          </div>
          <p className="mt-1 text-[11px] leading-5 text-white/42">{recommendation.reason}</p>
          {recommendation.fitReasons?.length ? (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {recommendation.fitReasons.slice(0, 2).map((reason) => (
                <span
                  key={reason}
                  className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[10px] uppercase tracking-[0.22em] text-white/58"
                >
                  {reason}
                </span>
              ))}
            </div>
          ) : null}

          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onPlayPreview}
              className="inline-flex items-center gap-1.5 rounded-full border border-[#7ff2d4]/16 bg-[#7ff2d4]/10 px-3 py-1.5 text-[11px] font-medium text-[#d4fff3] transition-colors hover:border-[#7ff2d4]/26 hover:bg-[#7ff2d4]/14 hover:text-white"
            >
              <Play className="size-3.5 fill-current" />
              Play preview
            </button>

            {onOpenSource ? (
              <button
                type="button"
                onClick={onOpenSource}
                className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-[11px] font-medium text-white/72 transition-colors hover:border-white/18 hover:bg-white/[0.06] hover:text-white"
              >
                <ArrowUpRight className="size-3.5" />
                {sourceLabel}
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  )
}
