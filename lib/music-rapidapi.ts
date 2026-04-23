import { normalizeMusicPreference } from '@/lib/music-catalog'
import type { MusicMood, MusicPreference, MusicRecommendation, MusicVideoContext } from '@/lib/types'

const RAPIDAPI_CACHE_TTL_MS = 2 * 60 * 1000

type MusicRecommendationBundle = {
  recommendations: MusicRecommendation[]
  preference: MusicPreference
  fallback: boolean
  provider: 'rapidapi'
}

type RapidApiConfig = {
  url: string
  host: string
  key: string
  queryParam: string
  limitParam: string
}

type RapidApiCandidate = Record<string, unknown>

type CacheEntry = {
  expiresAt: number
  payload: MusicRecommendationBundle
}

const recommendationCache = new Map<string, CacheEntry>()

export function hasRapidApiMusicConfig() {
  return Boolean(resolveRapidApiConfig())
}

export async function fetchRapidApiMusicRecommendations({
  query,
  projectTitle,
  initialPrompt,
  musicPreference,
  videoContext,
  limit = 4,
}: {
  query: string
  projectTitle?: string
  initialPrompt?: string
  musicPreference?: Partial<MusicPreference> | null
  videoContext?: MusicVideoContext | null
  limit?: number
}): Promise<MusicRecommendationBundle | null> {
  const config = resolveRapidApiConfig()
  if (!config) return null

  const normalizedQuery = normalizeInline(query)
  const contextText = [normalizedQuery, projectTitle, initialPrompt, buildVideoContextText(videoContext)].filter(Boolean).join(' ')
  const preference = normalizeMusicPreference(musicPreference, contextText, videoContext)
  const cacheKey = JSON.stringify({
    provider: 'rapidapi',
    url: config.url,
    query: normalizedQuery,
    projectTitle: normalizeInline(projectTitle ?? ''),
    initialPrompt: normalizeInline(initialPrompt ?? ''),
    videoContext: {
      pace: videoContext?.pace,
      summary: normalizeInline(videoContext?.summary ?? ''),
      signals: (videoContext?.signals ?? []).map((signal) => normalizeInline(signal)).filter(Boolean),
    },
    preference: {
      mood: preference.mood,
      energy: preference.energy,
      sourcePlatform: preference.sourcePlatform,
    },
    limit,
  })

  const cached = recommendationCache.get(cacheKey)
  if (cached && cached.expiresAt > Date.now()) {
    return cached.payload
  }

  const searchPhrase = buildSearchPhrase({
    query: normalizedQuery,
    projectTitle: projectTitle ?? '',
    initialPrompt: initialPrompt ?? '',
    preference,
    videoContext,
  })

  const response = await fetchRapidApiPayload(config, searchPhrase, limit)
  const contextTokens = extractKeywords(contextText)
  const candidates = collectRapidApiCandidates(response)

  const ranked = candidates
    .map((candidate, index) => normalizeRapidCandidate(candidate, preference, contextTokens, index))
    .filter((candidate): candidate is RapidMusicRecommendation => candidate !== null)
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, Math.max(1, limit))

  const payload: MusicRecommendationBundle = {
    recommendations: ranked.map((entry) => entry.recommendation),
    preference,
    fallback: ranked.length === 0,
    provider: 'rapidapi',
  }

  recommendationCache.set(cacheKey, {
    expiresAt: Date.now() + RAPIDAPI_CACHE_TTL_MS,
    payload,
  })

  return payload
}

async function fetchRapidApiPayload(config: RapidApiConfig, query: string, limit: number) {
  const url = new URL(config.url)
  url.searchParams.set(config.queryParam, query)
  url.searchParams.set(config.limitParam, String(limit))

  const response = await fetch(url.toString(), {
    cache: 'no-store',
    headers: {
      'X-RapidAPI-Key': config.key,
      'X-RapidAPI-Host': config.host,
      Accept: 'application/json',
    },
  })

  if (!response.ok) {
    throw new Error(`RapidAPI music lookup failed with ${response.status} ${response.statusText}.`)
  }

  return response.json().catch(() => null)
}

