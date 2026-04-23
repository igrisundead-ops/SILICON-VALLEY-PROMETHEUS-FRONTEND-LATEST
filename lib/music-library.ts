import {
  MUSIC_CATALOG,
  buildMusicPreviewUrl,
  buildVideoContextText,
  normalizeMusicPreference,
  type MusicCatalogTrack,
} from '@/lib/music-catalog'
import type { MusicPreference, MusicRecommendation, MusicVideoContext } from '@/lib/types'

export type MusicLibrarySearchResult = {
  query: string
  results: MusicRecommendation[]
  exactMatch: MusicRecommendation | null
  preference: MusicPreference
  fallback: boolean
  total: number
}

export function searchOwnedMusicLibrary({
  query,
  preference,
  videoContext,
  catalog = MUSIC_CATALOG,
  limit = 4,
}: {
  query: string
  preference?: Partial<MusicPreference> | null
  videoContext?: MusicVideoContext | null
  catalog?: MusicCatalogTrack[]
  limit?: number
}): MusicLibrarySearchResult {
  const queryText = normalizeText(query)
  const tokens = tokenize(queryText)
  const fallback = queryText.length === 0
  const contextText = [queryText, buildVideoContextText(videoContext)].filter(Boolean).join(' ')
  const resolvedPreference = normalizeMusicPreference(preference, contextText, videoContext)
  const strongSelectionCue = hasAny(contextText, [
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
  ])
  const wantsAmbient = resolvedPreference.mood === 'minimal' || hasAny(contextText, ['ambient', 'soft', 'subtle', 'under dialogue', 'documentary', 'reflective'])

  const scored = catalog.map((track, index) => {
    const searchText = normalizeText(
      [
        track.id,
        track.title,
        track.subtitle,
        track.description,
        track.album,
        track.artist,
        track.producer,
        track.genre,
        track.vibeTags.join(' '),
        track.rankingKeywords.join(' '),
        track.storageKey,
        track.sourceUrl,
        track.license,
      ]
        .filter(Boolean)
        .join(' '),
    )

    const matchedTerms: string[] = []
    let score = 0

    if (!queryText) {
      score += 20
    }

    if (matchesExactTrack(track, queryText)) {
      score += 120
      matchedTerms.push(track.title.toLowerCase())
    }

    if (queryText && hasStrongFieldMatch(normalizeText(track.title), queryText)) {
      score += 55
    }

    if (queryText && searchText.includes(queryText)) {
      score += 38
    }

    if (queryText && hasStrongFieldMatch(normalizeText(track.artist), queryText)) {
      score += 18
    }

    if (queryText && hasStrongFieldMatch(normalizeText(track.producer), queryText)) {
      score += 14
    }

    if (track.mood === resolvedPreference.mood) score += 6
    if (track.energy === resolvedPreference.energy) score += 4
    if (track.sourcePlatform === resolvedPreference.sourcePlatform) score += 2
    if (videoContext?.pace === 'fast' && track.energy === 'high') score += 3
    if (videoContext?.pace === 'slow' && track.energy === 'low') score += 3
    if (!wantsAmbient && track.energy === 'low') score -= 2.25
    if (!wantsAmbient && track.mood === 'minimal') score -= 1.5
    if (strongSelectionCue && track.energy === 'high') score += 2.5
    if (strongSelectionCue && track.vibeTags.some((tag) => hasAny(tag, ['driving', 'impact', 'launch', 'pulse', 'snappy', 'anthem', 'hero']))) score += 2

    const bpmTarget =
      resolvedPreference.energy === 'low' ? 92 : resolvedPreference.energy === 'high' ? 128 : 110
    score += Math.max(0, 6 - Math.abs(track.bpm - bpmTarget) / 12)

    for (const token of tokens) {
      if (token.length < 3) continue
      if (searchText.includes(token)) {
        score += 3.5
        if (!matchedTerms.includes(token)) {
          matchedTerms.push(token)
        }
      }
    }

    if (resolvedPreference.mood === 'cinematic' && track.vibeTags.some((tag) => tag.includes('cinematic') || tag.includes('luxury'))) {
      score += 1.5
    }
    if (resolvedPreference.mood === 'uplifting' && track.energy === 'high') score += 1.5
    if (resolvedPreference.mood === 'dark' && track.mood === 'dark') score += 1.5
    if (resolvedPreference.mood === 'minimal' && track.energy !== 'high') score += 1
    if (videoContext?.summary) {
      const contextTokens = tokenize(videoContext.summary)
      for (const token of contextTokens) {
        if (token.length < 3) continue
        if (searchText.includes(token)) {
          score += 2
          if (!matchedTerms.includes(token)) {
            matchedTerms.push(token)
          }
        }
      }
    }
    if (videoContext?.signals?.length) {
      for (const token of videoContext.signals) {
        const normalizedToken = normalizeText(token)
        if (normalizedToken && searchText.includes(normalizedToken)) {
          score += 1.5
          if (!matchedTerms.includes(normalizedToken)) {
            matchedTerms.push(normalizedToken)
          }
        }
      }
    }

    return {
      track,
      score,
      matchedTerms,
      index,
    }
  })

  const sorted = scored.sort((a, b) => b.score - a.score || a.index - b.index)
  const results = sorted.slice(0, Math.max(1, limit)).map(({ track, score, matchedTerms }) =>
    mapTrackToRecommendation(track, {
      matchedTerms,
      score,
      preference: resolvedPreference,
      exactMatch: matchesExactTrack(track, queryText),
    }),
  )

  return {
    query: queryText,
    results,
    exactMatch: results.find((result) => result.exactMatch ?? false) ?? null,
    preference: resolvedPreference,
    fallback,
    total: catalog.length,
  }
}

