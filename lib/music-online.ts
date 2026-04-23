import { normalizeMusicPreference } from '@/lib/music-catalog'
import { fetchRapidApiMusicRecommendations, hasRapidApiMusicConfig } from '@/lib/music-rapidapi'
import type { MusicMood, MusicPreference, MusicRecommendation, MusicVideoContext } from '@/lib/types'

const ITUNES_SEARCH_URL = 'https://itunes.apple.com/search'
const RECOMMENDATION_CACHE_TTL_MS = 2 * 60 * 1000

type MusicRecommendationBundle = {
  recommendations: MusicRecommendation[]
  preference: MusicPreference
  fallback: boolean
  provider: 'rapidapi' | 'itunes'
}

type ItunesSearchResponse = {
  resultCount?: number
  results?: ItunesTrackResult[]
}

type ItunesTrackResult = {
  wrapperType?: string
  kind?: string
  trackId?: number
  artistName?: string
  collectionName?: string
  trackName?: string
  primaryGenreName?: string
  artworkUrl100?: string
  previewUrl?: string
  trackTimeMillis?: number
  trackExplicitness?: 'notExplicit' | 'explicit' | 'cleaned'
  trackViewUrl?: string
  collectionViewUrl?: string
  artistViewUrl?: string
}

type CacheEntry = {
  expiresAt: number
  payload: MusicRecommendationBundle
}

const recommendationCache = new Map<string, CacheEntry>()

