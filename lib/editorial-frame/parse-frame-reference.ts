import type { FrameReferenceParseResult, FrameTarget } from './types'

const MAX_FRAME_NUMBER = 999_999

function clampFrameNumber(value: number) {
  if (!Number.isFinite(value)) return null
  const next = Math.trunc(value)
  if (next < 1 || next > MAX_FRAME_NUMBER) return null
  return next
}

function collapseWhitespace(value: string) {
  return value.replace(/\s+/g, ' ').trim()
}

export function removeFrameReferenceSegment(text: string, startIndex: number, endIndex: number) {
  return collapseWhitespace(`${text.slice(0, startIndex)}${text.slice(endIndex)}`)
}

function buildFrameTarget(startFrame: number, endFrame: number): FrameTarget {
  if (startFrame <= endFrame) {
    return { type: startFrame === endFrame ? 'single' : 'range', startFrame, endFrame }
  }

  return { type: 'range', startFrame: endFrame, endFrame: startFrame }
}

function getLastCompleteMatchInfo(prefix: string) {
  const completePattern = /(^|[^a-z0-9])(@?frame)\b/gi
  let completeMatch: RegExpExecArray | null = null

  for (const match of prefix.matchAll(completePattern)) {
    completeMatch = match
  }

  return completeMatch
    ? {
        kind: 'complete' as const,
        match: completeMatch,
      }
    : null
}

function getTrailingPartialMatchInfo(prefix: string) {
  const partialPatterns = [
    /(^|[^a-z0-9])(@?fr(?:a(?:m(?:e)?)?)?)$/i,
    /(^|[^a-z0-9])(@?frame)\s*$/i,
  ]

  for (const pattern of partialPatterns) {
    const match = pattern.exec(prefix)
    if (match) {
      return {
        kind: 'partial' as const,
        match,
      }
    }
  }

  return null
}

function parseFrameTail(tailText: string) {
  const trimmed = tailText.replace(/^\s+/, '')
  if (!trimmed) {
    return {
      state: 'partial' as const,
      frameText: '',
      frameTarget: null,
      validationNote: null as string | null,
      consumedLength: 0,
    }
  }

  const rangeMatch = trimmed.match(/^(\d{1,6})(?:\s*-\s*(\d{0,6})?)?/)
  if (!rangeMatch) {
    return {
      state: 'invalid' as const,
      frameText: trimmed,
      frameTarget: null,
      validationNote: 'Use a frame number like @frame 30 or @frame 30-35.',
      consumedLength: 0,
    }
  }

  const startDigits = rangeMatch[1] ?? ''
  const endDigits = rangeMatch[2] ?? ''
  const hasRangeSeparator = trimmed.includes('-') && trimmed.indexOf('-') < rangeMatch[0].length
  const startFrame = clampFrameNumber(Number(startDigits))
  const endFrame = endDigits ? clampFrameNumber(Number(endDigits)) : null

  if (!startFrame) {
    return {
      state: 'invalid' as const,
      frameText: rangeMatch[0],
      frameTarget: null,
      validationNote: 'Frame numbers start at 1.',
      consumedLength: rangeMatch[0].length,
    }
  }

  if (hasRangeSeparator && !endDigits) {
    return {
      state: 'partial' as const,
      frameText: rangeMatch[0],
      frameTarget: null,
      validationNote: null as string | null,
      consumedLength: rangeMatch[0].length,
    }
  }

  if (endDigits && endDigits.length < startDigits.length && trimmed.length === rangeMatch[0].length) {
    return {
      state: 'partial' as const,
      frameText: rangeMatch[0],
      frameTarget: null,
      validationNote: null as string | null,
      consumedLength: rangeMatch[0].length,
    }
  }

  if (hasRangeSeparator && !endFrame) {
    return {
      state: 'invalid' as const,
      frameText: rangeMatch[0],
      frameTarget: null,
      validationNote: 'That frame range needs a valid ending frame.',
      consumedLength: rangeMatch[0].length,
    }
  }

  if (endFrame && endFrame < 1) {
    return {
      state: 'invalid' as const,
      frameText: rangeMatch[0],
      frameTarget: null,
      validationNote: 'That ending frame is out of range.',
      consumedLength: rangeMatch[0].length,
    }
  }

  const normalizedTarget = buildFrameTarget(startFrame, endFrame ?? startFrame)
  const canonicalText =
    normalizedTarget.type === 'single'
      ? `@frame ${normalizedTarget.startFrame}`
      : `@frame ${normalizedTarget.startFrame}-${normalizedTarget.endFrame}`

  return {
    state: 'ready' as const,
    frameText: rangeMatch[0],
    frameTarget: normalizedTarget,
    validationNote:
      normalizedTarget.type === 'range' && startFrame !== normalizedTarget.startFrame
        ? 'Reversed ranges are normalized automatically.'
        : null,
    canonicalText,
    consumedLength: rangeMatch[0].length,
  }
}

