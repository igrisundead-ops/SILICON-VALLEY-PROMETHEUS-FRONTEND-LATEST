'use client'

import * as React from 'react'
import Image from 'next/image'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowUpRight, Clock3, Search, Sparkles } from 'lucide-react'

import type { FrameSuggestion } from '@/lib/editorial-frame/types'
import { cn } from '@/lib/utils'
import { useStableReducedMotion } from '@/hooks/use-stable-reduced-motion'
import { FrameTokenChip } from './frame-token-chip'

type FrameSuggestionPopoverProps = {
  open: boolean
  suggestions: FrameSuggestion[]
  activeIndex: number
  onSelect: (suggestion: FrameSuggestion) => void
  onDismiss: () => void
  onMoveActive: (delta: number) => void
  validationNote?: string | null
}

function groupLabel(kind: FrameSuggestion['kind']) {
  switch (kind) {
    case 'exact':
      return 'Matching revisionable regions'
    case 'nearby':
      return 'Nearby frame regions'
    case 'recent':
      return 'Recent targets'
    case 'manual':
      return 'Manual target'
    default:
      return 'Suggestions'
  }
}

function groupAccent(kind: FrameSuggestion['kind']) {
  switch (kind) {
    case 'exact':
      return 'text-[#9ff6e3]'
    case 'nearby':
      return 'text-[#7fb8ff]'
    case 'recent':
      return 'text-[#c3b8ff]'
    case 'manual':
      return 'text-white/70'
    default:
      return 'text-white/70'
  }
}

export function FrameSuggestionPopover({
  open,
  suggestions,
  activeIndex,
  onSelect,
  onDismiss,
  onMoveActive,
  validationNote,
}: FrameSuggestionPopoverProps) {
  const reduceMotion = useStableReducedMotion()

  const grouped = React.useMemo(() => {
    const sections: Array<{ kind: FrameSuggestion['kind']; items: FrameSuggestion[] }> = []
    for (const kind of ['exact', 'nearby', 'recent', 'manual'] as const) {
      const items = suggestions.filter((item) => item.kind === kind)
      if (items.length > 0) sections.push({ kind, items })
    }
    return sections
  }, [suggestions])

  return (
    <AnimatePresence initial={false}>
      {open ? (
        <motion.div
          initial={reduceMotion ? false : { opacity: 0, y: 10, scale: 0.98 }}
          animate={reduceMotion ? undefined : { opacity: 1, y: 0, scale: 1 }}
          exit={reduceMotion ? undefined : { opacity: 0, y: 8, scale: 0.985 }}
          transition={{ duration: reduceMotion ? 0 : 0.24, ease: [0.22, 1, 0.36, 1] }}
          className="pointer-events-auto w-[min(34rem,calc(100vw-1.5rem))] overflow-hidden rounded-[22px] border border-white/10 bg-[linear-gradient(180deg,rgba(12,12,18,0.96)_0%,rgba(8,8,12,0.98)_100%)] shadow-[0_22px_52px_-30px_rgba(0,0,0,0.9),0_0_0_1px_rgba(255,255,255,0.02)] backdrop-blur-xl"
          role="listbox"
          aria-label="Frame suggestions"
        >
          <div className="border-b border-white/8 px-4 py-3">
            <div className="flex items-center justify-between gap-3">
              <div className="inline-flex items-center gap-2 text-[10px] uppercase tracking-[0.3em] text-white/38">
                <Sparkles className="size-3.5 text-[#9ff6e3]" />
                Frame Assist
              </div>
              <button
                type="button"
                onClick={onDismiss}
                className="rounded-full border border-white/8 bg-white/[0.04] px-2.5 py-1 text-[10px] uppercase tracking-[0.2em] text-white/42 transition-colors hover:text-white/78"
              >
                Dismiss
              </button>
            </div>
            <div className="mt-2 flex items-center gap-2 text-[12px] leading-5 text-white/52">
              <Search className="size-3.5 text-white/36" />
              <span>Use a known range, a recent target, or keep typing a manual frame reference.</span>
            </div>
            {validationNote ? <div className="mt-2 text-[11px] leading-5 text-rose-100/72">{validationNote}</div> : null}
          </div>

          <div className="max-h-[19rem] overflow-y-auto px-2 py-2">
            {grouped.map((section) => (
              <div key={section.kind} className="mb-3 last:mb-0">
                <div className="px-2 pb-2 text-[10px] uppercase tracking-[0.24em] text-white/32">
                  {groupLabel(section.kind)}
                </div>
                <div className="space-y-1.5">
                  {section.items.map((suggestion) => {
                    const index = suggestions.findIndex((item) => item.id === suggestion.id)
                    const isActive = index === activeIndex

                    return (
                      <button
                        key={suggestion.id}
                        type="button"
                        role="option"
                        aria-selected={isActive}
                        onMouseEnter={() => onMoveActive(index - activeIndex)}
                        onMouseDown={(event) => {
                          event.preventDefault()
                          onSelect(suggestion)
                        }}
                        className={cn(
                          'group flex w-full items-stretch gap-3 rounded-[16px] border px-2.5 py-2 text-left transition-colors',
                          isActive
                            ? 'border-white/14 bg-white/[0.08] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]'
                            : 'border-white/8 bg-white/[0.03] hover:border-white/12 hover:bg-white/[0.06]',
                        )}
                      >
                        <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-[14px] border border-white/8 bg-white/[0.04]">
                          {suggestion.thumbnailUrl ? (
                            <Image
                              src={suggestion.thumbnailUrl}
                              alt=""
                              fill
                              className="object-cover"
                              sizes="56px"
                            />
                          ) : (
                            <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.08)_0%,rgba(255,255,255,0.02)_100%)]" />
                          )}
                          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0)_0%,rgba(0,0,0,0.42)_100%)]" />
                        </div>

                        <div className="min-w-0 flex-1 py-0.5">
                          <div className="flex items-center gap-2">
                            <div className="truncate text-[13px] font-medium text-white/92">{suggestion.label}</div>
                            <FrameTokenChip
                              label={`@frame ${suggestion.frameTarget.startFrame}${
                                suggestion.frameTarget.type === 'range' ? `-${suggestion.frameTarget.endFrame}` : ''
                              }`}
                              tone={section.kind === 'manual' ? 'neutral' : 'blue'}
                              className="shrink-0 px-2.5 py-1 text-[10px]"
                            />
                          </div>
                          <div className="mt-1 flex items-center gap-2 text-[12px] leading-5 text-white/52">
                            <Clock3 className="size-3.5 shrink-0 text-white/32" />
                            <span>{suggestion.description}</span>
                          </div>
                        </div>

                        <div className="flex shrink-0 flex-col items-end justify-between gap-1 py-0.5">
                          <div className={cn('text-[10px] uppercase tracking-[0.24em]', groupAccent(section.kind))}>
                            {section.kind}
                          </div>
                          <ArrowUpRight className="size-4 text-white/28 transition-colors group-hover:text-white/72" />
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}
            {suggestions.length === 0 ? (
              <div className="px-3 py-8 text-center text-[12px] leading-5 text-white/42">
                No matching frame regions yet. Keep typing a frame target or pick a nearby revisionable region.
              </div>
            ) : null}
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}
