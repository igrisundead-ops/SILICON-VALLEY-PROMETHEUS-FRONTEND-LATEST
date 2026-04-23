'use client'

import * as React from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { CheckCircle2, Loader2, Sparkles, Wand2 } from 'lucide-react'

import { Plan, type PlanItem } from '@/components/ui/agent-plan'
import { useStableReducedMotion } from '@/hooks/use-stable-reduced-motion'
import { STYLE_TEMPLATES, type StyleTemplate } from '@/lib/styles/style-templates'
import type { ProcessingJob } from '@/lib/types'
import { cn } from '@/lib/utils'

interface EditWorkflowPanelProps {
  projectTitle: string
  sourceLabel: string | null
  job: ProcessingJob | null
}

function abbreviateJobId(jobId: string) {
  if (jobId.length <= 10) return jobId
  return `${jobId.slice(0, 6)}...${jobId.slice(-4)}`
}

function resolveStyleTemplate(styleId?: string): StyleTemplate | null {
  if (!styleId) return null
  return STYLE_TEMPLATES.find((template) => template.id === styleId) ?? null
}

export function EditWorkflowPanel({ projectTitle, sourceLabel, job }: EditWorkflowPanelProps) {
  const reduceMotion = useStableReducedMotion()
  const styleTemplate = React.useMemo(
    () => resolveStyleTemplate(job?.artifacts.styleId),
    [job?.artifacts.styleId],
  )
  const planItems = React.useMemo<PlanItem[]>(
    () =>
      (job?.steps ?? []).map((step) => ({
        id: step.key,
        title: step.title,
        status:
          step.status === 'error'
            ? 'error'
            : step.status === 'running'
              ? 'running'
              : step.status === 'completed'
                ? 'completed'
                : 'pending',
        progress: step.progress,
        meta: step.key.replace(/-/g, ' '),
      })),
    [job?.steps],
  )
  const hasAnimationPlan = Boolean(job?.artifacts.animationPlan)
  const promptText = job?.input.prompt?.trim() || 'Say "edit this video" or describe the edit you want.'
  const statusText =
    job?.status === 'completed'
      ? 'Edit pass ready'
      : job?.status === 'running'
        ? 'Edit job running'
        : job
          ? 'Edit job staged'
          : 'Waiting for an edit prompt'

  return (
    <motion.div
      initial={reduceMotion ? false : { opacity: 0, y: 10, filter: 'blur(8px)' }}
      animate={reduceMotion ? undefined : { opacity: 1, y: 0, filter: 'blur(0px)' }}
      transition={{ duration: reduceMotion ? 0 : 0.28, ease: [0.22, 1, 0.36, 1] }}
      className="flex h-full min-h-0 flex-col overflow-hidden rounded-[18px] border border-white/8 bg-white/[0.02] p-4"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[10px] uppercase tracking-[0.32em] text-white/35">Edit</div>
          <div className="mt-2 text-sm leading-6 text-white/72">
            This lane starts as soon as a prompt says to edit the imported video.
          </div>
          <div className="mt-2 text-[11px] uppercase tracking-[0.22em] text-white/42">{projectTitle}</div>
        </div>
        <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[11px] text-white/66">
          {job?.status === 'running' ? <Loader2 className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5" />}
          <span>{statusText}</span>
        </div>
      </div>

      <div className="mt-4 space-y-3 overflow-y-auto pr-1">
        {job ? (
          <>
            <div className="rounded-[16px] border border-white/8 bg-black/18 p-3">
              <div className="flex flex-wrap items-center gap-2">
                <div className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[11px] text-white/56">
                  Job {abbreviateJobId(job.id)}
                </div>
                <div
                  className={cn(
                    'rounded-full border px-3 py-1 text-[11px]',
                    job.status === 'running'
                      ? 'border-emerald-300/18 bg-emerald-300/10 text-emerald-50'
                      : job.status === 'completed'
                        ? 'border-sky-300/18 bg-sky-300/10 text-sky-50'
                        : 'border-white/10 bg-white/[0.04] text-white/56',
                  )}
                >
                  {job.status}
                </div>
                <div className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[11px] text-white/56">
                  {sourceLabel ?? 'Imported source'}
                </div>
              </div>

              <div className="mt-3 rounded-[14px] border border-white/8 bg-white/[0.03] px-4 py-3">
                <div className="text-[10px] uppercase tracking-[0.28em] text-white/34">Prompt</div>
                <p className="mt-2 text-sm leading-6 text-white/80">{promptText}</p>
              </div>

              <AnimatePresence initial={false}>
                {styleTemplate ? (
                  <motion.div
                    key={styleTemplate.id}
                    initial={reduceMotion ? false : { opacity: 0, y: 8 }}
                    animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
                    exit={reduceMotion ? undefined : { opacity: 0, y: 8 }}
                    className="mt-3 rounded-[14px] border border-white/8 bg-black/18 p-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-[10px] uppercase tracking-[0.28em] text-white/34">Style lane</div>
                        <div className="mt-1 truncate text-sm font-medium text-white/88">{styleTemplate.name}</div>
                        <div className="mt-1 text-xs leading-5 text-white/48">{styleTemplate.description}</div>
                      </div>
                      <Wand2 className="size-4 shrink-0 text-white/42" />
                    </div>

                    {styleTemplate.previewImages.length > 0 ? (
                      <div className="mt-3 grid gap-2 sm:grid-cols-2">
                        {styleTemplate.previewImages.slice(0, 2).map((previewImage) => (
                          <div
                            key={previewImage}
                            className="relative overflow-hidden rounded-[12px] border border-white/8 bg-black/30"
                          >
                            <img
                              src={previewImage}
                              alt={`${styleTemplate.name} preview`}
                              className="h-28 w-full object-cover"
                            />
                            <div className="absolute inset-x-0 bottom-0 bg-[linear-gradient(180deg,rgba(0,0,0,0)_0%,rgba(0,0,0,0.64)_100%)] px-3 py-2 text-[10px] uppercase tracking-[0.24em] text-white/72">
                              Preset asset
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : null}

                    <div className="mt-3 flex flex-wrap gap-2">
                      {styleTemplate.tags.map((tag) => (
                        <span
                          key={tag}
                          className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-[11px] text-white/58"
                        >
                          {tag}
                        </span>
                      ))}
                      {hasAnimationPlan ? (
                        <span className="rounded-full border border-emerald-300/18 bg-emerald-300/10 px-3 py-1 text-[11px] text-emerald-50">
                          Live overlay attached
                        </span>
                      ) : (
                        <span className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-[11px] text-white/58">
                          Building overlay
                        </span>
                      )}
                    </div>
                  </motion.div>
                ) : null}
              </AnimatePresence>
            </div>

            <div className="rounded-[16px] border border-white/8 bg-black/18 p-3">
              <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.28em] text-white/34">
                <CheckCircle2 className="size-3.5 text-white/42" />
                Job steps
              </div>
              <Plan items={planItems} className="mt-3" />
            </div>
          </>
        ) : (
          <div className="rounded-[16px] border border-white/8 bg-black/18 p-4 text-sm leading-6 text-white/66">
            Add a source video, then type an edit prompt like edit this video or make the first beat tighter.
            The edit job will start streaming and the preview will render the style lane on top of the imported media.
          </div>
        )}

        <div className="rounded-[16px] border border-white/8 bg-white/[0.02] p-3 text-sm leading-6 text-white/60">
          <div className="text-[10px] uppercase tracking-[0.28em] text-white/34">Preview link</div>
          <div className="mt-2">
            {hasAnimationPlan
              ? 'The overlay is already mapped to the imported video and the live stream can refine it in place.'
              : 'When the job starts, the preview will pick up the rendered text and preset asset lane automatically.'}
          </div>
        </div>
      </div>
    </motion.div>
  )
}
