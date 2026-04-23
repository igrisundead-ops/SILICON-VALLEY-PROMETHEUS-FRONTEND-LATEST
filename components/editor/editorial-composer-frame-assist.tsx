'use client'

import { AnimatePresence, motion } from 'framer-motion'

import type {
  FrameSuggestion,
  QueuedPreviewRevisionState,
  RevisionableRegion,
} from '@/lib/editorial-frame/types'
import { useStableReducedMotion } from '@/hooks/use-stable-reduced-motion'
import { FrameSuggestionPopover } from './frame-suggestion-popover'
import { FramePreviewCard } from './frame-preview-card'

type EditorialComposerFrameAssistProps = {
  suggestions: FrameSuggestion[]
  activeSuggestionIndex: number
  isPopoverOpen: boolean
  previewRegion: RevisionableRegion | null
  queuedPreviewRevision?: QueuedPreviewRevisionState | null
  validationNote?: string | null
  onMoveActiveSuggestion: (delta: number) => void
  onSelectSuggestion: (suggestion: FrameSuggestion) => void
  onDismissSuggestions: () => void
  onClearFrameTarget: () => void
  onRetargetFrameTarget: () => void
  className?: string
}

export function EditorialComposerFrameAssist({
  suggestions,
  activeSuggestionIndex,
  isPopoverOpen,
  previewRegion,
  queuedPreviewRevision,
  validationNote,
  onMoveActiveSuggestion,
  onSelectSuggestion,
  onDismissSuggestions,
  onClearFrameTarget,
  onRetargetFrameTarget,
  className,
}: EditorialComposerFrameAssistProps) {
  const reduceMotion = useStableReducedMotion()
  const resolvedFrameTarget =
    queuedPreviewRevision?.request.frameTarget ??
    (previewRegion
      ? {
          type: previewRegion.startFrame === previewRegion.endFrame ? 'single' : 'range',
          startFrame: previewRegion.startFrame,
          endFrame: previewRegion.endFrame,
        }
      : null)
  const resolvedRegion = queuedPreviewRevision?.request.selectedRegionMetadata ?? previewRegion ?? null
  const resolvedThumbnailUrl = queuedPreviewRevision?.request.previewThumbnailUrl ?? previewRegion?.thumbnailUrl ?? null
  const shouldRenderPopover = isPopoverOpen && suggestions.length > 0
  const shouldRenderPreview = Boolean(resolvedFrameTarget && (previewRegion || queuedPreviewRevision))

  if (!shouldRenderPopover && !shouldRenderPreview) return null

  return (
    <div className={className}>
      <AnimatePresence initial={false}>
        {shouldRenderPreview ? (
          <motion.div
            key="frame-preview"
            initial={reduceMotion ? false : { opacity: 0, y: -6 }}
            animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
            exit={reduceMotion ? undefined : { opacity: 0, y: -4 }}
            transition={{ duration: reduceMotion ? 0 : 0.22, ease: [0.22, 1, 0.36, 1] }}
            className="mb-2.5"
          >
            <FramePreviewCard
              frameTarget={resolvedFrameTarget!}
              region={resolvedRegion}
              thumbnailUrl={resolvedThumbnailUrl}
              queuedPreviewRevision={queuedPreviewRevision}
              validationNote={validationNote}
              onClear={onClearFrameTarget}
              onRetarget={onRetargetFrameTarget}
            />
          </motion.div>
        ) : null}
      </AnimatePresence>

      <div className="absolute left-1/2 bottom-full z-50 mb-3 -translate-x-1/2">
        <FrameSuggestionPopover
          open={shouldRenderPopover}
          suggestions={suggestions}
          activeIndex={activeSuggestionIndex}
          onSelect={onSelectSuggestion}
          onDismiss={onDismissSuggestions}
          onMoveActive={onMoveActiveSuggestion}
          validationNote={validationNote}
        />
      </div>
    </div>
  )
}
