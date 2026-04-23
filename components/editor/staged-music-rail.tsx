'use client'

import * as React from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Music4, Volume2, X } from 'lucide-react'

import { MusicCoverBubble } from '@/components/editor/music-cover-bubble'
import { useStableReducedMotion } from '@/hooks/use-stable-reduced-motion'
import { buildRevealVariants } from '@/lib/motion'
import { cn } from '@/lib/utils'
import type { MusicPreference, MusicSoundtrackProfile, StagedMusicTrack } from '@/lib/types'

export function StagedMusicRail({
  projectTitle,
  preference,
  profile,
  stagedTracks,
  musicVolumePercent,
  onMusicVolumeChange,
  onRemoveTrack,
  onClearAll,
}: {
  projectTitle: string
  preference: MusicPreference
  profile?: MusicSoundtrackProfile | null
  stagedTracks: StagedMusicTrack[]
  musicVolumePercent?: number
  onMusicVolumeChange?: (nextValue: number) => void
  onRemoveTrack: (trackId: string) => void
  onClearAll: () => void
}) {
  const reduceMotion = useStableReducedMotion()
  const hasTracks = stagedTracks.length > 0
  const railViewportRef = React.useRef<HTMLDivElement | null>(null)

  return (
    <div className="max-h-[380px] rounded-[18px] border border-white/8 bg-[#101116] p-4 shadow-[0_18px_32px_-26px_rgba(0,0,0,0.76)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="inline-flex items-center gap-2 text-[10px] uppercase tracking-[0.32em] text-white/38">
            <Music4 className="size-3.5 text-white/48" />
            Staged Music
          </div>
          <div className="mt-2 text-sm text-white/78">
            {hasTracks ? `${stagedTracks.length} cue${stagedTracks.length > 1 ? 's' : ''} parked for ${projectTitle}` : 'No tracks staged yet'}
          </div>
          <div className="mt-1 text-xs text-white/42">
            {profile
              ? `${profile.contentCategory} | ${profile.primaryMood} + ${profile.secondaryMood} | ${profile.tempoRange[0]}-${profile.tempoRange[1]} BPM`
              : `Mood ${formatPreference(preference.mood)} | Energy ${formatPreference(preference.energy)} | Source ${formatPreference(preference.sourcePlatform)}`}
          </div>
          {profile ? <div className="mt-1 text-[11px] leading-5 text-white/36">{profile.reasoningSummary}</div> : null}
        </div>

        {hasTracks ? (
          <div className="flex flex-wrap items-center justify-end gap-2">
            {typeof musicVolumePercent === 'number' && onMusicVolumeChange ? (
              <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-white/58">
                <Volume2 className="size-3.5 text-white/46" />
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={musicVolumePercent}
                  onChange={(event) => onMusicVolumeChange(Number(event.target.value))}
                  className="h-1 w-20 accent-white"
                  aria-label="Music preview volume"
                />
                <span className="w-8 text-right tabular-nums text-white/72">{musicVolumePercent}</span>
              </div>
            ) : null}
            <button
              type="button"
              onClick={onClearAll}
              className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-white/58 transition-colors hover:text-white"
            >
              Clear all
            </button>
          </div>
        ) : null}
      </div>

      <div ref={railViewportRef} className="mt-4 max-h-[280px] space-y-2 overflow-y-auto pr-1">
        <AnimatePresence initial={false}>
          {hasTracks ? (
            stagedTracks.map((track, index) => (
              <motion.div
                key={track.id}
                layout
                initial={reduceMotion ? false : 'hidden'}
                whileInView={reduceMotion ? undefined : 'visible'}
                exit={reduceMotion ? undefined : 'exit'}
                viewport={reduceMotion ? undefined : { root: railViewportRef, once: false, amount: 0.45 }}
                variants={
                  reduceMotion
                    ? undefined
                    : buildRevealVariants({ delay: index * 0.03, distance: 10, scale: 0.985, blur: 8, duration: 0.24 })
                }
                className="flex items-center gap-3 rounded-[16px] border border-white/8 bg-[#0b0b10] px-3 py-2.5"
              >
                <MusicCoverBubble
                  src={track.recommendation.coverArtUrl}
                  alt={track.recommendation.title}
                  position={track.recommendation.coverArtPosition ?? 'center'}
                  className="h-11 w-11"
                />

                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm text-white">{track.recommendation.title}</div>
                  <div className="truncate text-xs text-white/52">
                    {track.recommendation.artist} | {track.recommendation.bpm} BPM
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => onRemoveTrack(track.id)}
                  className={cn(
                    'grid size-8 place-items-center rounded-full border border-white/8 bg-white/[0.03] text-white/52 transition-colors hover:text-white',
                  )}
                  aria-label={`Remove ${track.recommendation.title} from staged music`}
                >
                  <X className="size-4" />
                </button>
              </motion.div>
            ))
          ) : (
            <motion.div
              key="empty-staged-rail"
              initial={reduceMotion ? false : { opacity: 0, y: 8 }}
              animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
              exit={reduceMotion ? undefined : { opacity: 0, y: -8 }}
              transition={{ duration: reduceMotion ? 0 : 0.22 }}
              className="rounded-[16px] border border-dashed border-white/8 bg-white/[0.02] px-3 py-4 text-sm leading-6 text-white/46"
            >
              Add a recommendation from the cards above and it will live here, staged but not yet on the timeline.
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

function formatPreference(value: string) {
  return value.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
}

