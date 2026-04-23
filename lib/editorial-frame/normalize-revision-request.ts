import type {
  EditorialRevisionRequest,
  FrameAssistAttachment,
  FrameReferenceParseResult,
  RevisionIntent,
  RevisionableRegion,
} from './types'

function hasAny(text: string, keywords: string[]) {
  return keywords.some((keyword) => text.includes(keyword))
}

function inferRevisionIntent(text: string, selectedRegion: RevisionableRegion | null): RevisionIntent {
  const normalized = text.trim().toLowerCase()
  const regionCategory = selectedRegion?.category

  if (
    hasAny(normalized, [
      'replace',
      'swap',
      'swap out',
      'replace this asset',
      'change asset',
      'new asset',
      'new clip',
      'new image',
      'sub in',
    ]) ||
    (regionCategory === 'asset' && hasAny(normalized, ['asset', 'image', 'clip', 'shot']))
  ) {
    return 'replace_asset'
  }

  if (
    hasAny(normalized, [
      'remove',
      'delete',
      'cut out',
      'drop',
      'take out',
      'hide',
      'erase',
      'remove this overlay',
      'remove overlay',
    ]) ||
    (regionCategory === 'overlay' && hasAny(normalized, ['remove', 'delete', 'drop', 'hide']))
  ) {
    return 'remove_asset'
  }

  if (
    hasAny(normalized, [
      'slow down',
      'speed up',
      'faster',
      'slower',
      'adjust speed',
      'tempo',
      'pace',
      'stretch',
      'compress',
    ])
  ) {
    return 'adjust_speed'
  }

  if (
    hasAny(normalized, [
      'smooth',
      'smoother',
      'ease',
      'elegant',
      'fluid',
      'polish',
      'softer',
      'subtle',
      'refine motion',
      'motion curve',
    ]) ||
    regionCategory === 'graph'
  ) {
    return 'smooth_motion'
  }

  if (
    hasAny(normalized, [
      'replicate',
      'reference',
      'mirror',
      'match',
      'copy',
      'like the reference',
      'supplied reference',
      'same motion',
    ])
  ) {
    return 'replicate_reference'
  }

  if (
    hasAny(normalized, [
      'modify',
      'edit',
      'animation',
      'motion',
      'transition',
      'opener',
      'entrance',
      'exit',
      'move',
      'timing',
      'reframe',
    ])
  ) {
    return 'modify_animation'
  }

  return 'generic_revision'
}

function cleanInstructionText(value: string) {
  return value.replace(/\s+/g, ' ').trim()
}

export function normalizeRevisionRequest({
  rawText,
  analysis,
  selectedRegion,
  attachments = [],
}: {
  rawText: string
  analysis: FrameReferenceParseResult
  selectedRegion?: RevisionableRegion | null
  attachments?: FrameAssistAttachment[]
}): EditorialRevisionRequest {
  const nextSelectedRegion = selectedRegion ?? null
  const instructionText = cleanInstructionText(
    analysis.cleanInstructionText.length > 0 ? analysis.cleanInstructionText : rawText,
  )
  const intent = inferRevisionIntent(
    [instructionText, rawText].filter(Boolean).join(' '),
    nextSelectedRegion,
  )

  return {
    rawText,
    displayText: analysis.displayText,
    instructionText,
    frameTarget: analysis.frameTarget,
    matchedRegionId: nextSelectedRegion?.id ?? null,
    matchedRegionLabel: nextSelectedRegion?.label ?? null,
    selectedRegionMetadata: nextSelectedRegion,
    previewThumbnailUrl: nextSelectedRegion?.thumbnailUrl ?? null,
    attachments,
    intent,
  }
}

export function buildRevisionTargetHistoryEntry(request: EditorialRevisionRequest) {
  if (!request.frameTarget) return null

  return {
    id: request.matchedRegionId ?? `${request.frameTarget.startFrame}-${request.frameTarget.endFrame}-${Date.now()}`,
    label: request.matchedRegionLabel ?? `Frame ${request.frameTarget.startFrame}${request.frameTarget.type === 'range' ? `-${request.frameTarget.endFrame}` : ''}`,
    startFrame: request.frameTarget.startFrame,
    endFrame: request.frameTarget.endFrame,
    category: request.selectedRegionMetadata?.category ?? 'scene',
    thumbnailUrl: request.previewThumbnailUrl ?? null,
    matchedRegionId: request.matchedRegionId,
    matchedRegionLabel: request.matchedRegionLabel,
    selectedAt: new Date().toISOString(),
    approximate: request.selectedRegionMetadata?.approximate ?? false,
  }
}