function resolveRapidApiConfig(): RapidApiConfig | null {
  const url = normalizeInline(process.env.RAPIDAPI_MUSIC_URL ?? process.env.RAPIDAPI_URL ?? '')
  const key = normalizeInline(process.env.RAPIDAPI_KEY ?? '')
  const host = normalizeInline(process.env.RAPIDAPI_HOST ?? process.env.RAPIDAPI_MUSIC_HOST ?? '')
  if (!url || !key) return null

  let resolvedHost = host
  if (!resolvedHost) {
    try {
      resolvedHost = new URL(url).hostname
    } catch {
      return null
    }
  }

  return {
    url,
    host: resolvedHost,
    key,
    queryParam: normalizeInline(process.env.RAPIDAPI_MUSIC_QUERY_PARAM ?? 'query') || 'query',
    limitParam: normalizeInline(process.env.RAPIDAPI_MUSIC_LIMIT_PARAM ?? 'limit') || 'limit',
  }
}

function buildSearchPhrase({
  query,
  projectTitle,
  initialPrompt,
  preference,
  videoContext,
}: {
  query: string
  projectTitle: string
  initialPrompt: string
  preference: MusicPreference
  videoContext?: MusicVideoContext | null
}) {
  const moodPhrase = buildMoodPhrase(preference)
  const energyPhrase =
    preference.energy === 'high' ? 'driving' : preference.energy === 'low' ? 'soft' : 'balanced'
  const context = [query, projectTitle, initialPrompt, buildVideoContextText(videoContext)].filter(Boolean).join(' ')
  const tokens = extractKeywords(context)

  return uniqueStrings([
    query,
    [moodPhrase, tokens.slice(0, 4).join(' ')].filter(Boolean).join(' '),
    [moodPhrase, energyPhrase, tokens.slice(0, 3).join(' ')].filter(Boolean).join(' '),
    buildVideoSearchPhrase(videoContext, preference),
  ])
    .filter(Boolean)
    .slice(0, 1)
    .join(' ')
}

function collectRapidApiCandidates(payload: unknown) {
  const candidates: RapidApiCandidate[] = []
  const seen = new Set<object>()

  const walk = (value: unknown, depth = 0) => {
    if (depth > 5 || value === null || value === undefined) return

    if (Array.isArray(value)) {
      for (const item of value) {
        walk(item, depth + 1)
      }
      return
    }

    if (typeof value !== 'object') return
    if (seen.has(value as object)) return
    seen.add(value as object)

    const record = value as RapidApiCandidate
    if (looksLikeTrack(record)) {
      candidates.push(record)
    }

    for (const nested of Object.values(record)) {
      walk(nested, depth + 1)
    }
  }

  walk(payload)
  return uniqueCandidates(candidates)
}

function looksLikeTrack(record: RapidApiCandidate) {
  const title = pickText(record, ['title', 'name', 'trackName', 'songTitle', 'track_title'])
  const artist = pickText(record, ['artist', 'artistName', 'creator', 'producer', 'author', 'channelTitle'])
  const coverArtUrl = pickUrl(record, ['thumbnail', 'thumbnailUrl', 'artworkUrl100', 'artwork', 'image', 'cover', 'coverArt', 'thumbnail_url', 'imageUrl'])
  return Boolean(title && artist && coverArtUrl)
}

