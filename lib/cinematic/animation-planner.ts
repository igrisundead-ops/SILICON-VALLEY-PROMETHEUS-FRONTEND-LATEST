import type {
  AnimationPlan,
  BRollSuggestion,
  CinematicAssetRegistry,
  CinematicTemplateAsset,
  CounterCue,
  DetectedScene,
  ExplainerCue,
  HighlightTimestamp,
  ProcessingJobInput,
  SpeechCue,
  SpeechCueAccentTone,
  SpeechCueTreatment,
  TranscriptSegment,
  TransitionCue,
  BackgroundCue,
  SfxCue,
} from '@/lib/types'

type BuildCinematicAnimationPlanInput = {
  projectId: string
  input: ProcessingJobInput
  transcript: TranscriptSegment[]
  scenes: DetectedScene[]
  highlights: HighlightTimestamp[]
  brollSuggestions: BRollSuggestion[]
  registry: CinematicAssetRegistry
}

type EmphasisParts = {
  leadText: string
  accentText: string
  trailingText: string
  treatment: SpeechCueTreatment
  tone: SpeechCueAccentTone
}

const ENGINE_VERSION = 'cinematic-preview-v1'

const STOPWORDS = new Set([
  'the',
  'and',
  'for',
  'with',
  'that',
  'this',
  'your',
  'from',
  'into',
  'when',
  'then',
  'have',
  'will',
  'just',
  'they',
  'them',
  'what',
  'make',
  'does',
  'doesnt',
  "doesn't",
  'about',
  'there',
  'their',
  'while',
  'would',
  'could',
])

const BUILTIN_PEOPLE_ASSETS = [
  { id: 'hormozi', tokens: ['hormozi', 'alex'], url: '/library/people/hormozi.png' },
  { id: 'iman-gadzhi', tokens: ['iman', 'gadzhi'], url: '/library/people/iman-gadzhi.png' },
  { id: 'ray-dalio', tokens: ['ray', 'dalio'], url: '/library/people/ray-dalio.png' },
  { id: 'codie-sanchez', tokens: ['codie', 'sanchez'], url: '/library/people/codie-sanchez.png' },
  { id: 'dan-martell', tokens: ['dan', 'martell'], url: '/library/people/dan-martell.png' },
  { id: 'dean-graziosi', tokens: ['dean', 'graziosi'], url: '/library/people/dean-graziosi.png' },
] as const

