import {
  MUSIC_CATALOG,
  normalizeMusicPreference,
  type MusicCatalogTrack,
} from '@/lib/music-catalog'
import { GOOGLE_DRIVE_MUSIC_CATALOG_SNAPSHOT } from '@/lib/generated/google-drive-music-catalog'

const DEFAULT_GOOGLE_DRIVE_MUSIC_FOLDER_ID = '1oczdEdER5h0_6Bv4WqaDZTDZ8rP4DNDa'
const DRIVE_FOLDER_CACHE_TTL_MS = 5 * 60 * 1000

type DriveMusicFolderCache = {
  expiresAt: number
  tracks: MusicCatalogTrack[]
}

type ParsedDriveEntry = {
  fileId: string
  fileName: string
  viewUrl: string
}

type DriveMusicMetadataOverride = (typeof GOOGLE_DRIVE_MUSIC_CATALOG_SNAPSHOT)[number]

let driveMusicFolderCache: DriveMusicFolderCache | null = null
let driveMusicFolderRequest: Promise<MusicCatalogTrack[]> | null = null

const DRIVE_SCRAPE_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
} as const

const KNOWN_DRIVE_FILE_PREFIXES = ['aplmate.com - ', 'download from ', 'songslover.com - '] as const
const KNOWN_DRIVE_FILE_NOISE_PATTERNS = [
  /\((?:mp3\.pm|songslover\.com|rilds\.com)\)/gi,
  /\[(?:audiovk\.com|songslover\.com)\]/gi,
  /\b(?:mp3\.pm|songslover\.com|audiovk\.com|rilds\.com)\b/gi,
] as const

const DRIVE_COVER_ART_BY_MOOD: Record<
  NonNullable<MusicCatalogTrack['mood']>,
  { coverArtUrl: string; coverArtPosition?: string }
> = {
  cinematic: {
    coverArtUrl: '/style-previews/podcast-1.jpg',
    coverArtPosition: '50% 22%',
  },
  uplifting: {
    coverArtUrl: '/style-previews/reels-heat-1.webp',
    coverArtPosition: '50% 36%',
  },
  dark: {
    coverArtUrl: '/style-previews/red-statue-1.jpg',
    coverArtPosition: '50% 34%',
  },
  minimal: {
    coverArtUrl: '/style-previews/docs-story-1.jpg',
    coverArtPosition: '52% 28%',
  },
  playful: {
    coverArtUrl: '/style-previews/iman-1.jpg',
    coverArtPosition: '50% 26%',
  },
}

const driveMusicSnapshotByFileId = new Map(
  GOOGLE_DRIVE_MUSIC_CATALOG_SNAPSHOT.map((entry) => [entry.fileId, entry]),
)

export function getConfiguredGoogleDriveMusicFolderId() {
  return process.env.GOOGLE_DRIVE_MUSIC_FOLDER_ID?.trim() || DEFAULT_GOOGLE_DRIVE_MUSIC_FOLDER_ID
}

export function buildGoogleDriveDownloadUrl(fileId: string) {
  return `https://drive.google.com/uc?export=download&id=${encodeURIComponent(fileId)}`
}

export async function fetchDriveMusicCatalog() {
  const folderId = getConfiguredGoogleDriveMusicFolderId()
  if (!folderId) return []

  if (driveMusicFolderCache && driveMusicFolderCache.expiresAt > Date.now()) {
    return driveMusicFolderCache.tracks
  }

  if (driveMusicFolderRequest) {
    return driveMusicFolderRequest
  }

  driveMusicFolderRequest = loadDriveMusicCatalog(folderId)
    .then((tracks) => {
      driveMusicFolderCache = {
        expiresAt: Date.now() + DRIVE_FOLDER_CACHE_TTL_MS,
        tracks,
      }
      return tracks
    })
    .finally(() => {
      driveMusicFolderRequest = null
    })

  return driveMusicFolderRequest
}

export async function listAvailableMusicCatalog() {
  const driveTracks = await fetchDriveMusicCatalog()
  return driveTracks.length > 0 ? driveTracks : MUSIC_CATALOG
}

export async function findDriveMusicTrackById(trackId: string) {
  const normalizedTrackId = normalizeDriveText(trackId)
  if (!normalizedTrackId) return null

  const tracks = await fetchDriveMusicCatalog()
  return (
    tracks.find(
      (track) =>
        normalizeDriveText(track.id) === normalizedTrackId ||
        normalizeDriveText(track.storageKey ?? '') === normalizedTrackId,
    ) ?? null
  )
}

