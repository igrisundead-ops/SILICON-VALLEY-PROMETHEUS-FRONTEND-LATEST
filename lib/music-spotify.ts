import { buildVideoContextText, normalizeMusicPreference } from '@/lib/music-catalog'
import type { MusicMood, MusicPreference, MusicRecommendation, MusicVideoContext } from '@/lib/types'

const SPOTIFY_TOKEN_URL = 'https://accounts.spotify.com/api/token'
const SPOTIFY_SEARCH_URL = 'https://api.spotify.com/v1/search'
const RECOMMENDATION_CACHE_TTL_MS = 2 * 60 * 1000

type MusicRecommendationBundle = {
  recommendations: MusicRecommendation[]
  preference: MusicPreference
  fallback: boolean
  provider: 'spotify'
}

type SpotifyConfig = {
  clientId: string
  clientSecret: string
  market: string
}

type SpotifyTokenResponse = {
  access_token?: string
  expires_in?: number
}

type SpotifySearchResponse = {
  tracks?: {
    items?: SpotifyTrackItem[]
  }
}

type SpotifyTrackItem = {
  id?: string
  name?: string
  popularity?: number
  explicit?: boolean
  preview_url?: string | null
  external_urls?: {
    spotify?: string
  }
  duration_ms?: number
  artists?: Array<{ name?: string }>
  album?: {
    name?: string
    images?: Array<{ url?: string; width?: number; height?: number }>
    release_date?: string
  }
}

type RankedTrack = {
  recommendation: MusicRecommendation
  score: number
  searchIndex: number
  trackIndex: number
}

type CacheEntry = {
  expiresAt: number
  payload: MusicRecommendationBundle
}

type TokenCacheEntry = {
  accessToken: string
  expiresAt: number
}

const recommendationCache = new Map<string, CacheEntry>()
let tokenCache: TokenCacheEntry | null = null

export function hasSpotifyMusicConfig() {
  return Boolean(resolveSpotifyConfig())
}