export function buildCinematicAnimationPlan({
  projectId,
  input,
  transcript,
  scenes,
  highlights,
  brollSuggestions,
  registry,
}: BuildCinematicAnimationPlanInput): AnimationPlan {
  const orderedTranscript = [...transcript].sort((left, right) => left.startMs - right.startMs)
  const speechCues: SpeechCue[] = []
  const transitionCues: TransitionCue[] = []
  const explainerCues: ExplainerCue[] = []
  const backgroundCues: BackgroundCue[] = []
  const counterCues: CounterCue[] = []
  const sfxCues: SfxCue[] = []

  let abstractBackgroundIndex = 0
  let explainerCount = 0

  orderedTranscript.forEach((segment, index) => {
    const emphasis = splitSpeechCue(segment.text)
    const conceptShift = shouldCreateHeading(segment.text, index)
    const comparison = isComparisonText(segment.text)
    const numericClaim = parseNumericValue(segment.text)
    const properNoun = findBuiltInPerson(segment.text)

    speechCues.push({
      id: cueId(projectId, 'caption', segment.startMs),
      variant: 'caption',
      startMs: segment.startMs,
      endMs: segment.endMs,
      text: segment.text,
      leadText: emphasis.leadText,
      accentText: emphasis.accentText,
      trailingText: emphasis.trailingText,
      treatment: emphasis.treatment,
      tone: emphasis.tone,
      region: 'safe-lower-third',
      alignment: properNoun ? 'left' : 'center',
      bottomPaddingPct: 13,
      maxWidthPct: 70,
      transcriptId: segment.id,
    })

    if (conceptShift) {
      const headingWindowEnd = Math.min(segment.endMs, segment.startMs + 2600)
      speechCues.push({
        id: cueId(projectId, 'heading', segment.startMs),
        variant: 'heading',
        startMs: segment.startMs,
        endMs: headingWindowEnd,
        text: emphasis.accentText || segment.text,
        leadText: emphasis.leadText,
        accentText: emphasis.accentText,
        trailingText: emphasis.trailingText,
        treatment: emphasis.treatment,
        tone: emphasis.tone,
        region: 'center-stage',
        alignment: 'left',
        maxWidthPct: 62,
        transcriptId: segment.id,
      })

      transitionCues.push({
        id: cueId(projectId, 'line', Math.max(0, segment.startMs - 180)),
        type: 'line',
        startMs: Math.max(0, segment.startMs - 180),
        endMs: segment.startMs + 520,
        region: 'center-stage',
        direction: 'center-out',
        label: 'Section divider',
      })

      sfxCues.push({
        id: cueId(projectId, 'sfx-line', segment.startMs),
        cue: 'line-sweep',
        intensity: comparison ? 'bold' : 'medium',
        startMs: Math.max(0, segment.startMs - 80),
        endMs: segment.startMs + 280,
      })
    }

    if (numericClaim) {
      counterCues.push({
        id: cueId(projectId, 'counter', segment.startMs),
        startMs: segment.startMs + 120,
        endMs: Math.min(segment.endMs, segment.startMs + 2400),
        region: 'center-stage',
        label: numericClaim.label,
        from: 0,
        to: numericClaim.value,
        prefix: numericClaim.prefix,
        suffix: numericClaim.suffix,
        format: numericClaim.format,
        icon: numericClaim.format === 'currency' ? 'chart' : 'spark',
      })

      sfxCues.push({
        id: cueId(projectId, 'sfx-counter', segment.startMs),
        cue: 'counter-tick',
        intensity: 'medium',
        startMs: segment.startMs + 120,
        endMs: Math.min(segment.endMs, segment.startMs + 2400),
      })
    }

    if (properNoun) {
      backgroundCues.push({
        id: cueId(projectId, 'person', segment.startMs),
        startMs: segment.startMs,
        endMs: Math.min(segment.endMs, segment.startMs + 3600),
        kind: 'image',
        region: 'right-panel',
        sourceId: properNoun.id,
        sourceUrl: properNoun.url,
        transform: 'softWash',
        opacity: 0.72,
        blendMode: 'screen',
        placement: 'right-stage',
      })

      sfxCues.push({
        id: cueId(projectId, 'sfx-bg', segment.startMs),
        cue: 'background-pop',
        intensity: 'subtle',
        startMs: segment.startMs,
        endMs: segment.startMs + 420,
      })
    }

    if ((comparison || numericClaim || conceptShift) && explainerCount < 3) {
      const explainer = buildExplainerCue({
        projectId,
        segment,
        registry,
        comparison,
        numericClaim,
        prompt: input.prompt,
      })

      if (explainer) {
        explainerCues.push(explainer)
        explainerCount += 1

        if (explainer.layout === 'side-panel') {
          transitionCues.push({
            id: cueId(projectId, 'side-pan', explainer.startMs),
            type: 'side-pan',
            startMs: Math.max(0, explainer.startMs - 120),
            endMs: explainer.endMs,
            region: 'left-panel',
            direction: 'left-to-right',
            label: explainer.title,
          })
        }

        const abstractBackground = registry.backgrounds[abstractBackgroundIndex % Math.max(1, registry.backgrounds.length)]
        if (abstractBackground) {
          backgroundCues.push({
            id: cueId(projectId, 'wash', explainer.startMs),
            startMs: Math.max(0, explainer.startMs - 100),
            endMs: explainer.endMs,
            kind: 'video',
            region: 'background-wash',
            sourceId: abstractBackground.id,
            sourceUrl: abstractBackground.url,
            transform: abstractBackground.transform,
            opacity: explainer.layout === 'full-frame' ? 0.3 : 0.18,
            blendMode: 'overlay',
            placement: 'full-frame',
          })
          abstractBackgroundIndex += 1
        }
      }
    }
  })

  highlights.forEach((highlight, index) => {
    if (index >= 3) return
    const linked = orderedTranscript.find((segment) => highlight.atMs >= segment.startMs && highlight.atMs <= segment.endMs)
    if (!linked) return
    transitionCues.push({
      id: cueId(projectId, 'divider', highlight.atMs),
      type: 'section-divider',
      startMs: Math.max(0, highlight.atMs - 120),
      endMs: highlight.atMs + 500,
      region: 'center-stage',
      direction: 'out-in',
      label: highlight.label,
    })
  })

  if (brollSuggestions.length > 0 && registry.backgrounds.length > 0) {
    const suggestion = brollSuggestions[0]
    backgroundCues.push({
      id: cueId(projectId, 'broll', suggestion.startMs),
      startMs: suggestion.startMs,
      endMs: suggestion.endMs,
      kind: 'video',
      region: 'background-wash',
      sourceId: registry.backgrounds[0]!.id,
      sourceUrl: registry.backgrounds[0]!.url,
      transform: 'rotateAndCover16x9',
      opacity: 0.14,
      blendMode: 'screen',
      placement: 'full-frame',
    })
  }

  return {
    engineVersion: ENGINE_VERSION,
    generatedAt: new Date().toISOString(),
    registrySignature: registry.signature,
    safeZonePolicy: {
      landscapeOnly: true,
      avoidSpeakerFace: true,
      captionBottomPaddingPct: 13,
      maxCaptionWidthPct: 70,
    },
    speechCues,
    transitionCues,
    explainerCues,
    backgroundCues,
    counterCues,
    sfxCues,
  }
}

