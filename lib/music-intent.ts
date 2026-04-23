import type {
  MusicEnergy,
  MusicIntent,
  MusicMood,
  MusicSentimentProfile,
  MusicTrendPlatform,
  MusicTrendProfile,
  MusicVideoContext,
  MusicVideoPace,
  ProcessingJob,
  SourceProfile,
} from '@/lib/types'

type AnalyzeMusicIntentParams = {
  projectTitle: string
  promptText: string
  sourceList: string[]
  sourceProfile: SourceProfile | null | undefined
  job: ProcessingJob | null
  pace: MusicVideoPace
}

const TREND_PLATFORM_WEIGHTS: Record<MusicTrendPlatform, number> = {
  spotify: 1,
  instagram: 0.95,
  tiktok: 1,
  youtube: 0.8,
  generic: 0.75,
}

export function analyzeMusicIntent({
  projectTitle,
  promptText,
  sourceList,
  sourceProfile,
  job,
  pace,
}: AnalyzeMusicIntentParams): MusicIntent {
  const jobText = [
    job?.input.prompt ?? '',
    ...(job?.artifacts.transcript?.map((segment) => segment.text) ?? []),
    ...(job?.artifacts.scenes?.map((scene) => scene.label) ?? []),
    ...(job?.artifacts.highlights?.map((highlight) => highlight.label) ?? []),
    ...(job?.artifacts.brollSuggestions?.map((suggestion) => suggestion.query) ?? []),
  ].join(' ')

  const combinedText = normalizeText([projectTitle, promptText, ...sourceList, jobText].filter(Boolean).join(' '))
  const strongCue = hasAny(combinedText, [
    'strong',
    'knockout',
    'anthem',
    'banger',
    'impact',
    'punchy',
    'power',
    'driving',
    'hero',
    'headline',
    'statement',
    'launch',
    'viral',
    'trending',
  ])
  const reflectiveCue = hasAny(combinedText, [
    'reflective',
    'documentary',
    'calm',
    'quiet',
    'voice',
    'interview',
    'founder story',
    'story',
    'subtle',
    'under dialogue',
  ])
  const socialCue = hasAny(combinedText, ['tiktok', 'instagram', 'reel', 'short-form', 'short form', 'youtube shorts'])

  const normalizedSourceProfile = sourceProfile ?? null
  const mood = deriveMood(combinedText, normalizedSourceProfile, strongCue, reflectiveCue)
  const energy = deriveEnergy(combinedText, pace, strongCue, reflectiveCue)
  const hookStrength = clamp01(
    0.2 +
      (job?.artifacts.highlights?.length ?? 0) * 0.08 +
      (strongCue ? 0.22 : 0) +
      (hasAny(combinedText, ['hook', 'opening', 'reveal', 'cta', 'call to action']) ? 0.16 : 0),
  )
  const ctaPressure = clamp01(
    0.18 +
      (hasAny(combinedText, ['cta', 'call to action', 'sales', 'promo', 'pitch', 'announce']) ? 0.28 : 0) +
      (hasAny(combinedText, ['launch', 'drop', 'go live', 'reveal']) ? 0.12 : 0),
  )

  const themeTags = uniqueStrings([
    ...extractKeywords(combinedText).slice(0, 6),
    mood,
    energy === 'high' ? 'driving' : energy === 'low' ? 'under dialogue' : 'steady',
    pace === 'fast' ? 'fast-paced' : pace === 'slow' ? 'slow-moving' : 'balanced',
    socialCue ? 'short-form' : '',
    hasAny(combinedText, ['vertical', 'reel', 'short-form']) || normalizedSourceProfile?.aspectFamily?.includes('vertical') ? 'vertical' : '',
    strongCue ? 'anthemic' : '',
    reflectiveCue ? 'reflective' : '',
  ]).slice(0, 8)

  const trends = inferTrendProfiles({
    combinedText,
    sourceProfile: normalizedSourceProfile,
    mood,
    energy,
    strongCue,
    reflectiveCue,
    socialCue,
  })

  const searchTerms = uniqueStrings([
    ...themeTags,
    ...trends.flatMap((trend) => trend.tags),
    projectTitle,
    promptText,
    job?.input.prompt ?? '',
    job?.artifacts.highlights?.slice(0, 3).map((item) => item.label).join(' ') ?? '',
  ])
    .map((term) => normalizeText(term))
    .filter(Boolean)
    .slice(0, 10)

  const summary = uniqueStrings([
    mood,
    energy === 'high' ? 'high-energy' : energy === 'low' ? 'low-key' : 'mid-energy',
    pace === 'fast' ? 'fast-paced' : pace === 'slow' ? 'reflective' : 'balanced',
    socialCue ? 'short-form' : '',
    strongCue ? 'anthemic' : '',
    reflectiveCue ? 'voice-first' : '',
  ])
    .filter(Boolean)
    .join(', ')

  const confidence = clamp01(
    0.42 +
      (themeTags.length * 0.04 +
        (job?.artifacts.highlights?.length ? 0.08 : 0) +
        (job?.artifacts.scenes?.length ? 0.06 : 0) +
        (socialCue ? 0.06 : 0) +
        (sourceProfile ? 0.08 : 0)),
  )

  return {
    sentiment: {
      mood,
      energy,
      hookStrength,
      ctaPressure,
      themeTags,
      summary,
      confidence,
    },
    trends,
    searchTerms,
    summary,
    confidence,
  }
}

