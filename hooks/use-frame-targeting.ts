'use client'

import * as React from 'react'

import { buildRevisionTargetHistoryEntry, normalizeRevisionRequest } from '@/lib/editorial-frame/normalize-revision-request'
import { getFrameAssistStorageKey } from '@/lib/editorial-frame/mock-revisionable-regions'
import { canonicalizeFrameTarget, parseFrameReference, removeFrameReferenceSegment } from '@/lib/editorial-frame/parse-frame-reference'
import type {
  EditorialRevisionRequest,
  FrameAssistAttachment,
  FrameSuggestion,
  FrameTarget,
  FrameTargetHistoryEntry,
  RevisionableRegion,
} from '@/lib/editorial-frame/types'
import { readLocalStorageJSON, writeLocalStorageJSON } from '@/lib/storage'

const MAX_RECENT_TARGETS = 6
const MAX_VISIBLE_SUGGESTIONS = 8
const APPROXIMATE_MATCH_DISTANCE = 18

function frameTargetKey(frameTarget: FrameTarget) {
  return `${frameTarget.startFrame}-${frameTarget.endFrame}`
}

function buildFrameTarget(startFrame: number, endFrame: number): FrameTarget {
  return startFrame <= endFrame
    ? {
        type: startFrame === endFrame ? 'single' : 'range',
        startFrame,
        endFrame,
      }
    : {
        type: 'range',
        startFrame: endFrame,
        endFrame: startFrame,
      }
}

function targetDescription(frameTarget: FrameTarget) {
  return frameTarget.type === 'single'
    ? `Targeting a single frame at ${frameTarget.startFrame}`
    : `Targeting frames ${frameTarget.startFrame}-${frameTarget.endFrame}`
}

function isExactRegionMatch(region: RevisionableRegion, frameTarget: FrameTarget) {
  return region.startFrame === frameTarget.startFrame && region.endFrame === frameTarget.endFrame
}

function getRegionDistance(region: RevisionableRegion, frameTarget: FrameTarget) {
  const targetCenter = (frameTarget.startFrame + frameTarget.endFrame) / 2
  const regionCenter = (region.startFrame + region.endFrame) / 2

  if (region.startFrame <= frameTarget.endFrame && region.endFrame >= frameTarget.startFrame) {
    return 0
  }

  return Math.min(
    Math.abs(region.startFrame - frameTarget.endFrame),
    Math.abs(region.endFrame - frameTarget.startFrame),
    Math.abs(regionCenter - targetCenter),
  )
}

function sortRegionsForTarget(regions: RevisionableRegion[], frameTarget: FrameTarget) {
  return [...regions].sort((left, right) => {
    const leftDistance = getRegionDistance(left, frameTarget)
    const rightDistance = getRegionDistance(right, frameTarget)
    if (leftDistance !== rightDistance) return leftDistance - rightDistance

    const leftConfidence = left.confidence ?? 0
    const rightConfidence = right.confidence ?? 0
    if (leftConfidence !== rightConfidence) return rightConfidence - leftConfidence

    return left.startFrame - right.startFrame
  })
}

function sortRegionsByConfidence(regions: RevisionableRegion[]) {
  return [...regions].sort((left, right) => {
    const leftConfidence = left.confidence ?? 0
    const rightConfidence = right.confidence ?? 0
    if (leftConfidence !== rightConfidence) return rightConfidence - leftConfidence
    return left.startFrame - right.startFrame
  })
}

function toSuggestion(region: RevisionableRegion, kind: FrameSuggestion['kind'], frameTarget?: FrameTarget): FrameSuggestion {
  const resolvedTarget = frameTarget ?? buildFrameTarget(region.startFrame, region.endFrame)
  return {
    id: `${kind}:${region.id}`,
    kind,
    label: region.label,
    description: `${targetDescription(resolvedTarget)} - ${region.category}`,
    canonicalText: canonicalizeFrameTarget(resolvedTarget),
    thumbnailUrl: region.thumbnailUrl ?? null,
    region,
    frameTarget: resolvedTarget,
    category: region.category,
    confidence: region.confidence ?? null,
    isExact: kind === 'exact',
  }
}

function historyEntryToSuggestion(entry: FrameTargetHistoryEntry, region: RevisionableRegion | null): FrameSuggestion {
  const frameTarget = buildFrameTarget(entry.startFrame, entry.endFrame)
  return {
    id: `recent:${entry.id}`,
    kind: 'recent',
    label: entry.matchedRegionLabel ?? entry.label,
    description: `${targetDescription(frameTarget)} - ${entry.category}`,
    canonicalText: canonicalizeFrameTarget(frameTarget),
    thumbnailUrl: entry.thumbnailUrl ?? region?.thumbnailUrl ?? null,
    region,
    frameTarget,
    category: entry.category,
    confidence: region?.confidence ?? null,
    isExact: Boolean(entry.matchedRegionId) && !entry.approximate,
  }
}