function normalizeRapidCandidate(
  record: RapidApiCandidate,
  preference: MusicPreference,
  contextTokens: string[],
  index: number,
): RapidMusicRecommendation | null {
  const title = pickText(record, ['title', 'name', 'trackName', 'songTitle', 'track_title'])
  const artist = pickText(record, ['artist', 'artistName', 'creator', 'producer', 'author', 'channelTitle'])
  const producer =
    pickText(record, ['producer', 'collectionName', 'album', 'albumName', 'owner']) ?? artist
  const genre = pickText(record, ['genre', 'primaryGenreName', 'category', 'style']) ?? 'Music'
  const coverArtUrl = pickUrl(record, ['thumbnail', 'thumbnailUrl', 'artworkUrl100', 'artwork', 'image', 'cover', 'coverArt', 'thumbnail_url', 'imageUrl'])
  const sourceUrl = pickUrl(record, ['trackViewUrl', 'trackUrl', 'sourceUrl', 'webUrl', 'pageUrl', 'url'])
  const subtitle = pickText(record, ['subtitle', 'subtitleText', 'caption', 'tagline', 'collectionName', 'albumName'])
  const description = pickText(record, ['description', 'summary', 'excerpt', 'text'])
  const releaseYear = pickYear(record)
  const durationSec = pickDuration(record)

  if (!title || !artist || !coverArtUrl) {
    return null
  }

  const trackId = String(
    pickNumber(record, ['trackId', 'id', 'videoId']) ?? hashString(`${title}-${artist}-${producer}`),
  )
  const mood = deriveMood([genre, subtitle, description].filter(Boolean).join(' '), preference.mood)
  const energy = deriveEnergy([genre, subtitle, description].filter(Boolean).join(' '), preference.energy)
  const bpm = estimateTempo(trackId, genre, energy, preference.energy)
  const matchedTokens = findMatchedTokens([title, artist, producer, genre, subtitle, description].join(' '), contextTokens)
  const vibeTags = buildVibeTags({
    mood,
    energy,
    genre,
    matchedTokens,
    sourceHint: sourceUrl ? 'stream' : 'catalog',
  })

  const recommendation: MusicRecommendation = {
    id: `rapidapi-${trackId}`,
    title,
    subtitle: subtitle ?? undefined,
    description: description ?? undefined,
    album: pickText(record, ['album', 'albumName', 'collectionName']) ?? undefined,
    artist,
    producer,
    genre,
    bpm,
    vibeTags,
    coverArtUrl: normalizeArtworkUrl(coverArtUrl),
    coverArtPosition: '50% 50%',
    previewUrl: buildGeneratedPreviewUrl({
      seed: `${trackId}-${title}`,
      title,
      artist,
      bpm,
      mood,
    }),
    reason: buildReason({
      title,
      artist,
      producer,
      genre,
      bpm,
      mood,
      energy,
      matchedTokens,
      contextTokens,
      subtitle,
      sourceHint: sourceUrl ? 'stream' : 'catalog',
    }),
    mood,
    energy,
    sourcePlatform: 'online',
    durationSec,
    releaseYear: releaseYear ?? undefined,
    sourceUrl: sourceUrl ?? undefined,
    license: 'online-preview',
    matchedTerms: matchedTokens,
    matchScore: scoreCandidate({
      title,
      artist,
      producer,
      genre,
      subtitle,
      description,
      matchedTokens,
      contextTokens,
      preference,
      mood,
      energy,
    }),
    exactMatch: matchesExactCandidate({ title, artist, producer, subtitle, query: contextTokens.join(' ') }),
  }

  return {
    recommendation,
    score: recommendation.matchScore ?? 0,
    index,
  }
}

function scoreCandidate({
  title,
  artist,
  producer,
  genre,
  subtitle,
  description,
  matchedTokens,
  contextTokens,
  preference,
  mood,
  energy,
}: {
  title: string
  artist: string
  producer: string
  genre: string
  subtitle?: string | null
  description?: string | null
  matchedTokens: string[]
  contextTokens: string[]
  preference: MusicPreference
  mood: MusicMood
  energy: MusicPreference['energy']
}) {
  const haystack = normalizeInline([title, artist, producer, genre, subtitle, description, matchedTokens.join(' ')].filter(Boolean).join(' '))
  let score = 0
  const tokens = contextTokens.length > 0 ? contextTokens : extractKeywords(`${title} ${artist}`)
  const strongSelectionCue = hasAny(haystack, ['strong', 'knockout', 'anthem', 'banger', 'impact', 'punchy', 'power', 'driving', 'hero', 'headline', 'statement']) ||
    hasAny(tokens.join(' '), ['strong', 'knockout', 'anthem', 'banger', 'impact', 'punchy'])
  const wantsAmbient = preference.mood === 'minimal' || hasAny(haystack, ['ambient', 'soft', 'subtle', 'under dialogue', 'documentary', 'reflective'])

  for (const token of tokens) {
    if (token.length < 3) continue
    if (haystack.includes(token)) {
      score += token.length > 5 ? 4 : 2
    }
  }

  if (mood === preference.mood) score += 4
  if (energy === preference.energy) score += 3
  if (preference.energy === 'low' && energy === 'low') score += 1.5
  if (preference.energy === 'high' && energy === 'high') score += 1.5
  if (preference.mood === 'cinematic' && hasAny(haystack, ['cinematic', 'score', 'trailer', 'luxury'])) score += 2
  if (preference.mood === 'uplifting' && hasAny(haystack, ['uplift', 'anthem', 'bright', 'pop'])) score += 2
  if (preference.mood === 'dark' && hasAny(haystack, ['dark', 'moody', 'tension', 'night'])) score += 2
  if (preference.mood === 'minimal' && hasAny(haystack, ['minimal', 'ambient', 'soft', 'under dialogue'])) score += 2
  if (preference.mood === 'playful' && hasAny(haystack, ['playful', 'light', 'friendly', 'warm'])) score += 2
  if (!wantsAmbient && energy === 'low') score -= 2.5
  if (!wantsAmbient && mood === 'minimal') score -= 1.75
  if (strongSelectionCue && energy === 'high') score += 2.5
  if (strongSelectionCue && hasAny(haystack, ['driving', 'impact', 'launch', 'pulse', 'snappy', 'anthem', 'hero'])) score += 2

  return score
}