export function normalizeMusicIntent(intent?: MusicIntent | null): MusicIntent | null {
  if (!intent) return null

  return {
    sentiment: normalizeSentiment(intent.sentiment),
    trends: Array.isArray(intent.trends)
      ? intent.trends
          .map((trend) => ({
            platform: normalizeTrendPlatform(trend.platform),
            weight: clamp01(typeof trend.weight === 'number' && Number.isFinite(trend.weight) ? trend.weight : 0.75),
            tags: Array.isArray(trend.tags)
              ? trend.tags.map((tag) => normalizeText(tag)).filter(Boolean).slice(0, 8)
              : [],
            summary: normalizeText(trend.summary ?? ''),
          }))
          .filter((trend) => trend.summary.length > 0 || trend.tags.length > 0)
      : [],
    searchTerms: Array.isArray(intent.searchTerms)
      ? uniqueStrings(intent.searchTerms.map((term) => normalizeText(term)).filter(Boolean)).slice(0, 10)
      : [],
    summary: normalizeText(intent.summary ?? ''),
    confidence: clamp01(typeof intent.confidence === 'number' && Number.isFinite(intent.confidence) ? intent.confidence : 0.5),
  }
}

function inferTrendProfiles({
  combinedText,
  sourceProfile,
  mood,
  energy,
  strongCue,
  reflectiveCue,
  socialCue,
}: {
  combinedText: string
  sourceProfile: SourceProfile | null
  mood: MusicMood
  energy: MusicEnergy
  strongCue: boolean
  reflectiveCue: boolean
  socialCue: boolean
}): MusicTrendProfile[] {
  const trends: MusicTrendProfile[] = []

  trends.push({
    platform: 'spotify',
    weight: TREND_PLATFORM_WEIGHTS.spotify,
    tags: uniqueStrings([
      mood,
      energy === 'high' ? 'viral' : energy === 'low' ? 'ambient' : 'current',
      strongCue ? 'anthem' : '',
      reflectiveCue ? 'underscore' : '',
    ]).filter(Boolean),
    summary: 'Spotify catalog fit',
  })

  if (socialCue || sourceProfile?.aspectFamily === 'vertical_short' || sourceProfile?.aspectFamily === 'high_res_vertical') {
    trends.push({
      platform: 'tiktok',
      weight: TREND_PLATFORM_WEIGHTS.tiktok,
      tags: uniqueStrings(['viral', 'short-form', 'hook', strongCue ? 'banger' : '', energy === 'high' ? 'driving' : '']).filter(Boolean),
      summary: 'TikTok-style short-form momentum',
    })

    trends.push({
      platform: 'instagram',
      weight: TREND_PLATFORM_WEIGHTS.instagram,
      tags: uniqueStrings(['reel', 'cover-safe', 'launch', strongCue ? 'anthem' : '', energy === 'high' ? 'punchy' : '']).filter(Boolean),
      summary: 'Instagram Reel energy',
    })
  }

  if (reflectiveCue || sourceProfile?.timeProfile === 'long_form_edit' || sourceProfile?.timeProfile === 'extended_processing') {
    trends.push({
      platform: 'youtube',
      weight: TREND_PLATFORM_WEIGHTS.youtube,
      tags: uniqueStrings(['long-form', 'voice-led', 'story', reflectiveCue ? 'documentary' : '', energy === 'low' ? 'subtle' : '']).filter(Boolean),
      summary: 'YouTube long-form storytelling',
    })
  }

  const extraTokens = extractKeywords(combinedText).slice(0, 5)
  if (extraTokens.length > 0) {
    trends.push({
      platform: 'generic',
      weight: TREND_PLATFORM_WEIGHTS.generic,
      tags: extraTokens,
      summary: 'Prompt-derived trend signals',
    })
  }

  return trends
}