function dedupeSuggestions(suggestions: FrameSuggestion[]) {
  const seen = new Set<string>()
  const result: FrameSuggestion[] = []

  for (const suggestion of suggestions) {
    const key = `${suggestion.kind}:${suggestion.frameTarget.startFrame}-${suggestion.frameTarget.endFrame}:${suggestion.region?.id ?? suggestion.label}`
    if (seen.has(key)) continue
    seen.add(key)
    result.push(suggestion)
  }

  return result
}

function sanitizeRecentTargets(entries: FrameTargetHistoryEntry[]) {
  return entries
    .filter(
      (entry): entry is FrameTargetHistoryEntry =>
        Boolean(entry) && Number.isFinite(entry.startFrame) && Number.isFinite(entry.endFrame) && Boolean(entry.label),
    )
    .slice(0, MAX_RECENT_TARGETS)
}

function normalizeRecentTargetList(
  current: FrameTargetHistoryEntry[],
  nextEntry: FrameTargetHistoryEntry,
) {
  const nextKey = `${nextEntry.startFrame}-${nextEntry.endFrame}`
  const deduped = current.filter((entry) => `${entry.startFrame}-${entry.endFrame}` !== nextKey)
  return sanitizeRecentTargets([nextEntry, ...deduped])
}

export function useFrameTargeting({
  projectId,
  draft,
  caretIndex,
  regions = [],
}: {
  projectId: string
  draft: string
  caretIndex: number
  regions?: RevisionableRegion[]
}) {
  const analysis = React.useMemo(() => parseFrameReference(draft, caretIndex), [caretIndex, draft])
  const [recentTargets, setRecentTargets] = React.useState<FrameTargetHistoryEntry[]>([])
  const [activeSuggestionIndex, setActiveSuggestionIndex] = React.useState(0)
  const recentTargetsKey = React.useMemo(() => getFrameAssistStorageKey(projectId), [projectId])
  const hasRevisionableRegions = regions.length > 0

  React.useEffect(() => {
    if (!projectId) return

    const saved = readLocalStorageJSON<FrameTargetHistoryEntry[]>(recentTargetsKey)
    if (Array.isArray(saved)) {
      setRecentTargets(sanitizeRecentTargets(saved))
      return
    }

    setRecentTargets([])
  }, [projectId, recentTargetsKey])

  React.useEffect(() => {
    if (!projectId) return
    writeLocalStorageJSON(recentTargetsKey, recentTargets.slice(0, MAX_RECENT_TARGETS))
  }, [projectId, recentTargets, recentTargetsKey])

  const exactMatchRegion = React.useMemo(() => {
    if (!analysis.frameTarget) return null
    const target = analysis.frameTarget
    return regions.find((region) => isExactRegionMatch(region, target)) ?? null
  }, [analysis.frameTarget, regions])

  const previewRegion = React.useMemo(() => {
    if (!analysis.frameTarget) return null
    if (exactMatchRegion) return exactMatchRegion

    const target = analysis.frameTarget
    const ranked = sortRegionsForTarget(regions, target)
    const candidate = ranked[0] ?? null
    if (!candidate) return null

    const distance = getRegionDistance(candidate, target)
    if (distance > APPROXIMATE_MATCH_DISTANCE) return null

    return {
      ...candidate,
      approximate: true,
      isExact: false,
    }
  }, [analysis.frameTarget, exactMatchRegion, regions])

  const suggestions = React.useMemo(() => {
    if (!analysis.isActive || !hasRevisionableRegions) return []

    const target = analysis.frameTarget
    const orderedRegions = target ? sortRegionsForTarget(regions, target) : sortRegionsByConfidence(regions)

    const exactSuggestions: FrameSuggestion[] = []
    const nearbySuggestions: FrameSuggestion[] = []

    if (target) {
      const exactRegions = orderedRegions.filter((region) => isExactRegionMatch(region, target)).slice(0, 3)
      exactRegions.forEach((region) => {
        exactSuggestions.push(toSuggestion(region, 'exact', target))
      })

      const nearbyRegions = orderedRegions
        .filter((region) => !isExactRegionMatch(region, target))
        .slice(0, 3)
      nearbyRegions.forEach((region) => {
        nearbySuggestions.push(toSuggestion(region, 'nearby'))
      })
    } else {
      const topRegions = orderedRegions.slice(0, 5)
      topRegions.forEach((region, index) => {
        if (index < 2) {
          exactSuggestions.push(toSuggestion(region, 'exact'))
        } else {
          nearbySuggestions.push(toSuggestion(region, 'nearby'))
        }
      })
    }

    const recentSuggestions = recentTargets.slice(0, 3).map((entry) => {
      const matchedRegion =
        regions.find((region) => region.id === entry.matchedRegionId) ??
        regions.find((region) => region.startFrame === entry.startFrame && region.endFrame === entry.endFrame) ??
        null

      return historyEntryToSuggestion(entry, matchedRegion)
    })

    const manualSuggestion: FrameSuggestion[] = target
      ? [
          {
            id: `manual:${frameTargetKey(target)}`,
            kind: 'manual',
            label: 'Use typed target',
            description: `Lock the request to ${canonicalizeFrameTarget(target)}`,
            canonicalText: canonicalizeFrameTarget(target),
            thumbnailUrl: previewRegion?.thumbnailUrl ?? null,
            region: previewRegion,
            frameTarget: target,
            category: previewRegion?.category ?? 'scene',
            confidence: previewRegion?.confidence ?? null,
            isExact: Boolean(previewRegion && isExactRegionMatch(previewRegion, target)),
          },
        ]
      : []

    return dedupeSuggestions([
      ...exactSuggestions,
      ...nearbySuggestions,
      ...recentSuggestions,
      ...manualSuggestion,
    ]).slice(0, MAX_VISIBLE_SUGGESTIONS)
  }, [analysis.frameTarget, analysis.isActive, hasRevisionableRegions, previewRegion, recentTargets, regions])

  const suggestionSignature = React.useMemo(() => suggestions.map((suggestion) => suggestion.id).join('|'), [suggestions])

  React.useEffect(() => {
    if (suggestions.length === 0) {
      setActiveSuggestionIndex(-1)
      return
    }

    setActiveSuggestionIndex(0)
  }, [suggestionSignature, suggestions.length])

  const clampSuggestionIndex = React.useCallback(
    (nextIndex: number) => {
      if (suggestions.length === 0) return -1
      const normalized = ((nextIndex % suggestions.length) + suggestions.length) % suggestions.length
      return normalized
    },
    [suggestions.length],
  )

  const confirmSuggestion = React.useCallback(
    (suggestion: FrameSuggestion) => {
      if (analysis.referenceStartIndex === null || analysis.referenceEndIndex === null) {
        return {
          nextDraft: draft,
          nextCaretIndex: caretIndex,
        }
      }

      const rebuilt = `${draft.slice(0, analysis.referenceStartIndex)}${suggestion.canonicalText}${draft.slice(
        analysis.referenceEndIndex,
      )}`

      return {
        nextDraft: rebuilt.replace(/\s+/g, ' ').trim(),
        nextCaretIndex: analysis.referenceStartIndex + suggestion.canonicalText.length,
      }
    },
    [analysis.referenceEndIndex, analysis.referenceStartIndex, caretIndex, draft],
  )

  const clearFrameTarget = React.useCallback(() => {
    if (analysis.referenceStartIndex === null || analysis.referenceEndIndex === null) return draft
    return removeFrameReferenceSegment(draft, analysis.referenceStartIndex, analysis.referenceEndIndex)
  }, [analysis.referenceEndIndex, analysis.referenceStartIndex, draft])

  const buildRevisionRequest = React.useCallback(
    (attachments: FrameAssistAttachment[] = []) => {
      return normalizeRevisionRequest({
        rawText: draft,
        analysis,
        selectedRegion: previewRegion ?? null,
        attachments,
      })
    },
    [analysis, draft, previewRegion],
  )

  const recordRecentTarget = React.useCallback((request: EditorialRevisionRequest) => {
    if (!request.frameTarget) return

    const entry = buildRevisionTargetHistoryEntry(request)
    if (!entry) return

    setRecentTargets((current) => normalizeRecentTargetList(current, entry))
  }, [])

  const isPopoverOpen = analysis.isActive && suggestions.length > 0

  return {
    analysis,
    suggestions,
    activeSuggestionIndex,
    setActiveSuggestionIndex,
    clampSuggestionIndex,
    isPopoverOpen,
    previewRegion,
    confirmSuggestion,
    clearFrameTarget,
    buildRevisionRequest,
    recordRecentTarget,
    recentTargets,
  }
}