function buildExplainerCue({
  projectId,
  segment,
  registry,
  comparison,
  numericClaim,
  prompt,
}: {
  projectId: string
  segment: TranscriptSegment
  registry: CinematicAssetRegistry
  comparison: boolean
  numericClaim: ReturnType<typeof parseNumericValue>
  prompt: string
}) {
  const template = pickTemplate({
    templates: registry.templates,
    segmentText: segment.text,
    prompt,
    comparison,
    numericClaim: Boolean(numericClaim),
  })

  if (!template) return null

  const heading = splitSpeechCue(segment.text)
  const comparisonPrimary = heading.accentText || 'Structure over surface'
  const comparisonSecondary = cleanSentence(segment.text)
  const sidePanel = comparison || numericClaim !== null || template.preferredLayout === 'side-panel'

  const textSlots = fillTemplateTextSlots(template, {
    primary: numericClaim?.displayValue ?? comparisonPrimary,
    secondary:
      numericClaim?.label ??
      comparisonSecondary ??
      cleanSentence(prompt) ??
      'A clear visual explainer keeps the point easy to retrieve.',
    tertiary:
      comparison
        ? ['Surface', 'Structure', 'Shift the frame, not just the decoration.']
        : ['Live sync', 'This moment', 'Context layer'],
    stray: ['Prometheus'],
  })

  const imageSlots = template.imageSlotNames.length > 0 ? fillTemplateImageSlots(template, segment.text) : undefined

  return {
    id: cueId(projectId, 'explainer', segment.startMs),
    startMs: segment.startMs + 160,
    endMs: Math.min(segment.endMs + 1200, segment.startMs + 5200),
    layout: sidePanel ? 'side-panel' : 'full-frame',
    region: sidePanel ? 'left-panel' : 'full-frame',
    templateId: template.id,
    templateType: template.type,
    internalMotionCapable: template.internalMotionCapable,
    textSlots,
    imageSlots,
    title: template.displayName,
    concept: heading.accentText || segment.text,
  } satisfies ExplainerCue
}

function fillTemplateTextSlots(
  template: CinematicTemplateAsset,
  values: {
    primary: string
    secondary: string
    tertiary: string[]
    stray: string[]
  },
) {
  const tertiary = [...values.tertiary]
  const stray = [...values.stray]
  const slots: Record<string, string> = {}

  template.textSlotNames.forEach((slotName, index) => {
    const role = (template.textSlotRoles[index] ?? inferRoleFromSlotName(slotName)).toLowerCase()
    if (role === 'primary') {
      slots[slotName] = values.primary
      return
    }
    if (role === 'secondary') {
      slots[slotName] = values.secondary
      return
    }
    if (role === 'tertiary') {
      slots[slotName] = tertiary.shift() ?? values.secondary
      return
    }
    slots[slotName] = stray.shift() ?? values.primary
  })

  return slots
}

function fillTemplateImageSlots(template: CinematicTemplateAsset, segmentText: string) {
  const linkedPeople = BUILTIN_PEOPLE_ASSETS.filter((entry) =>
    entry.tokens.some((token) => normalizeText(segmentText).includes(token)),
  )

  const fallbacks = [
    '/library/people/iman-gadzhi.png',
    '/library/people/hormozi.png',
    '/library/people/ray-dalio.png',
  ]

  const imageSlots: Record<string, string> = {}
  template.imageSlotNames.forEach((slotName, index) => {
    imageSlots[slotName] = linkedPeople[index]?.url ?? fallbacks[index % fallbacks.length]!
  })

  return imageSlots
}

function pickTemplate({
  templates,
  segmentText,
  prompt,
  comparison,
  numericClaim,
}: {
  templates: CinematicTemplateAsset[]
  segmentText: string
  prompt: string
  comparison: boolean
  numericClaim: boolean
}) {
  if (templates.length === 0) return null

  const haystack = normalizeText(`${segmentText} ${prompt}`)
  const ranked = templates
    .map((template) => ({
      template,
      score: scoreTemplate(template, haystack, comparison, numericClaim),
    }))
    .sort((left, right) => right.score - left.score)

  return ranked[0]?.template ?? null
}