function buildReason({
  title,
  artist,
  producer,
  genre,
  bpm,
  mood,
  energy,
  matchedTokens,
  contextTokens,
  subtitle,
  sourceHint,
}: {
  title: string
  artist: string
  producer: string
  genre: string
  bpm: number
  mood: MusicMood
  energy: MusicPreference['energy']
  matchedTokens: string[]
  contextTokens: string[]
  subtitle?: string | null
  sourceHint: 'catalog' | 'stream'
}) {
  const cueList = uniqueStrings([...matchedTokens, ...contextTokens]).slice(0, 2)
  const cueLine = cueList.length > 0 ? `It lines up with ${cueList.join(' and ')} cues.` : ''
  const energyLine =
    energy === 'low'
      ? 'It stays tucked under the voice.'
      : energy === 'high'
        ? 'It adds a driving lift without getting muddy.'
        : 'It keeps the edit moving without crowding the frame.'
  const titleLine = `${title} by ${artist} feels like a ${mood} ${genre.toLowerCase()} pick from ${producer}.`
  const subtitleLine = subtitle ? ` ${subtitle}.` : ''

  return `${titleLine}${subtitleLine} At ${bpm} BPM, it sits well as a ${sourceHint} cue. ${energyLine} ${cueLine}`.trim()
}

function buildVibeTags({
  mood,
  energy,
  genre,
  matchedTokens,
  sourceHint,
}: {
  mood: MusicMood
  energy: MusicPreference['energy']
  genre: string
  matchedTokens: string[]
  sourceHint: 'catalog' | 'stream'
}) {
  const tags = [
    mood,
    energy === 'low' ? 'under dialogue' : energy === 'high' ? 'driving' : 'steady',
    genre.toLowerCase(),
    sourceHint,
    ...matchedTokens,
  ]

  return uniqueStrings(tags).slice(0, 4)
}

function buildGeneratedPreviewUrl({
  seed,
  title,
  artist,
  bpm,
  mood,
}: {
  seed: string
  title: string
  artist: string
  bpm: number
  mood: MusicMood
}) {
  const params = new URLSearchParams({
    seed,
    title,
    artist,
    bpm: String(bpm),
    mood,
  })

  return `/api/music/preview?${params.toString()}`
}

function deriveMood(text: string, preferenceMood: MusicMood): MusicMood {
  const normalized = normalizeInline(text)
  if (hasAny(normalized, ['ambient', 'minimal', 'lofi', 'soft', 'acoustic'])) return 'minimal'
  if (hasAny(normalized, ['trailer', 'score', 'cinematic', 'soundtrack'])) return 'cinematic'
  if (hasAny(normalized, ['dance', 'anthem', 'pop', 'house', 'club', 'banger', 'knockout', 'impact', 'strong', 'punchy'])) return 'uplifting'
  if (hasAny(normalized, ['dark', 'drone', 'industrial', 'tension', 'moody'])) return 'dark'
  if (hasAny(normalized, ['playful', 'indie', 'folk', 'light', 'friendly'])) return 'playful'
  return preferenceMood
}

function deriveEnergy(text: string, preferenceEnergy: MusicPreference['energy']): MusicPreference['energy'] {
  const normalized = normalizeInline(text)
  if (hasAny(normalized, ['ambient', 'minimal', 'soft', 'acoustic'])) return 'low'
  if (hasAny(normalized, ['dance', 'anthem', 'pop', 'house', 'club', 'rock', 'trailer', 'electronic', 'banger', 'knockout', 'impact', 'strong', 'punchy'])) return 'high'
  return preferenceEnergy
}