async function loadDriveMusicCatalog(folderId: string) {
  const response = await fetch(`https://drive.google.com/embeddedfolderview?id=${encodeURIComponent(folderId)}#list`, {
    cache: 'no-store',
    headers: DRIVE_SCRAPE_HEADERS,
  })

  if (!response.ok) {
    throw new Error(`Unable to read the Google Drive music folder (${response.status}).`)
  }

  const html = await response.text()
  const parsedEntries = parseDriveFolderEntries(html)

  return parsedEntries.map((entry, index) => mapDriveEntryToMusicTrack(entry, index))
}

function parseDriveFolderEntries(html: string) {
  const matches = html.matchAll(
    /<div class="flip-entry" id="entry-([^"]+)"[\s\S]*?<a href="([^"]+)"[\s\S]*?<div class="flip-entry-title">([\s\S]*?)<\/div>/gi,
  )

  const entries: ParsedDriveEntry[] = []

  for (const match of matches) {
    const fileId = match[1]?.trim() ?? ''
    const viewUrl = decodeHtmlEntities(match[2] ?? '').trim()
    const rawFileName = decodeHtmlEntities(match[3] ?? '').trim()
    const lowerFileName = rawFileName.toLowerCase()

    if (!fileId || !viewUrl || !rawFileName) continue
    if (!lowerFileName.endsWith('.mp3') && !lowerFileName.endsWith('.wav') && !lowerFileName.endsWith('.m4a')) {
      continue
    }

    entries.push({
      fileId,
      fileName: rawFileName,
      viewUrl,
    })
  }

  return entries
}

function mapDriveEntryToMusicTrack(entry: ParsedDriveEntry, index: number): MusicCatalogTrack {
  const metadataOverride = driveMusicSnapshotByFileId.get(entry.fileId)
  const cleaned = cleanDriveTrackName(entry.fileName)
  const resolvedTitle = metadataOverride?.title || cleaned.title
  const resolvedArtist = metadataOverride?.artist || cleaned.artist
  const resolvedProducer = resolveProducer(metadataOverride, resolvedArtist)
  const resolvedAlbum = metadataOverride?.album?.trim() || undefined
  const resolvedGenre = metadataOverride?.genre?.trim() || undefined
  const preference = normalizeMusicPreference(null, [resolvedArtist, resolvedTitle, resolvedGenre, resolvedAlbum].filter(Boolean).join(' '))
  const inferredGenre = inferGenreFromPreference(preference.mood)
  const normalizedContextText = normalizeDriveText(
    [resolvedTitle, resolvedArtist, resolvedProducer, resolvedGenre, cleaned.subtitle, resolvedAlbum].filter(Boolean).join(' '),
  )
  const inferredBpm = inferBpmFromPreference(preference.energy, normalizedContextText)
  const inferredTags = inferVibeTags(normalizedContextText, preference.mood, preference.energy)
  const coverArt = DRIVE_COVER_ART_BY_MOOD[preference.mood]

  return {
    id: `gdrive-${entry.fileId}`,
    title: resolvedTitle,
    subtitle: cleaned.subtitle,
    description: buildDriveTrackDescription(resolvedTitle, resolvedArtist, preference.mood, preference.energy),
    artist: resolvedArtist,
    producer: resolvedProducer,
    album: resolvedAlbum,
    genre: resolvedGenre || inferredGenre,
    subgenre: resolvedGenre || inferredGenre,
    bpm: inferredBpm,
    mood: preference.mood,
    energy: preference.energy,
    vibeTags: inferredTags,
    moodTags: uniqueTokens([preference.mood, resolvedGenre || inferredGenre, ...inferredTags]),
    rankingKeywords: uniqueTokens([
      resolvedTitle,
      resolvedArtist,
      resolvedProducer,
      cleaned.subtitle,
      resolvedGenre || inferredGenre,
      resolvedAlbum ?? '',
      ...inferredTags,
      normalizedContextText,
    ]),
    energyScore: inferDriveEnergyScore(preference.energy, normalizedContextText),
    tempoRange: inferDriveTempoRange(inferredBpm, preference.energy),
    instrumentation: inferDriveInstrumentation(normalizedContextText, preference.mood, preference.energy),
    cinematicTags: inferDriveCinematicTags(normalizedContextText, preference.mood, resolvedGenre || inferredGenre),
    tensionLevel: inferDriveTensionLevel(normalizedContextText, preference.mood, preference.energy),
    emotionalTone: inferDriveEmotionalTone(normalizedContextText, preference.mood, preference.energy),
    idealUseCases: inferDriveUseCases(normalizedContextText, preference.mood, preference.energy),
    avoidContexts: inferDriveAvoidContexts(normalizedContextText, preference.mood, preference.energy),
    coverArtUrl: coverArt.coverArtUrl,
    coverArtPosition: coverArt.coverArtPosition,
    releaseYear: inferReleaseYear(normalizedContextText),
    durationSec: normalizeDurationSec(metadataOverride?.durationSec),
    sourcePlatform: 'local',
    storageKey: entry.fileId,
    sourceUrl: entry.viewUrl,
    license: 'owned',
    qualityScore: inferDriveQualityScore(metadataOverride, normalizedContextText, index),
    usageCount: inferDriveUsageCount(index),
    freshnessScore: inferDriveFreshnessScore(metadataOverride, normalizedContextText, index),
    previewTone: buildPreviewTone(preference.mood, preference.energy, index),
  }
}