function scoreTemplate(
  template: CinematicTemplateAsset,
  haystack: string,
  comparison: boolean,
  numericClaim: boolean,
) {
  let score = 0
  if (comparison && template.type === 'infographic-card') score += 8
  if (numericClaim && ['glass-analytics-card', 'finance-card', 'budget-card'].includes(template.type)) score += 10
  if (!comparison && !numericClaim && ['headline-card', 'command-bar', 'typographic-poster'].includes(template.type)) score += 6

  for (const keyword of template.keywords) {
    if (keyword.length >= 3 && haystack.includes(normalizeText(keyword))) {
      score += 2
    }
  }

  return score
}

function findBuiltInPerson(value: string) {
  const haystack = normalizeText(value)
  return BUILTIN_PEOPLE_ASSETS.find((entry) => entry.tokens.some((token) => haystack.includes(token))) ?? null
}

function shouldCreateHeading(text: string, index: number) {
  const normalized = normalizeText(text)
  if (index === 0) return true
  if (index % 3 === 0) return true
  return (
    normalized.includes('structure') ||
    normalized.includes('retrieval') ||
    normalized.includes('system') ||
    normalized.includes('framework') ||
    normalized.includes('doesnt matter')
  )
}

function isComparisonText(text: string) {
  const normalized = normalizeText(text)
  return (
    normalized.includes('versus') ||
    normalized.includes(' vs ') ||
    normalized.includes('over surface') ||
    normalized.includes('myth') ||
    normalized.includes('fact') ||
    normalized.includes('instead of') ||
    normalized.includes('compare')
  )
}

function splitSpeechCue(text: string): EmphasisParts {
  const source = cleanSentence(text)
  const numeric = parseNumericValue(source)
  if (numeric) {
    const leadText = source.replace(numeric.raw, '').replace(/\s{2,}/g, ' ').trim()
    return {
      leadText,
      accentText: numeric.displayValue,
      trailingText: '',
      treatment: 'boxed',
      tone: 'lime',
    }
  }

  const tokens = source.split(/\s+/).filter(Boolean)
  const candidates = tokens.filter((token) => normalizeText(token).length >= 4 && !STOPWORDS.has(normalizeText(token)))
  const accentWords = candidates.slice(-2)
  const accentText = accentWords.join(' ').trim() || tokens.slice(-2).join(' ').trim() || source
  const accentIndex = source.toLowerCase().lastIndexOf(accentText.toLowerCase())

  if (accentIndex <= 0) {
    return {
      leadText: '',
      accentText,
      trailingText: '',
      treatment: source.length <= 22 ? 'boxed' : 'highlight',
      tone: source.length <= 22 ? 'rose' : 'amber',
    }
  }

  const leadText = source.slice(0, accentIndex).trim()
  const trailingText = source.slice(accentIndex + accentText.length).trim()

  return {
    leadText,
    accentText,
    trailingText,
    treatment: leadText.length < 14 ? 'boxed' : 'highlight',
    tone: leadText.length < 14 ? 'rose' : 'lime',
  }
}

function parseNumericValue(text: string) {
  const match = text.match(/(\$)?(\d[\d,]*)(%?)/)
  if (!match) return null

  const prefix = match[1] ?? ''
  const suffix = match[3] ?? ''
  const numericValue = Number(match[2].replace(/,/g, ''))
  if (!Number.isFinite(numericValue)) return null

  const label = prefix === '$' ? 'Collected revenue' : suffix === '%' ? 'Retention lift' : 'Live count'
  return {
    raw: match[0],
    value: numericValue,
    prefix,
    suffix,
    label,
    format: prefix === '$' ? ('currency' as const) : suffix === '%' ? ('percent' as const) : ('number' as const),
    displayValue: `${prefix}${numericValue.toLocaleString()}${suffix}`,
  }
}

function normalizeText(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9$%\s]+/g, ' ').replace(/\s+/g, ' ').trim()
}

function cleanSentence(value: string) {
  return value.replace(/\s+/g, ' ').trim()
}

function inferRoleFromSlotName(slotName: string) {
  if (slotName.includes('primary')) return 'primary'
  if (slotName.includes('secondary')) return 'secondary'
  if (slotName.includes('tertiary')) return 'tertiary'
  return 'stray'
}

function cueId(projectId: string, kind: string, atMs: number) {
  return `${projectId}_${kind}_${atMs}`
}
