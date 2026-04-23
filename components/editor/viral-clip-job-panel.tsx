'use client'

import * as React from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { AlertTriangle, CheckCircle2, Loader2, RefreshCw } from 'lucide-react'

import type {
  BackendHealthSnapshot,
  ViralClipJobLifecycle,
  ViralClipJobStage,
  ViralClipSelectedClip,
  ViralClipTargetPlatform,
} from '@/lib/types'
import { useStableReducedMotion } from '@/hooks/use-stable-reduced-motion'
import { cn } from '@/lib/utils'

interface ViralClipJobPanelProps {
  backendHealth: BackendHealthSnapshot
  lifecycle: ViralClipJobLifecycle
  backendStage: ViralClipJobStage | null
  stageLabel: string | null
  stageDetail: string | null
  jobId: string | null
  progressPercent: number | null
  warnings: string[]
  statusMessage: string | null
  errorMessage: string | null
  resultError: string | null
  selectedClips: ViralClipSelectedClip[]
  targetPlatform: ViralClipTargetPlatform
  clipCountMin: number
  clipCountMax: number
  onTargetPlatformChange: (platform: ViralClipTargetPlatform) => void
  onClipCountPresetChange: (preset: { min: number; max: number }) => void
  onRefreshHealth: () => void
  onRefreshResult: () => void
}

interface StageOption {
  key: ViralClipJobStage
  label: string
}

const STAGE_OPTIONS: StageOption[] = [
  { key: 'queued', label: 'Queued' },
  { key: 'transcribing', label: 'Transcribing' },
  { key: 'segmenting', label: 'Segmenting' },
  { key: 'heuristic_scoring', label: 'Heuristic' },
  { key: 'llm_scoring', label: 'LLM' },
  { key: 'ranking', label: 'Ranking' },
  { key: 'completed', label: 'Done' },
  { key: 'failed', label: 'Failed' },
]

const PLATFORM_OPTIONS: Array<{ key: ViralClipTargetPlatform; label: string; hint: string }> = [
  { key: 'tiktok', label: 'TikTok', hint: 'Vertical, fast-cut friendly' },
  { key: 'instagram', label: 'Instagram', hint: 'Reels-first, polished pacing' },
  { key: 'youtube', label: 'YouTube', hint: 'Shorts-ready with strong hooks' },
  { key: 'x', label: 'X', hint: 'Punchy, shareable teasers' },
  { key: 'linkedin', label: 'LinkedIn', hint: 'Professional, concise framing' },
]

const CLIP_COUNT_PRESETS = [
  { min: 2, max: 3, label: '2-3' },
  { min: 3, max: 5, label: '3-5' },
  { min: 5, max: 8, label: '5-8' },
] as const

function abbreviateJobId(jobId: string) {
  if (jobId.length <= 10) return jobId
  return `${jobId.slice(0, 6)}…${jobId.slice(-4)}`
}

function formatResultScore(clip: ViralClipSelectedClip) {
  const score = clip.score ?? clip.confidence
  if (typeof score !== 'number' || !Number.isFinite(score)) return null
  if (score <= 1) return `${Math.round(score * 100)}%`
  return `${Math.round(score)}`
}

function formatTimeValue(value: number | null | undefined) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null
  const safe = Math.max(0, value)
  const seconds = Math.floor(safe / 1000)
  const minutes = Math.floor(seconds / 60)
  return `${minutes}:${`${seconds % 60}`.padStart(2, '0')}`
}

function renderClipRange(clip: ViralClipSelectedClip) {
  const startMs = clip.startMs ?? clip.start_ms ?? clip.startTimeMs ?? null
  const endMs = clip.endMs ?? clip.end_ms ?? clip.endTimeMs ?? null
  const start = formatTimeValue(startMs)
  const end = formatTimeValue(endMs)
  if (!start && !end) return null
  if (start && end) return `${start} - ${end}`
  return start ?? end
}

function extractClipTitle(clip: ViralClipSelectedClip, index: number) {
  return clip.title ?? clip.label ?? clip.name ?? `Selected clip ${index + 1}`
}