export function findOwnedMusicTrackById(trackId: string, catalog = MUSIC_CATALOG) {
  const normalizedId = normalizeText(trackId)
  if (!normalizedId) return null

  const track = catalog.find((item) => normalizeText(item.id) === normalizedId)
  return track ? mapTrackToRecommendation(track, { score: 100, matchedTerms: [normalizedId], preference: normalizeMusicPreference(null, track.title), exactMatch: true }) : null
}

function mapTrackToRecommendation(
  track: MusicCatalogTrack,
  {
    score,
    matchedTerms,
    preference,
    exactMatch,
  }: {
    score: number
    matchedTerms: string[]
    preference: MusicPreference
    exactMatch: boolean
  },
): MusicRecommendation {
  return {
    id: track.id,
    title: track.title,
    subtitle: track.subtitle,
    description: track.description,
    album: track.album,
    artist: track.artist,
    producer: track.producer,
    genre: track.genre,
    bpm: track.bpm,
    vibeTags: track.vibeTags,
    coverArtUrl: track.coverArtUrl,
    coverArtPosition: track.coverArtPosition,
    previewUrl: buildMusicPreviewUrl(track.id),
    reason: buildLibraryReason(track, matchedTerms, preference, exactMatch),
    mood: track.mood,
    energy: track.energy,
    sourcePlatform: track.sourcePlatform,
    durationSec: track.durationSec,
    releaseYear: track.releaseYear,
    storageKey: track.storageKey,
    sourceUrl: track.sourceUrl,
    license: track.license,
    matchScore: score,
    matchedTerms,
    exactMatch,
  }
}

function buildLibraryReason(
  track: MusicCatalogTrack,
  matchedTerms: string[],
  preference: MusicPreference,
  exactMatch: boolean,
) {
  const exactLine = exactMatch ? 'Exact library match.' : 'Found in your owned library.'
  const preferenceLine =
    preference.mood === track.mood
      ? `${track.mood} tone`
      : `${track.mood} ${track.genre.toLowerCase()} texture`
  const termLine = matchedTerms.length > 0 ? `Matched ${matchedTerms.slice(0, 2).join(' and ')}.` : ''

  return `${exactLine} ${preferenceLine} at ${track.bpm} BPM. ${termLine}`.trim()
}

function matchesExactTrack(track: MusicCatalogTrack, queryText: string) {
  if (!queryText) return false

  const title = normalizeText(track.title)
  const artist = normalizeText(track.artist)
  const producer = normalizeText(track.producer)
  const id = normalizeText(track.id)
  const album = normalizeText(track.album ?? '')

  return (
    queryText === title ||
    queryText === `${title} ${artist}` ||
    queryText === `${artist} ${title}` ||
    queryText === id ||
    queryText === album ||
    queryText === `${title} by ${artist}` ||
    queryText === `${track.title}`.toLowerCase().trim() ||
    queryText === `${track.artist}`.toLowerCase().trim() ||
    queryText === `${track.producer}`.toLowerCase().trim() ||
    queryText === `${track.title} ${track.producer}`.toLowerCase().trim() ||
    queryText === `${track.artist} ${track.producer}`.toLowerCase().trim()
  )
}

function hasStrongFieldMatch(fieldValue: string, queryText: string) {
  if (!fieldValue || !queryText) return false

  return fieldValue.includes(queryText) || queryText.includes(fieldValue)
}

function tokenize(value: string) {
  return normalizeText(value)
    .split(/[^a-z0-9]+/g)
    .map((token) => token.trim())
    .filter((token) => token.length > 0)
}

function normalizeText(value: string) {
  return value.toLowerCase().replace(/\s+/g, ' ').trim()
}

function hasAny(text: string, needles: string[]) {
  return needles.some((needle) => text.includes(needle))
}