export function parseFrameReference(text: string, caretIndex = text.length): FrameReferenceParseResult {
  const rawText = text
  const caret = Math.max(0, Math.min(caretIndex, text.length))
  const prefix = text.slice(0, caret)
  const completeInfo = getLastCompleteMatchInfo(prefix)
  const partialInfo = completeInfo ? null : getTrailingPartialMatchInfo(prefix)

  if (!completeInfo && !partialInfo) {
    return {
      rawText,
      displayText: rawText,
      cleanInstructionText: collapseWhitespace(rawText),
      triggerText: null,
      triggerState: 'inactive',
      triggerStartIndex: null,
      triggerEndIndex: null,
      frameTarget: null,
      frameText: null,
      referenceText: null,
      referenceStartIndex: null,
      referenceEndIndex: null,
      isActive: false,
      isPartial: false,
      isValid: false,
      validationNote: null,
    }
  }

  const match = (completeInfo ?? partialInfo)?.match ?? null
  if (!match) {
    return {
      rawText,
      displayText: rawText,
      cleanInstructionText: collapseWhitespace(rawText),
      triggerText: null,
      triggerState: 'inactive',
      triggerStartIndex: null,
      triggerEndIndex: null,
      frameTarget: null,
      frameText: null,
      referenceText: null,
      referenceStartIndex: null,
      referenceEndIndex: null,
      isActive: false,
      isPartial: false,
      isValid: false,
      validationNote: null,
    }
  }

  const triggerStartIndex = (match.index ?? 0) + (match[1]?.length ?? 0)
  const triggerToken = match[2] ?? match[0].trim()
  const triggerEndIndex = triggerStartIndex + triggerToken.length
  const tailText = rawText.slice(triggerEndIndex)
  const parsedTail = parseFrameTail(tailText)
  const referenceStartIndex = triggerStartIndex
  const referenceEndIndex = triggerEndIndex + parsedTail.consumedLength
  const referenceText = rawText.slice(referenceStartIndex, referenceEndIndex)
  const frameTarget = parsedTail.frameTarget
  const isPartial = parsedTail.state === 'partial'
  const isValid = parsedTail.state === 'ready' && Boolean(frameTarget)
  const triggerState = parsedTail.state === 'ready' ? 'ready' : parsedTail.state
  const isActive =
    parsedTail.state === 'ready' ? caret >= referenceStartIndex && caret <= referenceEndIndex : caret >= triggerStartIndex

  const cleanInstructionText = removeFrameReferenceSegment(rawText, referenceStartIndex, referenceEndIndex)

  return {
    rawText,
    displayText: rawText,
    cleanInstructionText,
    triggerText: triggerToken,
    triggerState,
    triggerStartIndex,
    triggerEndIndex,
    frameTarget,
    frameText: parsedTail.frameText,
    referenceText,
    referenceStartIndex,
    referenceEndIndex,
    isActive,
    isPartial,
    isValid,
    validationNote: parsedTail.validationNote,
  }
}

export function canonicalizeFrameTarget(frameTarget: FrameTarget) {
  return frameTarget.type === 'single'
    ? `@frame ${frameTarget.startFrame}`
    : `@frame ${frameTarget.startFrame}-${frameTarget.endFrame}`
}

export function replaceFrameReferenceSegment(
  text: string,
  referenceStartIndex: number,
  referenceEndIndex: number,
  nextValue: string,
) {
  return `${text.slice(0, referenceStartIndex)}${nextValue}${text.slice(referenceEndIndex)}`
}