function cleanDriveTrackName(fileName: string) {
  const withoutExtension = fileName.replace(/\.[^.]+$/, '')
  let cleaned = decodeHtmlEntities(withoutExtension)

  for (const prefix of KNOWN_DRIVE_FILE_PREFIXES) {
    if (cleaned.toLowerCase().startsWith(prefix)) {
      cleaned = cleaned.slice(prefix.length)
      break
    }
  }

  for (const pattern of KNOWN_DRIVE_FILE_NOISE_PATTERNS) {
    cleaned = cleaned.replace(pattern, '')
  }

  cleaned = cleaned
    .replace(/_/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .replace(/\s+-\s+/g, ' - ')
    .replace(/\s+/g, ' ')
    .trim()

  const segments = cleaned
    .split(' - ')
    .map((segment) => segment.trim())
    .filter(Boolean)

  const hasKnownPrefix = KNOWN_DRIVE_FILE_PREFIXES.some((prefix) => fileName.toLowerCase().startsWith(prefix))
  let title = cleaned
  let artist = 'Drive Library'

  if (segments.length >= 2) {
    if (hasKnownPrefix) {
      title = segments.slice(0, -1).join(' - ')
      artist = segments[segments.length - 1] ?? artist
    } else {
      artist = segments[0] ?? artist
      title = segments.slice(1).join(' - ')
    }
  }

  title = normalizeDisplayText(title || cleaned)
  artist = normalizeDisplayText(artist)

  const subtitle = buildSubtitle(title, artist)

  return {
    title,
    artist,
    subtitle,
    normalizedText: normalizeDriveText([title, artist, subtitle].join(' ')),
  }
}

function buildSubtitle(title: string, artist: string) {
  const lowerTitle = normalizeDriveText(title)
  if (lowerTitle.includes('slowed')) return 'Slowed cut'
  if (lowerTitle.includes('remix')) return 'Remix'
  if (lowerTitle.includes('feat')) return `Feat. ${artist}`
  if (lowerTitle.includes('lullaby') || lowerTitle.includes('ambient')) return 'Ambient bed'
  if (lowerTitle.includes('batman') || lowerTitle.includes('zimmer')) return 'Score cue'
  return 'Drive import'
}

function buildDriveTrackDescription(
  title: string,
  artist: string,
  mood: MusicCatalogTrack['mood'],
  energy: MusicCatalogTrack['energy'],
) {
  const energyLine =
    energy === 'low'
      ? 'stays soft under dialogue and slower spoken sections'
      : energy === 'high'
        ? 'adds more lift for hookier, higher-motion edits'
        : 'holds a steady pulse without pushing too hard'

  return `${title} by ${artist} from the Drive music folder. ${capitalizeWord(mood)} tone that ${energyLine}.`
}

function inferGenreFromPreference(mood: MusicCatalogTrack['mood']) {
  if (mood === 'minimal') return 'Ambient'
  if (mood === 'uplifting') return 'Pop'
  if (mood === 'dark') return 'Cinematic'
  if (mood === 'playful') return 'Indie Pop'
  return 'Electronic'
}

function inferBpmFromPreference(energy: MusicCatalogTrack['energy'], text: string) {
  if (text.includes('slowed')) return 82
  if (text.includes('remix')) return energy === 'high' ? 128 : 118
  if (energy === 'low') return 90
  if (energy === 'high') return 128
  return 108
}

function inferVibeTags(
  text: string,
  mood: MusicCatalogTrack['mood'],
  energy: MusicCatalogTrack['energy'],
) {
  const tags = new Set<string>([mood, energy === 'high' ? 'driving' : energy === 'low' ? 'under-dialogue' : 'steady'])

  if (text.includes('founder')) tags.add('founder')
  if (text.includes('documentary') || text.includes('zimmer')) tags.add('documentary')
  if (text.includes('slowed')) tags.add('slowed')
  if (text.includes('remix')) tags.add('remix')
  if (text.includes('ambient') || text.includes('lullaby')) tags.add('ambient')
  if (text.includes('kygo') || text.includes('lost frequencies')) tags.add('uplift')
  if (text.includes('score') || text.includes('batman')) tags.add('score')

  return [...tags]
}

function inferReleaseYear(text: string) {
  const yearMatch = text.match(/\b(19|20)\d{2}\b/)
  return yearMatch ? Number(yearMatch[0]) : new Date().getFullYear()
}

function resolveProducer(metadataOverride: DriveMusicMetadataOverride | undefined, artist: string) {
  const producerCandidate = metadataOverride?.producer?.trim() || ''
  if (!producerCandidate) return ''
  return normalizeDriveText(producerCandidate) === normalizeDriveText(artist) ? '' : producerCandidate
}

function normalizeDurationSec(value: number | undefined) {
  if (!value || !Number.isFinite(value) || value <= 0) return 12
  return Math.max(6, Math.round(value))
}

function buildPreviewTone(
  mood: MusicCatalogTrack['mood'],
  energy: MusicCatalogTrack['energy'],
  index: number,
) {
  const rootBase =
    mood === 'uplifting'
      ? 146.83
      : mood === 'dark'
        ? 98
        : mood === 'minimal'
          ? 88
          : mood === 'playful'
            ? 132
            : 110

  const rootHz = rootBase + (index % 7) - 3
  const pulseBase = energy === 'high' ? 4.4 : energy === 'low' ? 2.6 : 3.4

  return {
    rootHz,
    harmonyHz: rootHz * 2,
    bassHz: rootHz / 2,
    pulseHz: pulseBase,
  }
}

function inferDriveEnergyScore(energy: MusicCatalogTrack['energy'], text: string) {
  const base = energy === 'high' ? 84 : energy === 'low' ? 28 : 58
  if (text.includes('trailer') || text.includes('hero') || text.includes('launch')) return Math.min(100, base + 8)
  if (text.includes('ambient') || text.includes('documentary') || text.includes('under dialogue')) return Math.max(0, base - 10)
  return base
}

function inferDriveTempoRange(bpm: number, energy: MusicCatalogTrack['energy']): [number, number] {
  const spread = energy === 'high' ? 14 : energy === 'low' ? 8 : 10
  return [Math.max(60, bpm - spread), Math.min(180, bpm + spread)]
}

function inferDriveInstrumentation(text: string, mood: MusicCatalogTrack['mood'], energy: MusicCatalogTrack['energy']) {
  const hints = new Set<string>()
  if (mood === 'minimal') hints.add('piano')
  if (mood === 'cinematic') hints.add('strings')
  if (mood === 'dark') hints.add('low strings')
  if (mood === 'playful') hints.add('light percussion')
  if (energy === 'high') hints.add('drums')
  if (energy === 'low') hints.add('pads')
  if (text.includes('luxury')) hints.add('synth pulse')
  if (text.includes('documentary')) hints.add('textural bed')
  if (text.includes('trailer') || text.includes('hero')) hints.add('braams')
  return [...hints].slice(0, 5)
}

function inferDriveCinematicTags(text: string, mood: MusicCatalogTrack['mood'], genre: string) {
  const tags = new Set<string>()
  if (mood === 'cinematic') tags.add('cinematic')
  if (mood === 'minimal') tags.add('editorial')
  if (mood === 'dark') tags.add('tension')
  if (text.includes('luxury')) tags.add('luxury')
  if (text.includes('documentary')) tags.add('documentary')
  if (text.includes('trailer') || genre.toLowerCase().includes('trailer')) tags.add('trailer')
  if (text.includes('product') || text.includes('ad') || text.includes('launch')) tags.add('commercial')
  return [...tags].slice(0, 5)
}

function inferDriveTensionLevel(text: string, mood: MusicCatalogTrack['mood'], energy: MusicCatalogTrack['energy']) {
  const base = mood === 'dark' ? 72 : mood === 'cinematic' ? 56 : mood === 'minimal' ? 22 : 40
  const energyBoost = energy === 'high' ? 12 : energy === 'low' ? -10 : 0
  const contextBoost = text.includes('trailer') || text.includes('impact') ? 14 : text.includes('documentary') ? -8 : 0
  return Math.max(0, Math.min(100, base + energyBoost + contextBoost))
}

function inferDriveEmotionalTone(text: string, mood: MusicCatalogTrack['mood'], energy: MusicCatalogTrack['energy']) {
  if (text.includes('luxury')) return 'sleek and premium'
  if (text.includes('documentary')) return 'warm and reflective'
  if (text.includes('trailer')) return 'urgent and expansive'
  if (mood === 'minimal') return energy === 'low' ? 'soft and intimate' : 'calm and thoughtful'
  if (mood === 'dark') return 'tense and controlled'
  if (mood === 'uplifting') return 'bright and forward'
  return 'balanced and polished'
}

function inferDriveUseCases(text: string, mood: MusicCatalogTrack['mood'], energy: MusicCatalogTrack['energy']) {
  const uses = new Set<string>()
  if (text.includes('launch') || energy === 'high') uses.add('launch cut')
  if (text.includes('documentary') || mood === 'minimal') uses.add('founder story')
  if (text.includes('luxury') || mood === 'cinematic') uses.add('premium product visuals')
  if (text.includes('trailer') || mood === 'dark') uses.add('hero reveal')
  if (energy === 'low') uses.add('under dialogue bed')
  if (text.includes('reel') || text.includes('tiktok')) uses.add('social hook')
  return [...uses].slice(0, 5)
}

function inferDriveAvoidContexts(text: string, mood: MusicCatalogTrack['mood'], energy: MusicCatalogTrack['energy']) {
  const avoid = new Set<string>()
  if (energy === 'high') avoid.add('quiet interview bed')
  if (energy === 'low') avoid.add('aggressive trailer cut')
  if (mood === 'minimal') avoid.add('busy vocals')
  if (mood === 'dark') avoid.add('playful montage')
  if (text.includes('luxury')) avoid.add('cheap-sounding drops')
  if (text.includes('documentary')) avoid.add('overly hype commercials')
  return [...avoid].slice(0, 5)
}

function inferDriveQualityScore(metadataOverride: DriveMusicMetadataOverride | undefined, text: string, index: number) {
  const fromMetadata = metadataOverride?.genre?.trim() ? 88 : 72
  const contextBoost = text.includes('luxury') || text.includes('documentary') ? 4 : 0
  return Math.max(0, Math.min(100, fromMetadata + contextBoost - (index % 5)))
}

function inferDriveUsageCount(index: number) {
  return 1 + (index % 4)
}

function inferDriveFreshnessScore(metadataOverride: DriveMusicMetadataOverride | undefined, text: string, index: number) {
  const base = metadataOverride?.genre?.trim() ? 84 : 76
  const boost = text.includes('trailer') || text.includes('luxury') ? 4 : 0
  return Math.max(0, Math.min(100, base + boost - (index % 3)))
}

function normalizeDisplayText(value: string) {
  return value
    .replace(/\s+/g, ' ')
    .replace(/\bfeat\.\b/gi, 'feat.')
    .trim()
}

function decodeHtmlEntities(value: string) {
  return value
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
}

function normalizeDriveText(value: string) {
  return value.toLowerCase().replace(/\s+/g, ' ').trim()
}

function uniqueTokens(values: string[]) {
  return [...new Set(values.flatMap((value) => normalizeDriveText(value).split(/[^a-z0-9]+/g)).filter((token) => token.length >= 3))]
}

function capitalizeWord(value: string) {
  return value.slice(0, 1).toUpperCase() + value.slice(1)
}