function estimateTempo(trackId: string, genre: string, energy: MusicPreference['energy'], preferenceEnergy: MusicPreference['energy']) {
  const text = normalizeInline(genre)
  let base = preferenceEnergy === 'low' ? 88 : preferenceEnergy === 'high' ? 124 : 108

  if (hasAny(text, ['ambient', 'minimal', 'lofi', 'soft', 'acoustic'])) {
    base = 84
  } else if (hasAny(text, ['hip hop', 'rap', 'trap'])) {
    base = 94
  } else if (hasAny(text, ['pop', 'dance', 'electronic', 'edm', 'house', 'club'])) {
    base = 124
  } else if (hasAny(text, ['rock', 'indie', 'alternative'])) {
    base = 116
  } else if (hasAny(text, ['cinematic', 'score', 'trailer', 'soundtrack'])) {
    base = 108
  }

  const variance = (hashString(trackId) % 15) - 7
  const energyBoost = energy === 'high' ? 4 : energy === 'low' ? -4 : 0

  return clamp(base + variance + energyBoost, 72, 156)
}

function pickText(record: RapidApiCandidate, keys: string[]): string {
  for (const key of keys) {
    const value = record[key]
    if (typeof value === 'string') {
      const normalized = normalizeInline(value)
      if (normalized) return normalized
    }
    if (value && typeof value === 'object') {
      const nested: string = pickText(value as RapidApiCandidate, ['text', 'title', 'name', 'label', 'value'])
      if (nested) return nested
    }
  }
  return ''
}