function deriveMood(
  text: string,
  sourceProfile: SourceProfile | null,
  strongCue: boolean,
  reflectiveCue: boolean,
): MusicMood {
  if (hasAny(text, ['playful', 'bouncy', 'light', 'warm', 'friendly'])) return 'playful'
  if (reflectiveCue || hasAny(text, ['minimal', 'ambient', 'subtle', 'under dialogue', 'voice over', 'documentary'])) return 'minimal'
  if (hasAny(text, ['dark', 'moody', 'night', 'tension', 'dramatic'])) return 'dark'
  if (strongCue || hasAny(text, ['uplifting', 'coach', 'motivation', 'launch', 'promo', 'positive', 'anthem', 'banger', 'impact', 'strong'])) {
    return 'uplifting'
  }
  if (sourceProfile?.aspectFamily === 'vertical_short' || sourceProfile?.timeProfile === 'quick_edit') return 'uplifting'
  return 'cinematic'
}

function deriveEnergy(
  text: string,
  pace: MusicVideoPace,
  strongCue: boolean,
  reflectiveCue: boolean,
): MusicEnergy {
  if (reflectiveCue || hasAny(text, ['quiet', 'soft', 'ambient', 'breathing', 'subtle', 'under dialogue'])) {
    return 'low'
  }
  if (strongCue || hasAny(text, ['upbeat', 'drive', 'driving', 'fast', 'high energy', 'push', 'lift', 'intense', 'banger', 'impact', 'punchy']) || pace === 'fast') {
    return 'high'
  }
  if (pace === 'slow') return 'low'
  return 'medium'
}

function normalizeSentiment(sentiment: MusicSentimentProfile): MusicSentimentProfile {
  return {
    mood: normalizeMood(sentiment.mood),
    energy: normalizeEnergy(sentiment.energy),
    hookStrength: clamp01(typeof sentiment.hookStrength === 'number' && Number.isFinite(sentiment.hookStrength) ? sentiment.hookStrength : 0),
    ctaPressure: clamp01(typeof sentiment.ctaPressure === 'number' && Number.isFinite(sentiment.ctaPressure) ? sentiment.ctaPressure : 0),
    themeTags: Array.isArray(sentiment.themeTags)
      ? uniqueStrings(sentiment.themeTags.map((tag) => normalizeText(tag)).filter(Boolean)).slice(0, 8)
      : [],
    summary: normalizeText(sentiment.summary ?? ''),
    confidence: clamp01(typeof sentiment.confidence === 'number' && Number.isFinite(sentiment.confidence) ? sentiment.confidence : 0.5),
  }
}

function normalizeTrendPlatform(platform: MusicTrendPlatform): MusicTrendPlatform {
  if (platform === 'spotify' || platform === 'instagram' || platform === 'tiktok' || platform === 'youtube') {
    return platform
  }
  return 'generic'
}

function normalizeMood(value: MusicMood): MusicMood {
  if (value === 'cinematic' || value === 'uplifting' || value === 'dark' || value === 'minimal' || value === 'playful') {
    return value
  }
  return 'cinematic'
}

function normalizeEnergy(value: MusicEnergy): MusicEnergy {
  if (value === 'low' || value === 'medium' || value === 'high') {
    return value
  }
  return 'medium'
}

function uniqueStrings(values: string[]) {
  return [...new Set(values.map((value) => normalizeText(value)).filter(Boolean))]
}

function extractKeywords(value: string) {
  return normalizeText(value)
    .split(/[^a-z0-9]+/i)
    .map((token) => token.trim())
    .filter((token) => token.length >= 3)
}

function hasAny(text: string, needles: string[]) {
  return needles.some((needle) => text.includes(needle))
}

function normalizeText(value: string) {
  return value.toLowerCase().replace(/\s+/g, ' ').trim()
}

function clamp01(value: number) {
  if (!Number.isFinite(value)) return 0
  return Math.max(0, Math.min(1, value))
}