export async function fetchOnlineMusicRecommendations({
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
}): Promise<MusicRecommendationBundle> {
  const normalizedQuery = normalizeInline(query)
  const contextText = [normalizedQuery, projectTitle, initialPrompt, buildVideoContextText(videoContext)].filter(Boolean).join(' ')
  const preference = normalizeMusicPreference(musicPreference, contextText, videoContext)
  const cacheKey = JSON.stringify({
    provider: hasRapidApiMusicConfig() ? 'rapidapi' : 'itunes',
    query: normalizedQuery,
    projectTitle: normalizeInline(projectTitle ?? ''),
    initialPrompt: normalizeInline(initialPrompt ?? ''),
    videoContext: {
      pace: videoContext?.pace,
      summary: normalizeInline(buildVideoContextText(videoContext)),
      signals: (videoContext?.signals ?? []).map((signal) => normalizeInline(signal)).filter(Boolean),
      intent: videoContext?.intent
        ? {
            summary: normalizeInline(videoContext.intent.summary ?? ''),
            searchTerms: (videoContext.intent.searchTerms ?? []).map((term) => normalizeInline(term)).filter(Boolean),
          }
        : undefined,
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

  if (hasRapidApiMusicConfig()) {
    try {
      const rapidApiResult = await fetchRapidApiMusicRecommendations({
        query: normalizedQuery,
        projectTitle,
        initialPrompt,
        musicPreference,
        videoContext,
        limit,
      })

      if (rapidApiResult?.recommendations.length) {
        recommendationCache.set(cacheKey, {
          expiresAt: Date.now() + RECOMMENDATION_CACHE_TTL_MS,
          payload: rapidApiResult,
        })

        return rapidApiResult
      }
    } catch {
      // Fall through to the backup provider.
    }
  }

  const searchTerms = buildSearchTerms({
    query: normalizedQuery,
    projectTitle: projectTitle ?? '',
    initialPrompt: initialPrompt ?? '',
    preference,
    videoContext,
  })

  const settled = await Promise.allSettled(searchTerms.map((term) => searchItunes(term)))
  const ranked = new Map<string, RankedRecommendation>()
  const contextTokens = extractKeywords(contextText)

  settled.forEach((result, searchIndex) => {
    if (result.status !== 'fulfilled') return

    const tracks = result.value.results ?? []
    tracks.forEach((track, trackIndex) => {
      const candidate = normalizeTrack(track, preference, contextTokens)
      if (!candidate) return

      const cacheKey = candidate.id
      const score = scoreTrack(candidate, contextTokens, searchIndex, trackIndex, preference)
      const current = ranked.get(cacheKey)

      if (!current || score > current.score) {
        ranked.set(cacheKey, {
          recommendation: candidate,
          score,
          searchIndex,
          trackIndex,
        })
      }
    })
  })

  const recommendations = [...ranked.values()]
    .sort((a, b) => b.score - a.score || a.searchIndex - b.searchIndex || a.trackIndex - b.trackIndex)
    .slice(0, limit)
    .map((entry) => entry.recommendation)

  const payload: MusicRecommendationBundle = {
    recommendations,
    preference,
    fallback: recommendations.length === 0,
    provider: 'itunes',
  }

  recommendationCache.set(cacheKey, {
    expiresAt: Date.now() + RECOMMENDATION_CACHE_TTL_MS,
    payload,
  })

  return payload
}

function buildSearchTerms({
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
  const queryTokens = extractKeywords([query, projectTitle, initialPrompt, buildVideoContextText(videoContext)].filter(Boolean).join(' '))
  const promptPhrase = queryTokens.slice(0, 4).join(' ')
  const moodPhrase = buildMoodPhrase(preference)
  const energyPhrase =
    preference.energy === 'high' ? 'driving' : preference.energy === 'low' ? 'soft' : 'balanced'

  return uniqueStrings([
    query,
    [moodPhrase, promptPhrase].filter(Boolean).join(' '),
    [moodPhrase, energyPhrase, queryTokens.slice(0, 3).join(' ')].filter(Boolean).join(' '),
    [projectTitle, moodPhrase, 'soundtrack'].filter(Boolean).join(' '),
    buildVideoSearchPhrase(videoContext, preference),
  ]).filter(Boolean)
}

async function searchItunes(term: string): Promise<ItunesSearchResponse> {
  const params = new URLSearchParams({
    term,
    country: 'us',
    media: 'music',
    entity: 'song',
    limit: '20',
    lang: 'en_us',
  })

  const response = await fetch(`${ITUNES_SEARCH_URL}?${params.toString()}`, {
    cache: 'no-store',
    headers: {
      Accept: 'application/json',
    },
  })

  if (!response.ok) {
    throw new Error(`iTunes search failed with ${response.status} ${response.statusText}.`)
  }

  return (await response.json()) as ItunesSearchResponse
}

function normalizeTrack(
  track: ItunesTrackResult,
  preference: MusicPreference,
  contextTokens: string[],
): MusicRecommendation | null {
  const title = normalizeInline(track.trackName ?? track.collectionName ?? '')
  const artist = normalizeInline(track.artistName ?? '')
  const producer = normalizeInline(track.collectionName ?? track.artistName ?? '')
  const genre = normalizeInline(track.primaryGenreName ?? 'Music')
  const previewUrl = normalizePreviewUrl(track.previewUrl ?? '')
  const coverArtUrl = normalizeArtworkUrl(track.artworkUrl100 ?? '')

  if (!title || !artist || !previewUrl || !coverArtUrl) {
    return null
  }

  const trackId = String(track.trackId ?? hashString(`${title}-${artist}-${producer}`))
  const mood = deriveMood(genre, preference.mood)
  const energy = deriveEnergy(genre, preference.energy)
  const bpm = estimateTempo(trackId, genre, energy, preference.energy)
  const matchedTokens = findMatchedTokens([title, artist, producer, genre].join(' '), contextTokens)
  const vibeTags = buildVibeTags({
    mood,
    energy,
    genre,
    matchedTokens,
    explicitness: track.trackExplicitness,
  })

  return {
    id: `itunes-${trackId}`,
    title,
    artist,
    producer,
    genre,
    bpm,
    vibeTags,
    coverArtUrl,
    coverArtPosition: '50% 50%',
    previewUrl: `/api/music/preview?url=${encodeURIComponent(previewUrl)}`,
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
      explicitness: track.trackExplicitness,
    }),
    mood,
    energy,
    sourcePlatform: 'online',
    durationSec: Math.max(15, Math.round((track.trackTimeMillis ?? 0) / 1000) || 30),
    sourceUrl: track.trackViewUrl ?? track.collectionViewUrl ?? track.artistViewUrl ?? undefined,
  }
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
  explicitness,
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
  explicitness?: ItunesTrackResult['trackExplicitness']
}) {
  const cueList = uniqueStrings([...matchedTokens, ...contextTokens]).slice(0, 2)
  const cueLine = cueList.length > 0 ? `It lines up with ${cueList.join(' and ')} cues.` : ''
  const energyLine =
    energy === 'low'
      ? 'It stays tucked under the voice.'
      : energy === 'high'
        ? 'It adds a driving lift without getting muddy.'
        : 'It keeps the edit moving without crowding the frame.'
  const label = explicitness === 'explicit' ? 'live catalog' : 'clean live catalog'
  const titleLine = `${title} by ${artist} feels like a ${mood} ${genre.toLowerCase()} pick from ${producer}.`

  return `${titleLine} At ${bpm} BPM, it sits well as a ${label} cue. ${energyLine} ${cueLine}`.trim()
}

function buildVibeTags({
  mood,
  energy,
  genre,
  matchedTokens,
  explicitness,
}: {
  mood: MusicMood
  energy: MusicPreference['energy']
  genre: string
  matchedTokens: string[]
  explicitness?: ItunesTrackResult['trackExplicitness']
}) {
  const tags = [
    mood,
    energy === 'low' ? 'under dialogue' : energy === 'high' ? 'driving' : 'steady',
    genre.toLowerCase(),
    explicitness === 'explicit' ? 'raw' : 'clean',
    ...matchedTokens,
  ]

  return uniqueStrings(tags).slice(0, 4)
}

function scoreTrack(
  recommendation: MusicRecommendation,
  contextTokens: string[],
  searchIndex: number,
  trackIndex: number,
  preference: MusicPreference,
) {
  const haystack = normalizeInline(
    [recommendation.title, recommendation.artist, recommendation.producer, recommendation.genre, recommendation.vibeTags.join(' ')].join(' '),
  )

  let score = 0
  const tokens = contextTokens.length > 0 ? contextTokens : extractKeywords(`${recommendation.title} ${recommendation.genre}`)
  const strongSelectionCue = hasAny(haystack, ['strong', 'knockout', 'anthem', 'banger', 'impact', 'punchy', 'power', 'driving', 'hero', 'headline', 'statement']) ||
    hasAny(tokens.join(' '), ['strong', 'knockout', 'anthem', 'banger', 'impact', 'punchy'])
  const wantsAmbient = preference.mood === 'minimal' || hasAny(haystack, ['ambient', 'soft', 'subtle', 'under dialogue', 'documentary', 'reflective'])

  for (const token of tokens) {
    if (token.length < 3) continue
    if (haystack.includes(token)) {
      score += token.length > 5 ? 4 : 2
    }
  }

  if (recommendation.mood === preference.mood) score += 4
  if (recommendation.energy === preference.energy) score += 3

  if (preference.energy === 'low' && recommendation.energy === 'low') score += 1.5
  if (preference.energy === 'high' && recommendation.energy === 'high') score += 1.5
  if (preference.mood === 'cinematic' && hasAny(haystack, ['cinematic', 'score', 'trailer', 'luxury'])) score += 2
  if (preference.mood === 'uplifting' && hasAny(haystack, ['uplift', 'anthem', 'bright', 'pop'])) score += 2
  if (preference.mood === 'dark' && hasAny(haystack, ['dark', 'moody', 'tension', 'night'])) score += 2
  if (preference.mood === 'minimal' && hasAny(haystack, ['minimal', 'ambient', 'soft', 'under dialogue'])) score += 2
  if (preference.mood === 'playful' && hasAny(haystack, ['playful', 'light', 'friendly', 'warm'])) score += 2
  if (!wantsAmbient && recommendation.energy === 'low') score -= 2.5
  if (!wantsAmbient && recommendation.mood === 'minimal') score -= 1.75
  if (strongSelectionCue && recommendation.energy === 'high') score += 2.5
  if (strongSelectionCue && hasAny(haystack, ['driving', 'impact', 'launch', 'pulse', 'snappy', 'anthem', 'hero'])) score += 2

  return score - searchIndex * 0.25 - trackIndex * 0.05
}

function deriveMood(genre: string, preferenceMood: MusicMood): MusicMood {
  const text = normalizeInline(genre)
  if (hasAny(text, ['ambient', 'minimal', 'lofi', 'soft', 'acoustic'])) return 'minimal'
  if (hasAny(text, ['trailer', 'score', 'cinematic', 'soundtrack'])) return 'cinematic'
  if (hasAny(text, ['dance', 'anthem', 'pop', 'house', 'club', 'banger', 'knockout', 'impact', 'strong', 'punchy'])) return 'uplifting'
  if (hasAny(text, ['dark', 'drone', 'industrial', 'tension', 'moody'])) return 'dark'
  if (hasAny(text, ['playful', 'indie', 'folk', 'light', 'friendly'])) return 'playful'
  return preferenceMood
}

function deriveEnergy(genre: string, preferenceEnergy: MusicPreference['energy']): MusicPreference['energy'] {
  const text = normalizeInline(genre)
  if (hasAny(text, ['ambient', 'minimal', 'soft', 'acoustic'])) return 'low'
  if (hasAny(text, ['dance', 'anthem', 'pop', 'house', 'club', 'rock', 'trailer', 'electronic', 'banger', 'knockout', 'impact', 'strong', 'punchy'])) return 'high'
  return preferenceEnergy
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

function normalizePreviewUrl(value: string) {
  const trimmed = normalizeInline(value)
  if (!trimmed) return ''
  return trimmed.replace(/^http:\/\//i, 'https://')
}

function normalizeArtworkUrl(value: string) {
  const trimmed = normalizeInline(value)
  if (!trimmed) return ''
  const httpsUrl = trimmed.replace(/^http:\/\//i, 'https://')
  return httpsUrl.replace(/\/\d+x\d+bb\./i, '/512x512bb.')
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

type RankedRecommendation = {
  recommendation: MusicRecommendation
  score: number
  searchIndex: number
  trackIndex: number
}
