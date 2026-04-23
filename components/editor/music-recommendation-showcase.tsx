'use client'

import * as React from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowRight, RefreshCw, Sparkles, SlidersHorizontal, Wand2 } from 'lucide-react'

import { MusicRecommendationCard, MusicRecommendationSkeleton } from '@/components/editor/music-recommendation-card'
import { useStableReducedMotion } from '@/hooks/use-stable-reduced-motion'
import { buildRevealVariants } from '@/lib/motion'
import { cn } from '@/lib/utils'
import type {
  MusicRecommendation,
  MusicRecommendationGroup,
  MusicRecommendationPhase,
  MusicRecommendationPipelineResult,
  MusicSoundtrackProfile,
} from '@/lib/types'

export type MusicRecommendationBlock = MusicRecommendationPipelineResult & {
  status: 'loading' | 'ready'
  query: string
  contextSummary?: string
  profileModel?: string
}

const REFINE_ACTIONS = [
  { key: 'cinematic', label: 'More cinematic', icon: Sparkles, hint: 'Pushes the lane toward score-like lift.' },
  { key: 'energetic', label: 'More energetic', icon: ArrowRight, hint: 'Raises the hook density and cut speed.' },
  { key: 'less-intense', label: 'Less intense', icon: SlidersHorizontal, hint: 'Keeps the music lighter and more restrained.' },
  { key: 'emotional', label: 'More emotional', icon: Wand2, hint: 'Adds a warmer, more reflective arc.' },
  { key: 'minimal', label: 'More minimal', icon: SlidersHorizontal, hint: 'Pulls the mix back under the dialogue.' },
  { key: 'fresh', label: 'Freshen results', icon: RefreshCw, hint: 'Keeps the profile but rotates the archive lane.' },
] as const

