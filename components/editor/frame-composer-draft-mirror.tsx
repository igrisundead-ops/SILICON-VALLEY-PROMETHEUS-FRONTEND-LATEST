'use client'

import * as React from 'react'

import type { FrameReferenceParseResult } from '@/lib/editorial-frame/types'
import { cn } from '@/lib/utils'
import { FrameTokenChip } from './frame-token-chip'

type FrameComposerDraftMirrorProps = {
  draft: string
  analysis: FrameReferenceParseResult
  scrollLeft?: number
  className?: string
}

export function FrameComposerDraftMirror({
  draft,
  analysis,
  scrollLeft = 0,
  className,
}: FrameComposerDraftMirrorProps) {
  const composerFontFamily = 'var(--font-newsreader), "Iowan Old Style", "Palatino Linotype", serif'
  const hasReference = analysis.referenceStartIndex !== null && analysis.referenceEndIndex !== null
  const isExplicitFrameTrigger = Boolean(analysis.triggerText?.startsWith('@'))

  if (!draft) return null

  const containerStyle = {
    transform: scrollLeft > 0 ? `translateX(${-scrollLeft}px)` : undefined,
  } as React.CSSProperties
  const textStyle = {
    ...containerStyle,
    fontFamily: composerFontFamily,
  } as React.CSSProperties

  if (!hasReference || !isExplicitFrameTrigger || analysis.triggerStartIndex === null || analysis.triggerEndIndex === null) {
    return (
      <div
        aria-hidden
        className={cn(
        'inline-flex min-w-max items-center whitespace-pre text-[20px] italic leading-[1.35] tracking-[0.01em] text-white/92',
        className,
      )}
      style={textStyle}
    >
      {draft}
    </div>
  )
  }

  const prefix = draft.slice(0, analysis.triggerStartIndex)
  const triggerText = draft.slice(analysis.triggerStartIndex, analysis.triggerEndIndex) || analysis.triggerText || '@frame'
  const suffix = draft.slice(analysis.triggerEndIndex)
  const chipTone = analysis.triggerState === 'invalid' ? 'rose' : 'blue'

  return (
    <div
      aria-hidden
      className={cn(
        'inline-flex min-w-max items-center whitespace-pre text-[20px] italic leading-[1.35] tracking-[0.01em] text-white/92',
        className,
      )}
      style={textStyle}
    >
      {prefix ? <span>{prefix}</span> : null}
      <FrameTokenChip
        label={triggerText}
        tone={chipTone}
        selected
        className="mx-[0.08em] px-3.5 py-1.5 text-[19px] font-medium not-italic leading-none tracking-[-0.01em] shadow-[0_18px_34px_-24px_rgba(73,153,255,0.78),0_0_26px_rgba(127,242,212,0.2)]"
      />
      {suffix ? <span>{suffix}</span> : null}
    </div>
  )
}