function pickUrl(record: RapidApiCandidate, keys: string[]): string {
  for (const key of keys) {
    const value = record[key]
    if (typeof value === 'string' && isLikelyUrl(value)) {
      return normalizeInline(value).replace(/^http:\/\//i, 'https://')
    }
    if (value && typeof value === 'object') {
      const nested: string = pickUrl(value as RapidApiCandidate, ['url', 'src', 'href', 'image', 'thumbnail'])
      if (nested) return nested
    }
  }
  return ''
}

function pickNumber(record: RapidApiCandidate, keys: string[]) {
  for (const key of keys) {
    const value = record[key]
    if (typeof value === 'number' && Number.isFinite(value)) return value
    if (typeof value === 'string') {
      const parsed = Number(value)
      if (Number.isFinite(parsed)) return parsed
    }
  }
  return null
}

function pickYear(record: RapidApiCandidate) {
  const releaseDate = pickText(record, ['releaseDate', 'publishedAt', 'publishDate'])
  if (releaseDate) {
    const parsed = new Date(releaseDate)
    if (!Number.isNaN(parsed.getTime())) return parsed.getFullYear()
  }

  const numericYear = pickNumber(record, ['year', 'releaseYear'])
  return numericYear ? Math.trunc(numericYear) : null
}

function pickDuration(record: RapidApiCandidate) {
  const millis = pickNumber(record, ['durationMs', 'trackTimeMillis', 'durationMillis'])
  if (millis) {
    return Math.max(15, Math.round(millis / 1000))
  }

  const seconds = pickNumber(record, ['duration', 'durationSec', 'length'])
  if (seconds) return Math.max(15, Math.round(seconds))

  return 30
}

function uniqueCandidates(values: RapidApiCandidate[]) {
  const seen = new Set<string>()
  const results: RapidApiCandidate[] = []

  for (const value of values) {
    const title = pickText(value, ['title', 'name', 'trackName', 'songTitle'])
    const artist = pickText(value, ['artist', 'artistName', 'creator', 'producer', 'author', 'channelTitle'])
    const key = normalizeInline(`${title}-${artist}`)
    if (!title || !artist || seen.has(key)) continue
    seen.add(key)
    results.push(value)
  }

  return results
}

function isLikelyUrl(value: string) {
  try {
    const parsed = new URL(value)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
  } catch {
    return false
  }
}

function matchesExactCandidate({
  title,
  artist,
  producer,
  subtitle,
  query,
}: {
  title: string
  artist: string
  producer: string
  subtitle?: string | null
  query: string
}) {
  const normalizedQuery = normalizeInline(query)
  if (!normalizedQuery) return false

  const normalizedTitle = normalizeInline(title)
  const normalizedArtist = normalizeInline(artist)
  const normalizedProducer = normalizeInline(producer)
  const normalizedSubtitle = normalizeInline(subtitle ?? '')

  return (
    normalizedQuery === normalizedTitle ||
    normalizedQuery === normalizedArtist ||
    normalizedQuery === normalizedProducer ||
    normalizedQuery === normalizedSubtitle ||
    normalizedQuery === `${normalizedTitle} ${normalizedArtist}` ||
    normalizedQuery === `${normalizedArtist} ${normalizedTitle}`
  )
}

function extractKeywords(value: string) {
  return normalizeInline(value)
    .split(/[^a-z0-9]+/g)
    .map((token) => token.trim())
    .filter((token) => token.length > 2 && !STOPWORDS.has(token))
}

function findMatchedTokens(haystack: string, tokens: string[]) {
  const normalized = normalizeInline(haystack)
  return tokens.filter((token) => normalized.includes(token)).slice(0, 3)
}

function uniqueStrings(values: string[]) {
  return values
    .map((value) => normalizeInline(value))
    .filter(Boolean)
    .filter((value, index, all) => all.indexOf(value) === index)
}

function normalizeInline(value: string) {
  return value.toLowerCase().replace(/\s+/g, ' ').trim()
}

function buildVideoSearchPhrase(videoContext?: MusicVideoContext | null, preference?: MusicPreference) {
  if (!videoContext) return ''

  const pacePhrase =
    videoContext.pace === 'fast'
      ? 'upbeat driving funk reel tiktok coach'
      : videoContext.pace === 'slow'
        ? 'ambient reflective cinematic bed'
        : 'balanced editorial soundtrack'
  const moodPhrase =
    preference?.mood === 'uplifting'
      ? 'bright motivational'
      : preference?.mood === 'minimal'
        ? 'soft atmospheric'
        : preference?.mood === 'dark'
          ? 'moody tension'
          : 'cinematic polished'

  return uniqueStrings([
    pacePhrase,
    moodPhrase,
    videoContext.summary,
    ...(videoContext.signals ?? []),
    videoContext.intent?.summary ?? '',
    ...(videoContext.intent?.searchTerms ?? []),
    ...(videoContext.intent?.sentiment.themeTags ?? []),
    ...(videoContext.intent?.trends?.flatMap((trend) => [trend.summary, ...trend.tags]) ?? []),
  ]).join(' ')
}

function buildVideoContextText(videoContext?: MusicVideoContext | null) {
  if (!videoContext) return ''
  return uniqueStrings([
    videoContext.summary,
    videoContext.pace,
    ...(videoContext.signals ?? []),
    videoContext.intent?.summary ?? '',
    ...(videoContext.intent?.searchTerms ?? []),
    videoContext.intent?.sentiment.summary ?? '',
    ...(videoContext.intent?.sentiment.themeTags ?? []),
    ...(videoContext.intent?.trends?.flatMap((trend) => [trend.summary, ...trend.tags]) ?? []),
  ]).join(' ')
}

function hasAny(text: string, needles: string[]) {
  return needles.some((needle) => text.includes(needle))
}

function buildMoodPhrase(preference: MusicPreference) {
  switch (preference.mood) {
    case 'uplifting':
      return 'uplifting pop'
    case 'dark':
      return 'dark electronic'
    case 'minimal':
      return 'minimal ambient'
    case 'playful':
      return 'playful indie pop'
    case 'cinematic':
    default:
      return 'cinematic instrumental'
  }
}

function normalizeArtworkUrl(value: string) {
  const trimmed = normalizeInline(value)
  if (!trimmed) return ''
  const httpsUrl = trimmed.replace(/^http:\/\//i, 'https://')
  return httpsUrl.replace(/\/\d+x\d+bb\./i, '/512x512bb.')
}

function hashString(value: string) {
  let hash = 0
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(index)
    hash |= 0
  }
  return Math.abs(hash)
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value))
}

const STOPWORDS = new Set([
  'a',
  'an',
  'and',
  'are',
  'be',
  'by',
  'for',
  'from',
  'get',
  'go',
  'in',
  'into',
  'is',
  'it',
  'make',
  'music',
  'of',
  'on',
  'or',
  'please',
  'song',
  'songs',
  'sound',
  'soundtrack',
  'the',
  'this',
  'to',
  'track',
  'tracks',
  'use',
  'with',
  'your',
])

type RapidMusicRecommendation = {
  recommendation: MusicRecommendation
  score: number
  index: number
}