export async function fetchSpotifyMusicRecommendations({
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
  const config = resolveSpotifyConfig()
  if (!config) return null

  const normalizedQuery = normalizeInline(query)
  const contextText = [normalizedQuery, projectTitle, initialPrompt, buildVideoContextText(videoContext)].filter(Boolean).join(' ')
  const preference = normalizeMusicPreference(musicPreference, contextText, videoContext)
  const cacheKey = JSON.stringify({
    provider: 'spotify',
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

  const searchTerms = buildSearchTerms({
    query: normalizedQuery,
    projectTitle: projectTitle ?? '',
    initialPrompt: initialPrompt ?? '',
    preference,
    videoContext,
  })

  const accessToken = await getSpotifyAccessToken(config)
  const settled = await Promise.allSettled(searchTerms.map((term) => searchSpotifyTracks(accessToken, term, config.market)))
  const contextTokens = extractKeywords(contextText)
  const ranked = new Map<string, RankedTrack>()

  settled.forEach((result, searchIndex) => {
    if (result.status !== 'fulfilled') return

    const items = result.value.tracks?.items ?? []
    items.forEach((track, trackIndex) => {
      const candidate = normalizeSpotifyTrack(track, preference, contextTokens, searchIndex, trackIndex, videoContext)
      if (!candidate) return
      const score = candidate.matchScore ?? 0

      const current = ranked.get(candidate.id)
      if (!current || score > current.score) {
        ranked.set(candidate.id, {
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
    .slice(0, Math.max(1, limit))
    .map((entry) => entry.recommendation)

  const payload: MusicRecommendationBundle = {
    recommendations,
    preference,
    fallback: recommendations.length === 0,
    provider: 'spotify',
  }

  recommendationCache.set(cacheKey, {
    expiresAt: Date.now() + RECOMMENDATION_CACHE_TTL_MS,
    payload,
  })

  return payload
}

async function searchSpotifyTracks(accessToken: string, term: string, market: string) {
  const params = new URLSearchParams({
    q: term,
    type: 'track',
    limit: '10',
    market,
  })

  const response = await fetch(`${SPOTIFY_SEARCH_URL}?${params.toString()}`, {
    cache: 'no-store',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
    },
  })

  if (!response.ok) {
    throw new Error(`Spotify search failed with ${response.status} ${response.statusText}.`)
  }

  return (await response.json()) as SpotifySearchResponse
}

async function getSpotifyAccessToken(config: SpotifyConfig) {
  if (tokenCache && tokenCache.expiresAt > Date.now()) {
    return tokenCache.accessToken
  }

  const credentials = Buffer.from(`${config.clientId}:${config.clientSecret}`).toString('base64')
  const response = await fetch(SPOTIFY_TOKEN_URL, {
    method: 'POST',
    cache: 'no-store',
    headers: {
      Authorization: `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
    }).toString(),
  })

  if (!response.ok) {
    throw new Error(`Spotify token request failed with ${response.status} ${response.statusText}.`)
  }

  const payload = (await response.json()) as SpotifyTokenResponse
  const accessToken = payload.access_token?.trim()
  const expiresIn = typeof payload.expires_in === 'number' && Number.isFinite(payload.expires_in) ? payload.expires_in : 3600

  if (!accessToken) {
    throw new Error('Spotify token response did not include an access token.')
  }

  tokenCache = {
    accessToken,
    expiresAt: Date.now() + Math.max(60_000, (expiresIn - 60) * 1000),
  }

  return accessToken
}

function normalizeSpotifyTrack(
  track: SpotifyTrackItem,
  preference: MusicPreference,
  contextTokens: string[],
  searchIndex: number,
  trackIndex: number,
  videoContext?: MusicVideoContext | null,
): MusicRecommendation | null {
  const id = normalizeInline(track.id ?? '')
  const title = normalizeInline(track.name ?? '')
  const artist = normalizeInline(track.artists?.map((artistItem) => artistItem.name ?? '').filter(Boolean).join(', ') ?? '')
  const album = normalizeInline(track.album?.name ?? '')
  const externalUrl = normalizeInline(track.external_urls?.spotify ?? '')
  const previewUrl = normalizeInline(track.preview_url ?? '')
  const coverArtUrl = normalizeInline(track.album?.images?.find((image) => Boolean(image.url?.trim()))?.url ?? '')

  if (!id || !title || !artist || !coverArtUrl) {
    return null
  }

  const albumReleaseYear = parseReleaseYear(track.album?.release_date ?? '')
  const genre = deriveGenre(title, artist, album, preference)
  const energy = deriveEnergy(title, album, preference, track.popularity ?? 0)
  const bpm = estimateTempo(title, genre, energy, preference.energy)
  const matchedTerms = findMatchedTerms([title, artist, album, genre].join(' '), contextTokens)
  const popularity = typeof track.popularity === 'number' && Number.isFinite(track.popularity) ? track.popularity : 50
  const recencyBonus = albumReleaseYear ? Math.max(0, 5 - Math.min(5, new Date().getFullYear() - albumReleaseYear)) : 0
  const explicitPenalty = track.explicit ? -1.25 : 0
  const matchScore = scoreSpotifyTrack({
    title,
    artist,
    album,
    genre,
    matchedTerms,
    contextTokens,
    preference,
    energy,
    popularity,
    recencyBonus,
    explicitPenalty,
    videoContext,
  })

  return {
    id: `spotify-${id}`,
    title,
    subtitle: album || undefined,
    description: `Spotify search result for ${title}.`,
    album: album || undefined,
    artist,
    producer: artist,
    genre,
    bpm,
    vibeTags: buildVibeTags({
      genre,
      energy,
      preference,
      matchedTerms,
      popularity,
      recencyBonus,
    }),
    coverArtUrl,
    coverArtPosition: '50% 50%',
    previewUrl: previewUrl
      ? `/api/music/preview?url=${encodeURIComponent(previewUrl)}`
      : buildFallbackPreviewUrl({ title, artist, mood: preference.mood, bpm }),
    reason: buildReason({
      title,
      artist,
      genre,
      bpm,
      preference,
      matchedTerms,
      popularity,
      recencyBonus,
      trackExplicit: Boolean(track.explicit),
      videoContext,
    }),
    mood: preference.mood,
    energy,
    sourcePlatform: 'online',
    durationSec: Math.max(15, Math.round((track.duration_ms ?? 0) / 1000) || 30),
    sourceUrl: externalUrl || undefined,
    license: 'online-preview',
    matchScore,
    matchedTerms,
    exactMatch: isExactSpotifyMatch(title, artist, album, contextTokens.join(' ')),
    releaseYear: albumReleaseYear ?? undefined,
  }
}

function scoreSpotifyTrack({
  title,
  artist,
  album,
  genre,
  matchedTerms,
  contextTokens,
  preference,
  energy,
  popularity,
  recencyBonus,
  explicitPenalty,
  videoContext,
}: {
  title: string
  artist: string
  album: string
  genre: string
  matchedTerms: string[]
  contextTokens: string[]
  preference: MusicPreference
  energy: MusicPreference['energy']
  popularity: number
  recencyBonus: number
  explicitPenalty: number
  videoContext?: MusicVideoContext | null
}) {
  const haystack = normalizeInline([title, artist, album, genre, matchedTerms.join(' ')].filter(Boolean).join(' '))
  let score = 0

  const tokens = contextTokens.length > 0 ? contextTokens : extractKeywords(`${title} ${artist} ${album}`)
  const strongSelectionCue =
    hasAny(haystack, ['strong', 'knockout', 'anthem', 'banger', 'impact', 'punchy', 'power', 'driving', 'hero', 'headline', 'statement', 'viral', 'trending', 'spotify']) ||
    hasAny(tokens.join(' '), ['strong', 'knockout', 'anthem', 'banger', 'impact', 'punchy', 'viral', 'trending'])
  const wantsAmbient =
    preference.mood === 'minimal' ||
    hasAny(haystack, ['ambient', 'soft', 'subtle', 'under dialogue', 'documentary', 'reflective']) ||
    hasAny(videoContext?.intent?.sentiment.summary ?? '', ['reflective', 'voice-first'])

  for (const token of tokens) {
    if (token.length < 3) continue
    if (haystack.includes(token)) {
      score += token.length > 5 ? 3.5 : 2
    }
  }

  if (preference.mood === 'cinematic' && hasAny(haystack, ['cinematic', 'score', 'trailer', 'luxury'])) score += 3
  if (preference.mood === 'uplifting' && hasAny(haystack, ['anthem', 'bright', 'pop', 'dance', 'viral'])) score += 3
  if (preference.mood === 'dark' && hasAny(haystack, ['dark', 'moody', 'tension', 'night', 'drama'])) score += 3
  if (preference.mood === 'minimal' && hasAny(haystack, ['minimal', 'ambient', 'soft', 'under dialogue'])) score += 2.5
  if (preference.mood === 'playful' && hasAny(haystack, ['playful', 'light', 'friendly', 'warm'])) score += 2.5
  if (preference.energy === 'high' && energy === 'high') score += 3
  if (preference.energy === 'low' && energy === 'low') score += 2
  if (!wantsAmbient && energy === 'low') score -= 2.5
  if (!wantsAmbient && preference.mood === 'minimal') score -= 1.5
  if (strongSelectionCue && energy === 'high') score += 3
  if (strongSelectionCue && hasAny(haystack, ['driving', 'impact', 'launch', 'pulse', 'snappy', 'anthem', 'hero'])) score += 2.5

  score += popularity / 5
  score += recencyBonus
  score += explicitPenalty
  score -= Math.min(searchIndexPenalty(videoContext), 3)

  return score
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
  const contextText = [query, projectTitle, initialPrompt, buildVideoContextText(videoContext)].filter(Boolean).join(' ')
  const tokens = extractKeywords(contextText)
  const moodPhrase = buildMoodPhrase(preference)
  const energyPhrase =
    preference.energy === 'high' ? 'driving' : preference.energy === 'low' ? 'soft' : 'balanced'
  const trendPhrases = [
    ...(videoContext?.intent?.trends ?? []).flatMap((trend) => trend.tags.slice(0, 2)),
    ...(videoContext?.intent?.searchTerms ?? []).slice(0, 4),
  ]

  return uniqueStrings([
    query,
    [moodPhrase, tokens.slice(0, 4).join(' ')].filter(Boolean).join(' '),
    [moodPhrase, energyPhrase, tokens.slice(0, 3).join(' ')].filter(Boolean).join(' '),
    [projectTitle, moodPhrase, 'soundtrack'].filter(Boolean).join(' '),
    [initialPrompt, moodPhrase, 'spotify'].filter(Boolean).join(' '),
    [buildVideoContextText(videoContext), moodPhrase].filter(Boolean).join(' '),
    ...trendPhrases,
  ])
    .filter(Boolean)
    .slice(0, 5)
}

function buildReason({
  title,
  artist,
  genre,
  bpm,
  preference,
  matchedTerms,
  popularity,
  recencyBonus,
  trackExplicit,
  videoContext,
}: {
  title: string
  artist: string
  genre: string
  bpm: number
  preference: MusicPreference
  matchedTerms: string[]
  popularity: number
  recencyBonus: number
  trackExplicit: boolean
  videoContext?: MusicVideoContext | null
}) {
  const moodLine = preference.mood === 'uplifting' ? 'driving pop energy' : preference.mood === 'dark' ? 'dark momentum' : preference.mood === 'minimal' ? 'under-dialogue restraint' : preference.mood === 'playful' ? 'playful lift' : 'cinematic lift'
  const cueLine = matchedTerms.length > 0 ? `Matched ${matchedTerms.slice(0, 2).join(' and ')} cues.` : ''
  const trendLine = popularity >= 75 ? 'Strong Spotify popularity.' : 'Solid Spotify fit.'
  const recencyLine = recencyBonus > 0 ? 'Recent catalog signal.' : ''
  const contextLine = videoContext?.intent?.summary ? `Intent: ${videoContext.intent.summary}.` : videoContext?.summary ? `Context: ${videoContext.summary}.` : ''
  const explicitLine = trackExplicit ? 'Contains explicit lyrics.' : 'Clean result.'

  return `${title} by ${artist} fits a ${moodLine} lane in ${genre.toLowerCase()} at ${bpm} BPM. ${trendLine} ${recencyLine} ${explicitLine} ${cueLine} ${contextLine}`.trim()
}

function buildVibeTags({
  genre,
  energy,
  preference,
  matchedTerms,
  popularity,
  recencyBonus,
}: {
  genre: string
  energy: MusicPreference['energy']
  preference: MusicPreference
  matchedTerms: string[]
  popularity: number
  recencyBonus: number
}) {
  return uniqueStrings([
    preference.mood,
    energy === 'low' ? 'under dialogue' : energy === 'high' ? 'driving' : 'steady',
    genre.toLowerCase(),
    popularity >= 75 ? 'trending' : 'current',
    recencyBonus > 0 ? 'recent' : '',
    ...matchedTerms,
  ]).slice(0, 5)
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

function deriveGenre(title: string, artist: string, album: string, preference: MusicPreference) {
  const text = normalizeInline([title, artist, album].join(' '))
  if (hasAny(text, ['trap', 'rap', 'hip hop', 'hip-hop'])) return 'Hip Hop'
  if (hasAny(text, ['house', 'dance', 'club', 'edm', 'electronic'])) return 'Electronic'
  if (hasAny(text, ['ambient', 'underscore', 'score', 'cinematic', 'trailer'])) return 'Cinematic'
  if (hasAny(text, ['rock', 'anthem', 'guitar'])) return 'Rock'
  if (hasAny(text, ['acoustic', 'folk', 'indie'])) return 'Indie'
  if (preference.mood === 'minimal') return 'Ambient'
  if (preference.mood === 'uplifting') return 'Pop'
  if (preference.mood === 'dark') return 'Electronic'
  if (preference.mood === 'playful') return 'Pop'
  return 'Cinematic'
}

function deriveEnergy(title: string, album: string, preference: MusicPreference, popularity: number): MusicPreference['energy'] {
  const text = normalizeInline([title, album].join(' '))
  if (hasAny(text, ['ambient', 'minimal', 'soft', 'acoustic'])) return 'low'
  if (hasAny(text, ['anthem', 'dance', 'club', 'banger', 'viral', 'driving', 'impact']) || preference.energy === 'high' || popularity >= 72) {
    return 'high'
  }
  return preference.energy
}

function estimateTempo(trackId: string, genre: string, energy: MusicPreference['energy'], preferenceEnergy: MusicPreference['energy']) {
  const base =
    energy === 'low'
      ? 88
      : energy === 'high'
        ? 126
        : preferenceEnergy === 'high'
          ? 122
          : 108
  const hash = hashString(`${trackId}-${genre}`)
  return Math.round(base + (hash % 9) - 4)
}

function parseReleaseYear(value: string) {
  const year = Number(value.slice(0, 4))
  return Number.isFinite(year) && year > 1900 ? year : null
}

function findMatchedTerms(value: string, contextTokens: string[]) {
  const haystack = normalizeInline(value)
  return uniqueStrings(contextTokens.filter((token) => token.length >= 3 && haystack.includes(token))).slice(0, 3)
}

function isExactSpotifyMatch(title: string, artist: string, album: string, query: string) {
  const normalizedQuery = normalizeInline(query)
  if (!normalizedQuery) return false
  const normalizedTitle = normalizeInline(title)
  const normalizedArtist = normalizeInline(artist)
  const normalizedAlbum = normalizeInline(album)
  return (
    normalizedQuery === normalizedTitle ||
    normalizedQuery === `${normalizedTitle} ${normalizedArtist}` ||
    normalizedQuery === `${normalizedArtist} ${normalizedTitle}` ||
    normalizedQuery === normalizedAlbum ||
    normalizedQuery === `${normalizedTitle} by ${normalizedArtist}`
  )
}

function buildFallbackPreviewUrl({
  title,
  artist,
  mood,
  bpm,
}: {
  title: string
  artist: string
  mood: MusicMood
  bpm: number
}) {
  const params = new URLSearchParams({
    seed: `${title}-${artist}`,
    title,
    artist,
    mood,
    bpm: String(bpm),
  })
  return `/api/music/preview?${params.toString()}`
}

function searchIndexPenalty(videoContext?: MusicVideoContext | null) {
  const intensity = videoContext?.intent?.sentiment.energy
  if (intensity === 'high') return 0.1
  if (intensity === 'low') return 0.2
  return 0.15
}

function resolveSpotifyConfig(): SpotifyConfig | null {
  const clientId = sanitizeConfigValue(process.env.SPOTIFY_CLIENT_ID ?? '')
  const clientSecret = sanitizeConfigValue(process.env.SPOTIFY_CLIENT_SECRET ?? '')
  const market = sanitizeConfigValue(process.env.SPOTIFY_MARKET ?? 'US').toUpperCase() || 'US'

  if (!clientId || !clientSecret) return null

  return {
    clientId,
    clientSecret,
    market,
  }
}

function normalizeText(value: string) {
  return value.toLowerCase().replace(/\s+/g, ' ').trim()
}

function normalizeInline(value: string) {
  return value.replace(/\s+/g, ' ').trim()
}

function sanitizeConfigValue(value: string) {
  return value.replace(/\s+/g, ' ').trim()
}

function uniqueStrings(values: string[]) {
  return values
    .map((value) => normalizeInline(value))
    .filter(Boolean)
    .filter((value, index, all) => all.indexOf(value) === index)
}

function extractKeywords(value: string) {
  return normalizeText(value)
    .split(/[^a-z0-9]+/g)
    .map((token) => token.trim())
    .filter((token) => token.length > 2 && !STOPWORDS.has(token))
}

function hasAny(text: string, needles: string[]) {
  return needles.some((needle) => text.includes(needle))
}

function hashString(value: string) {
  let hash = 0
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(index)
    hash |= 0
  }
  return Math.abs(hash)
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
  'in',
  'into',
  'is',
  'it',
  'of',
  'on',
  'or',
  'the',
  'to',
  'with',
  'your',
])