export function MusicRecommendationShowcase({
  music,
  isPreviewing,
  previewPlaying,
  stagedTrackIds,
  onPreviewToggle,
  onAdd,
  onRefine,
  viewportRoot,
  registerCardRef,
}: {
  music: MusicRecommendationBlock
  isPreviewing: (trackId: string) => boolean
  previewPlaying: boolean
  stagedTrackIds: Set<string>
  onPreviewToggle: (recommendation: MusicRecommendation) => void
  onAdd: (recommendation: MusicRecommendation) => void
  onRefine: (toneKey: string) => void
  viewportRoot?: React.RefObject<HTMLDivElement | null>
  registerCardRef?: (trackId: string, node: HTMLDivElement | null) => void
}) {
  const reduceMotion = useStableReducedMotion()
  const [visiblePhaseCount, setVisiblePhaseCount] = React.useState(1)
  const phases = music.phases ?? buildFallbackStages(music.profile, music.archiveCount, music.contextSummary, music.variantHint)
  const recommendationGroups = music.recommendationGroups ?? []
  const profile = music.profile

  React.useEffect(() => {
    if (reduceMotion) {
      setVisiblePhaseCount(phases.length)
      return
    }

    if (music.status === 'ready') {
      setVisiblePhaseCount(phases.length)
      return
    }

    setVisiblePhaseCount(Math.min(1, phases.length))
    const timer = window.setInterval(() => {
      setVisiblePhaseCount((current) => Math.min(phases.length, current + 1))
    }, 560)

    return () => window.clearInterval(timer)
  }, [music.status, phases.length, reduceMotion, music.query])

  const visiblePhases = phases.map((phase, index) => ({
    ...phase,
    status:
      music.status === 'ready'
        ? ('completed' as const)
        : index < visiblePhaseCount - 1
          ? ('completed' as const)
          : index === visiblePhaseCount - 1
            ? ('running' as const)
            : ('pending' as const),
  }))

  return (
    <div className="space-y-4">
      <motion.section
        variants={buildRevealVariants({ delay: 0.04, distance: 14, blur: 8, duration: 0.28 })}
        initial="hidden"
        whileInView="visible"
        viewport={{ root: viewportRoot, once: false, amount: 0.3 }}
        className="overflow-hidden rounded-[24px] border border-white/8 bg-[linear-gradient(180deg,rgba(16,18,24,0.98)_0%,rgba(10,10,14,0.96)_100%)] shadow-[0_18px_42px_-28px_rgba(0,0,0,0.82)]"
      >
        <div className="border-b border-white/6 px-4 py-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 text-[10px] uppercase tracking-[0.34em] text-white/40">
                <Sparkles className="size-3.5 text-[#7ff2d4]" />
                {music.status === 'loading' ? 'Analyzing video vibe' : 'Ideal soundtrack profile'}
              </div>
              <div className="text-[15px] font-semibold tracking-[-0.02em] text-white">
                {profile?.contentCategory ?? 'Building a soundtrack lane'}
              </div>
              <p className="max-w-2xl text-sm leading-6 text-white/60">
                {music.status === 'loading'
                  ? music.contextSummary || 'The system is reading pacing, mood, and local archive signals before ranking tracks.'
                  : profile?.reasoningSummary || music.reasoningSummary || 'Profile reasoning is ready.'}
              </p>
            </div>

            {profile ? (
              <div className="min-w-[14rem] rounded-[18px] border border-white/8 bg-white/[0.03] px-3 py-2.5">
                <div className="flex items-center justify-between gap-3 text-[10px] uppercase tracking-[0.24em] text-white/36">
                  <span>Profile confidence</span>
                  <span className="tabular-nums text-white/58">{Math.round(profile.confidence * 100)}%</span>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
                  <motion.div
                    className="h-full rounded-full bg-[linear-gradient(90deg,rgba(127,242,212,0.55)_0%,rgba(255,255,255,0.85)_50%,rgba(255,196,102,0.45)_100%)]"
                    animate={reduceMotion ? undefined : { width: `${Math.max(18, Math.round(profile.confidence * 100))}%` }}
                    transition={{ duration: reduceMotion ? 0 : 0.35, ease: [0.22, 1, 0.36, 1] }}
                    style={{ width: `${Math.max(18, Math.round(profile.confidence * 100))}%` }}
                  />
                </div>
                <div className="mt-2 text-[11px] leading-5 text-white/44">
                  {profile.primaryMood} + {profile.secondaryMood} | {profile.editSyncStyle}
                </div>
              </div>
            ) : null}
          </div>

          {profile ? (
            <div className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-4">
              <InfoChip label="Energy" value={`${Math.round(profile.energyLevel)}/100`} />
              <InfoChip label="Tempo" value={`${profile.tempoRange[0]}-${profile.tempoRange[1]} BPM`} />
              <InfoChip label="Audience" value={profile.audienceFeel} />
              <InfoChip label="Sync style" value={profile.editSyncStyle} />
            </div>
          ) : null}

          {profile ? (
            <div className="mt-3 flex flex-wrap gap-2">
              <TagChip tone="emerald" label={profile.primaryMood} />
              <TagChip tone="cyan" label={profile.secondaryMood} />
              <TagChip tone="amber" label={profile.contentCategory} />
              {profile.genreCandidates.slice(0, 3).map((genre) => (
                <TagChip key={genre} tone="slate" label={genre} />
              ))}
              {profile.instrumentationHints.slice(0, 3).map((hint) => (
                <TagChip key={hint} tone="ice" label={hint} />
              ))}
              {profile.avoid.slice(0, 3).map((avoid) => (
                <TagChip key={avoid} tone="rose" label={`Avoid ${avoid}`} />
              ))}
            </div>
          ) : null}
        </div>

        <div className="grid gap-3 px-4 py-4">
          <div className="rounded-[20px] border border-white/8 bg-black/18 p-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-[10px] uppercase tracking-[0.3em] text-white/36">Analysis phases</div>
                <div className="mt-1 text-sm text-white/72">
                  {music.status === 'loading' ? 'The system is moving through each layer.' : 'Each phase is completed and the archive has already been ranked.'}
                </div>
              </div>
              <div className="text-[11px] text-white/40">
                {music.archiveCount} local tracks
                {music.profileModel ? ` | ${music.profileModel}` : ''}
              </div>
            </div>

            <div className="mt-3 grid gap-2 lg:grid-cols-2">
              <AnimatePresence initial={false}>
                {visiblePhases.map((phase, index) => (
                  <motion.div
                    key={phase.key}
                    layout
                    initial={reduceMotion ? false : { opacity: 0, y: 8, filter: 'blur(8px)' }}
                    animate={reduceMotion ? undefined : { opacity: 1, y: 0, filter: 'blur(0px)' }}
                    exit={reduceMotion ? undefined : { opacity: 0, y: -8, filter: 'blur(8px)' }}
                    transition={{ duration: reduceMotion ? 0 : 0.24, delay: index * 0.04 }}
                    className={cn(
                      'rounded-[16px] border px-3 py-2.5',
                      phase.status === 'running'
                        ? 'border-[#7ff2d4]/24 bg-[#7ff2d4]/8'
                        : phase.status === 'completed'
                          ? 'border-white/10 bg-white/[0.03]'
                          : 'border-white/6 bg-white/[0.015]',
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-[11px] uppercase tracking-[0.28em] text-white/52">{phase.label}</div>
                        <div className="mt-1 text-[12px] leading-5 text-white/64">{phase.detail}</div>
                      </div>
                      <div className="mt-0.5 rounded-full border border-white/8 bg-black/30 px-2 py-1 text-[10px] uppercase tracking-[0.24em] text-white/50">
                        {phase.status === 'running' ? 'Live' : phase.status === 'completed' ? 'Done' : 'Queued'}
                      </div>
                    </div>
                    <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/[0.05]">
                      <motion.div
                        className="h-full rounded-full bg-[linear-gradient(90deg,rgba(127,242,212,0.45)_0%,rgba(255,255,255,0.8)_52%,rgba(255,196,102,0.42)_100%)]"
                        animate={reduceMotion ? undefined : { width: phase.status === 'pending' ? '20%' : `${Math.max(20, Math.round(phase.progress * 100))}%` }}
                        transition={{ duration: reduceMotion ? 0 : 0.35, ease: [0.22, 1, 0.36, 1] }}
                        style={{ width: phase.status === 'pending' ? '20%' : `${Math.max(20, Math.round(phase.progress * 100))}%` }}
                      />
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </div>

          <div className="space-y-4">
            <AnimatePresence initial={false}>
              {music.status === 'loading' ? (
                <motion.div
                  key="music-loading"
                  initial={reduceMotion ? false : { opacity: 0, y: 10 }}
                  animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
                  exit={reduceMotion ? undefined : { opacity: 0, y: -10 }}
                  className="space-y-3"
                >
                  <MusicRecommendationSkeleton />
                  <MusicRecommendationSkeleton />
                  <MusicRecommendationSkeleton />
                </motion.div>
              ) : (
                <motion.div
                  key="music-groups"
                  initial={reduceMotion ? false : { opacity: 0, y: 8 }}
                  animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
                  exit={reduceMotion ? undefined : { opacity: 0, y: -8 }}
                  className="space-y-4"
                >
                  {recommendationGroups.map((group, groupIndex) => (
                    <RecommendationGroupPanel
                      key={group.key}
                      group={group}
                      groupIndex={groupIndex}
                      previewPlaying={previewPlaying}
                      stagedTrackIds={stagedTrackIds}
                    isPreviewing={isPreviewing}
                    onPreviewToggle={onPreviewToggle}
                    onAdd={onAdd}
                    viewportRoot={viewportRoot}
                    registerCardRef={registerCardRef}
                  />
                ))}
              </motion.div>
            )}
            </AnimatePresence>
          </div>
        </div>
      </motion.section>

      <motion.section
        variants={buildRevealVariants({ delay: 0.16, distance: 12, blur: 8, duration: 0.26 })}
        initial="hidden"
        whileInView="visible"
        viewport={{ root: viewportRoot, once: false, amount: 0.24 }}
        className="rounded-[22px] border border-white/8 bg-[linear-gradient(180deg,rgba(15,15,20,0.94)_0%,rgba(9,9,13,0.96)_100%)] p-3 shadow-[0_18px_40px_-30px_rgba(0,0,0,0.82)]"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-[10px] uppercase tracking-[0.3em] text-white/36">Refine lane</div>
            <div className="mt-1 text-sm text-white/72">
              {music.needsRefinement
                ? 'Tighten the brief or reshape the energy without losing the archive context.'
                : 'The lane is focused, but these refinements keep iteration quick and intentional.'}
            </div>
          </div>
          <div className="text-[11px] text-white/40">
            {music.source === 'groq' ? 'LLM profile enabled' : 'Heuristic profile active'}
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          {REFINE_ACTIONS.map((action) => {
            const Icon = action.icon
            return (
              <button
                key={action.key}
                type="button"
                onClick={() => onRefine(action.key)}
                className="group inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-white/74 transition-colors hover:border-[#7ff2d4]/22 hover:bg-[#7ff2d4]/10 hover:text-white"
                title={action.hint}
              >
                <Icon className="size-3.5 text-white/50 transition-colors group-hover:text-[#7ff2d4]" />
                {action.label}
              </button>
            )
          })}
        </div>
      </motion.section>
    </div>
  )
}

function RecommendationGroupPanel({
  group,
  groupIndex,
  previewPlaying,
  stagedTrackIds,
  isPreviewing,
  onPreviewToggle,
  onAdd,
  viewportRoot,
  registerCardRef,
}: {
  group: MusicRecommendationGroup
  groupIndex: number
  previewPlaying: boolean
  stagedTrackIds: Set<string>
  isPreviewing: (trackId: string) => boolean
  onPreviewToggle: (recommendation: MusicRecommendation) => void
  onAdd: (recommendation: MusicRecommendation) => void
  viewportRoot?: React.RefObject<HTMLDivElement | null>
  registerCardRef?: (trackId: string, node: HTMLDivElement | null) => void
}) {
  const reduceMotion = useStableReducedMotion()

  return (
    <motion.section
      variants={buildRevealVariants({ delay: 0.06 * groupIndex, distance: 12, blur: 7, duration: 0.24 })}
      initial="hidden"
      whileInView="visible"
      viewport={{ root: viewportRoot, once: false, amount: 0.24 }}
      className={cn(
        'overflow-hidden rounded-[22px] border shadow-[0_14px_34px_-26px_rgba(0,0,0,0.82)]',
        group.accent === 'emerald'
          ? 'border-emerald-400/16 bg-emerald-400/[0.06]'
          : group.accent === 'cyan'
            ? 'border-cyan-400/16 bg-cyan-400/[0.06]'
            : group.accent === 'amber'
              ? 'border-amber-400/16 bg-amber-400/[0.06]'
              : group.accent === 'rose'
                ? 'border-rose-400/16 bg-rose-400/[0.06]'
                : group.accent === 'ice'
                  ? 'border-sky-300/16 bg-sky-300/[0.06]'
                  : 'border-white/8 bg-white/[0.03]',
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-white/6 px-4 py-3">
        <div>
          <div className="inline-flex items-center gap-2 text-[10px] uppercase tracking-[0.32em] text-white/40">
            <span className={cn('h-2 w-2 rounded-full', group.accent === 'emerald' ? 'bg-emerald-300' : group.accent === 'cyan' ? 'bg-cyan-300' : group.accent === 'amber' ? 'bg-amber-300' : group.accent === 'rose' ? 'bg-rose-300' : group.accent === 'ice' ? 'bg-sky-200' : 'bg-white/60')} />
            {group.label}
          </div>
          <div className="mt-1 text-sm text-white/74">{group.description}</div>
        </div>
        <div className="rounded-full border border-white/10 bg-black/24 px-3 py-1.5 text-[10px] uppercase tracking-[0.24em] text-white/52">
          {group.tracks.length} track{group.tracks.length === 1 ? '' : 's'}
        </div>
      </div>

      <div className="space-y-2 p-3">
        {group.tracks.map((recommendation, trackIndex) => (
          <div
            key={recommendation.id}
            ref={(node) => {
              registerCardRef?.(recommendation.id, node)
            }}
            className="rounded-[20px]"
          >
            <MusicRecommendationCard
              recommendation={recommendation}
              isPreviewing={isPreviewing(recommendation.id) && previewPlaying}
              isStaged={stagedTrackIds.has(recommendation.id)}
              onPreviewToggle={onPreviewToggle}
              onAdd={onAdd}
              viewportRoot={viewportRoot}
              revealDelay={groupIndex * 0.08 + trackIndex * 0.04}
            />
          </div>
        ))}
      </div>
    </motion.section>
  )
}

function InfoChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[16px] border border-white/8 bg-white/[0.03] px-3 py-2">
      <div className="text-[10px] uppercase tracking-[0.28em] text-white/34">{label}</div>
      <div className="mt-1 text-sm text-white/74">{value}</div>
    </div>
  )
}

function TagChip({
  label,
  tone,
}: {
  label: string
  tone: 'emerald' | 'cyan' | 'amber' | 'rose' | 'slate' | 'ice'
}) {
  const toneClass =
    tone === 'emerald'
      ? 'border-emerald-400/18 bg-emerald-400/10 text-emerald-100'
      : tone === 'cyan'
        ? 'border-cyan-400/18 bg-cyan-400/10 text-cyan-100'
        : tone === 'amber'
          ? 'border-amber-400/18 bg-amber-400/10 text-amber-100'
          : tone === 'rose'
            ? 'border-rose-400/18 bg-rose-400/10 text-rose-100'
            : tone === 'ice'
              ? 'border-sky-300/18 bg-sky-300/10 text-sky-100'
              : 'border-white/10 bg-white/[0.04] text-white/70'

  return <span className={cn('rounded-full border px-3 py-1 text-[10px] uppercase tracking-[0.24em]', toneClass)}>{label}</span>
}

function buildFallbackStages(
  profile?: MusicSoundtrackProfile,
  archiveCount?: number,
  contextSummary?: string,
  variantHint?: string,
): MusicRecommendationPhase[] {
  return [
    {
      key: 'analyzing-vibe',
      label: 'Analyzing video vibe',
      detail: contextSummary || 'Reading the cut before ranking tracks.',
      progress: 0.12,
    },
    {
      key: 'detecting-pacing',
      label: 'Detecting pacing',
      detail: profile ? `Aiming near ${profile.tempoRange[0]}-${profile.tempoRange[1]} BPM.` : 'Mapping pacing to the local archive.',
      progress: 0.28,
    },
    {
      key: 'inferring-mood',
      label: 'Inferring mood',
      detail: profile ? `${profile.primaryMood} with ${profile.secondaryMood} support.` : 'Selecting a lane that fits the emotion.',
      progress: 0.46,
    },
    {
      key: 'building-profile',
      label: 'Building soundtrack profile',
      detail: profile ? profile.reasoningSummary : 'Writing a profile before any ranking starts.',
      progress: 0.62,
    },
    {
      key: 'searching-archive',
      label: 'Searching archive',
      detail: `${archiveCount ?? 0} local tracks scanned.${variantHint ? ` Refine mode: ${variantHint}.` : ''}`,
      progress: 0.8,
    },
    {
      key: 'ranking-matches',
      label: 'Ranking best matches',
      detail: 'Sorting by fit, freshness, and repetition risk.',
      progress: 0.92,
    },
    {
      key: 'balancing-diversity',
      label: 'Balancing diversity',
      detail: 'Preparing alternate lanes so the result does not feel repetitive.',
      progress: 1,
    },
  ]
}