function extractClipReason(clip: ViralClipSelectedClip) {
  return clip.reason ?? clip.description ?? null
}

function healthCopy(snapshot: BackendHealthSnapshot) {
  if (snapshot.status === null && snapshot.message?.toLowerCase().includes('checking')) {
    return {
      label: 'Checking backend',
      tone: 'neutral' as const,
    }
  }

  if (snapshot.reachable) {
    return {
      label: 'Backend online',
      tone: 'success' as const,
    }
  }

  return {
    label: snapshot.message ?? 'Backend offline',
    tone: 'danger' as const,
  }
}

export function ViralClipJobPanel({
  backendHealth,
  lifecycle,
  backendStage,
  stageLabel,
  stageDetail,
  jobId,
  progressPercent,
  warnings,
  statusMessage,
  errorMessage,
  resultError,
  selectedClips,
  targetPlatform,
  clipCountMin,
  clipCountMax,
  onTargetPlatformChange,
  onClipCountPresetChange,
  onRefreshHealth,
  onRefreshResult,
}: ViralClipJobPanelProps) {
  const reduceMotion = useStableReducedMotion()
  const health = healthCopy(backendHealth)
  const currentStage = backendStage ?? (lifecycle === 'completed' ? 'completed' : lifecycle === 'failed' ? 'failed' : 'queued')
  const currentStageIndex = Math.max(
    0,
    STAGE_OPTIONS.findIndex((stage) => stage.key === currentStage),
  )
  const isRunning = lifecycle === 'submitting' || lifecycle === 'submitted' || lifecycle === 'polling'
  const hasSelection = selectedClips.length > 0
  const resolvedErrorMessage =
    errorMessage ?? resultError ?? (lifecycle === 'failed' ? 'The backend reported a failed viral clip job.' : null)
  const hasBlockingError = Boolean(resolvedErrorMessage)

  return (
    <motion.section
      initial={reduceMotion ? false : { opacity: 0, y: 10, filter: 'blur(8px)' }}
      animate={reduceMotion ? undefined : { opacity: 1, y: 0, filter: 'blur(0px)' }}
      transition={{ duration: reduceMotion ? 0 : 0.24, ease: [0.22, 1, 0.36, 1] }}
      className="mt-4 overflow-hidden rounded-[20px] border border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.05)_0%,rgba(255,255,255,0.025)_100%)] p-4 shadow-[0_18px_38px_-26px_rgba(0,0,0,0.75)]"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[10px] font-semibold uppercase tracking-[0.3em] text-white/34">
            Backend-driven viral clips
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <div
              className={cn(
                'inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[11px] font-medium',
                health.tone === 'success'
                  ? 'border-emerald-300/20 bg-emerald-300/10 text-emerald-50'
                  : health.tone === 'danger'
                    ? 'border-rose-300/20 bg-rose-300/10 text-rose-50'
                    : 'border-white/10 bg-white/[0.04] text-white/72',
              )}
            >
              {health.tone === 'success' ? (
                <CheckCircle2 className="size-3.5" />
              ) : health.tone === 'danger' ? (
                <AlertTriangle className="size-3.5" />
              ) : (
                <Loader2 className="size-3.5 animate-spin" />
              )}
              <span>{health.label}</span>
            </div>
            {jobId ? (
              <div className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[11px] text-white/48">
                Job {abbreviateJobId(jobId)}
              </div>
            ) : null}
            <div className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[11px] text-white/48">
              {lifecycle === 'idle' ? 'Idle' : lifecycle}
            </div>
          </div>
          <p className="mt-3 max-w-[40rem] text-sm leading-6 text-white/56">
            One backend request owns the whole job. The frontend only reflects the current stage,
            warnings, and final selected clips.
          </p>
        </div>

        <button
          type="button"
          onClick={onRefreshHealth}
          className="inline-flex h-9 items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3.5 text-[12px] font-medium text-white/72 transition-colors hover:bg-white/[0.06] hover:text-white"
        >
          <RefreshCw className="size-3.5" />
          Recheck backend
        </button>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-[18px] border border-white/8 bg-black/18 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.28em] text-white/34">
                Current stage
              </div>
              <div className="mt-1 text-sm font-medium text-white/88">
                {stageLabel ?? 'Waiting for backend signal'}
              </div>
              <div className="mt-1 text-xs leading-5 text-white/44">
                {stageDetail ?? 'The backend will surface progress as soon as the job is created.'}
              </div>
            </div>

            <div className="text-right">
              {progressPercent !== null ? (
                <>
                  <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-white/34">
                    Progress
                  </div>
                  <div className="mt-1 text-xl font-medium text-white/88">{progressPercent}%</div>
                </>
              ) : (
                <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[11px] text-white/56">
                  <Loader2 className="size-3.5 animate-spin" />
                  {isRunning ? 'Awaiting backend progress' : 'Idle'}
                </div>
              )}
            </div>
          </div>

          <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/6">
            <motion.div
              className="h-full rounded-full bg-[linear-gradient(90deg,rgba(127,242,212,0.2)_0%,rgba(127,242,212,0.92)_46%,rgba(255,255,255,0.92)_100%)]"
              animate={{
                width: progressPercent !== null ? `${Math.max(4, Math.min(100, progressPercent))}%` : isRunning ? '28%' : '0%',
              }}
              transition={{ duration: reduceMotion ? 0 : 0.28, ease: 'easeOut' }}
            />
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            {warnings.slice(0, 4).map((warning) => (
              <div
                key={warning}
                className="rounded-full border border-amber-300/18 bg-amber-300/10 px-3 py-1 text-[11px] text-amber-50"
              >
                {warning}
              </div>
            ))}
            {statusMessage ? (
              <div className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[11px] text-white/58">
                {statusMessage}
              </div>
            ) : null}
          </div>

          <div className="mt-3 flex flex-wrap gap-1.5">
            {STAGE_OPTIONS.map((stage, index) => {
              const isActive = stage.key === currentStage
              const isComplete = index < currentStageIndex
              return (
                <span
                  key={stage.key}
                  className={cn(
                    'rounded-full border px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.18em]',
                    isActive
                      ? 'border-[#9ff6e3]/26 bg-[#9ff6e3]/12 text-[#e7fffb]'
                      : isComplete
                        ? 'border-white/10 bg-white/[0.06] text-white/58'
                        : 'border-white/8 bg-white/[0.02] text-white/28',
                  )}
                >
                  {stage.label}
                </span>
              )
            })}
          </div>

          <AnimatePresence initial={false}>
            {hasBlockingError ? (
              <motion.div
                key="clip-error"
                initial={reduceMotion ? false : { opacity: 0, y: 8 }}
                animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
                exit={reduceMotion ? undefined : { opacity: 0, y: 8 }}
                className="mt-3 rounded-[14px] border border-rose-300/18 bg-rose-300/10 px-4 py-3 text-sm text-rose-50"
              >
                <div className="font-medium">Job issue</div>
                <div className="mt-1 text-sm leading-6 text-rose-50/82">{resolvedErrorMessage}</div>
                {resultError ? (
                  <button
                    type="button"
                    onClick={onRefreshResult}
                    className="mt-3 inline-flex h-8 items-center gap-2 rounded-full border border-rose-200/18 bg-rose-200/8 px-3 text-[12px] font-medium text-rose-50 transition-colors hover:bg-rose-200/12"
                  >
                    <RefreshCw className="size-3.5" />
                    Retry result fetch
                  </button>
                ) : null}
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>

        <div className="rounded-[18px] border border-white/8 bg-black/18 p-3">
          <div className="text-[10px] font-semibold uppercase tracking-[0.28em] text-white/34">Target</div>
          <div className="mt-2 flex flex-wrap gap-2">
            {PLATFORM_OPTIONS.map((platform) => {
              const isActive = platform.key === targetPlatform
              return (
                <button
                  key={platform.key}
                  type="button"
                  onClick={() => onTargetPlatformChange(platform.key)}
                  className={cn(
                    'rounded-full border px-3 py-1.5 text-[12px] transition-colors',
                    isActive
                      ? 'border-[#9ff6e3]/24 bg-[#9ff6e3]/12 text-[#e7fffb]'
                      : 'border-white/10 bg-white/[0.03] text-white/58 hover:bg-white/[0.06] hover:text-white',
                  )}
                  title={platform.hint}
                >
                  {platform.label}
                </button>
              )
            })}
          </div>

          <div className="mt-4 text-[10px] font-semibold uppercase tracking-[0.28em] text-white/34">
            Clip count
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {CLIP_COUNT_PRESETS.map((preset) => {
              const isActive = preset.min === clipCountMin && preset.max === clipCountMax
              return (
                <button
                  key={`${preset.min}-${preset.max}`}
                  type="button"
                  onClick={() => onClipCountPresetChange({ min: preset.min, max: preset.max })}
                  className={cn(
                    'rounded-full border px-3 py-1.5 text-[12px] transition-colors',
                    isActive
                      ? 'border-white/18 bg-white text-[#111116]'
                      : 'border-white/10 bg-white/[0.03] text-white/58 hover:bg-white/[0.06] hover:text-white',
                  )}
                >
                  {preset.label}
                </button>
              )
            })}
          </div>

          <div className="mt-4 rounded-[14px] border border-white/8 bg-white/[0.03] px-4 py-3">
            <div className="text-[10px] font-semibold uppercase tracking-[0.28em] text-white/34">
              Active setup
            </div>
            <div className="mt-1 text-sm text-white/84">
              {PLATFORM_OPTIONS.find((platform) => platform.key === targetPlatform)?.label ?? 'Target platform'}
              {' · '}
              {clipCountMin}-{clipCountMax} clips
            </div>
            <div className="mt-1 text-xs leading-5 text-white/44">
              Use the Clip button above to launch this request. The backend will own the entire clip workflow.
            </div>
          </div>

          <div className="mt-4 rounded-[14px] border border-white/8 bg-white/[0.02] px-4 py-3">
            <div className="flex items-center justify-between gap-3">
              <div className="text-[10px] font-semibold uppercase tracking-[0.28em] text-white/34">
                Selected clips
              </div>
              <div className="text-[11px] text-white/46">{selectedClips.length} items</div>
            </div>

            {hasSelection ? (
              <div className="mt-3 space-y-2">
                {selectedClips.slice(0, 4).map((clip, index) => {
                  const range = renderClipRange(clip)
                  const score = formatResultScore(clip)
                  const title = extractClipTitle(clip, index)
                  const reason = extractClipReason(clip)
                  const tags = Array.isArray(clip.tags)
                    ? clip.tags
                        .filter((tag): tag is string => typeof tag === 'string' && tag.trim().length > 0)
                        .slice(0, 4)
                    : []

                  return (
                    <div
                      key={clip.id ?? `${title}-${index}`}
                      className="rounded-[12px] border border-white/8 bg-white/[0.03] px-3 py-2.5"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="truncate text-[13px] font-medium text-white/88">{title}</div>
                          {reason ? (
                            <div className="mt-1 max-h-10 overflow-hidden text-[12px] leading-5 text-white/48">
                              {reason}
                            </div>
                          ) : null}
                        </div>
                        {score ? (
                          <div className="shrink-0 rounded-full border border-[#9ff6e3]/20 bg-[#9ff6e3]/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#dffdf5]">
                            {score}
                          </div>
                        ) : null}
                      </div>

                      <div className="mt-2 flex flex-wrap gap-1.5 text-[10px] text-white/52">
                        {range ? (
                          <span className="rounded-full border border-white/8 bg-white/[0.03] px-2 py-1">
                            {range}
                          </span>
                        ) : null}
                        {tags.map((tag) => (
                          <span key={tag} className="rounded-full border border-white/8 bg-white/[0.03] px-2 py-1">
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="mt-3 rounded-[12px] border border-dashed border-white/8 bg-white/[0.02] px-3 py-4 text-sm leading-6 text-white/42">
                {lifecycle === 'completed'
                  ? 'The backend finished the job, but no clip payload has been loaded yet.'
                  : 'Selected clips will appear here once the backend reaches the completed stage.'}
              </div>
            )}
          </div>
        </div>
      </div>
    </motion.section>
  )
}
