import { execFileSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'

const DEFAULT_GOOGLE_DRIVE_MUSIC_FOLDER_ID = '1oczdEdER5h0_6Bv4WqaDZTDZ8rP4DNDa'
const FOLDER_ID = process.env.GOOGLE_DRIVE_MUSIC_FOLDER_ID?.trim() || DEFAULT_GOOGLE_DRIVE_MUSIC_FOLDER_ID
const FFPROBE_PATH = process.env.FFPROBE_PATH?.trim() || 'C:\\ffmpeg\\bin\\ffprobe.exe'
const OUTPUT_PATH = path.join(process.cwd(), 'lib', 'generated', 'google-drive-music-catalog.ts')

const DRIVE_SCRAPE_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
}

const KNOWN_PREFIXES = ['aplmate.com - ', 'download from ', 'songslover.com - ']
const KNOWN_NOISE_PATTERNS = [
  /\((?:mp3\.pm|songslover\.com|rilds\.com)\)/gi,
  /\[(?:audiovk\.com|songslover\.com)\]/gi,
  /\b(?:mp3\.pm|songslover\.com|audiovk\.com|rilds\.com)\b/gi,
]

async function main() {
  const folderHtml = await fetchFolderHtml(FOLDER_ID)
  const entries = parseDriveFolderEntries(folderHtml)
  const snapshot = []

  for (const entry of entries) {
    const metadata = probeTrackMetadata(entry.fileId)
    const cleaned = cleanFileName(entry.fileName)
    const title = normalizeDisplayText(metadata.title || cleaned.title)
    const artist = normalizeDisplayText(metadata.artist || cleaned.artist)
    const producerCandidate = normalizeDisplayText(metadata.composer || metadata.albumArtist || '')
    const producer =
      producerCandidate && normalizeText(producerCandidate) !== normalizeText(artist) ? producerCandidate : ''

    snapshot.push({
      fileId: entry.fileId,
      fileName: entry.fileName,
      viewUrl: entry.viewUrl,
      title,
      artist,
      producer,
      album: normalizeDisplayText(metadata.album || ''),
      genre: normalizeDisplayText(metadata.genre || ''),
      durationSec: metadata.durationSec,
    })
  }

  snapshot.sort((left, right) => left.title.localeCompare(right.title))

  const fileContents = `${buildHeaderComment()}
export type GoogleDriveMusicCatalogSnapshotEntry = {
  fileId: string
  fileName: string
  viewUrl: string
  title: string
  artist: string
  producer: string
  album?: string
  genre?: string
  durationSec: number
}

export const GOOGLE_DRIVE_MUSIC_CATALOG_SNAPSHOT: GoogleDriveMusicCatalogSnapshotEntry[] = ${JSON.stringify(
    snapshot,
    null,
    2,
  )}
`

  mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true })
  writeFileSync(OUTPUT_PATH, fileContents, 'utf8')
  console.log(`Synced ${snapshot.length} Google Drive tracks into ${OUTPUT_PATH}`)
}

async function fetchFolderHtml(folderId) {
  const response = await fetch(`https://drive.google.com/embeddedfolderview?id=${encodeURIComponent(folderId)}#list`, {
    headers: DRIVE_SCRAPE_HEADERS,
  })

  if (!response.ok) {
    throw new Error(`Unable to fetch the Google Drive folder (${response.status}).`)
  }

  return await response.text()
}

function parseDriveFolderEntries(html) {
  const entries = []
  const matches = html.matchAll(
    /<div class="flip-entry" id="entry-([^"]+)"[\s\S]*?<a href="([^"]+)"[\s\S]*?<div class="flip-entry-title">([\s\S]*?)<\/div>/gi,
  )

  for (const match of matches) {
    const fileId = match[1]?.trim() ?? ''
    const viewUrl = decodeHtmlEntities(match[2] ?? '').trim()
    const fileName = decodeHtmlEntities(match[3] ?? '').trim()
    if (!fileId || !viewUrl || !fileName) continue
    if (!/\.(mp3|wav|m4a)$/i.test(fileName)) continue
    entries.push({ fileId, viewUrl, fileName })
  }

  return entries
}

function probeTrackMetadata(fileId) {
  const downloadUrl = `https://drive.google.com/uc?export=download&id=${encodeURIComponent(fileId)}`

  try {
    const stdout = execFileSync(
      FFPROBE_PATH,
      [
        '-v',
        'error',
        '-print_format',
        'json',
        '-show_entries',
        'format=duration:format_tags=title,artist,album,composer,genre,album_artist,albumartist,comment',
        downloadUrl,
      ],
      {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
      },
    )

    const parsed = JSON.parse(stdout)
    const format = parsed?.format ?? {}
    const tags = format?.tags ?? {}

    return {
      title: cleanTag(tags.title),
      artist: cleanTag(tags.artist),
      album: cleanTag(tags.album),
      composer: cleanTag(tags.composer),
      albumArtist: cleanTag(tags.album_artist || tags.albumartist),
      genre: cleanTag(tags.genre),
      durationSec: normalizeDuration(format.duration),
    }
  } catch {
    return {
      title: '',
      artist: '',
      album: '',
      composer: '',
      albumArtist: '',
      genre: '',
      durationSec: 12,
    }
  }
}

function cleanFileName(fileName) {
  const withoutExtension = fileName.replace(/\.[^.]+$/, '')
  let cleaned = decodeHtmlEntities(withoutExtension)
  const lowerFileName = cleaned.toLowerCase()
  const hasKnownPrefix = KNOWN_PREFIXES.some((prefix) => lowerFileName.startsWith(prefix))

  for (const prefix of KNOWN_PREFIXES) {
    if (cleaned.toLowerCase().startsWith(prefix)) {
      cleaned = cleaned.slice(prefix.length)
      break
    }
  }

  for (const pattern of KNOWN_NOISE_PATTERNS) {
    cleaned = cleaned.replace(pattern, '')
  }

  cleaned = cleaned
    .replace(/_/g, ' ')
    .replace(/\s+-\s+/g, ' - ')
    .replace(/\s+/g, ' ')
    .trim()

  const segments = cleaned
    .split(' - ')
    .map((segment) => segment.trim())
    .filter(Boolean)

  let title = cleaned
  let artist = 'Drive Library'

  if (segments.length >= 2) {
    if (hasKnownPrefix) {
      title = segments.slice(0, -1).join(' - ')
      artist = segments[segments.length - 1] || artist
    } else {
      artist = segments[0] || artist
      title = segments.slice(1).join(' - ')
    }
  }

  return {
    title,
    artist,
  }
}

function cleanTag(value) {
  return normalizeDisplayText(
    decodeHtmlEntities(String(value || ''))
      .replace(/\s+/g, ' ')
      .trim(),
  )
}

function normalizeDuration(value) {
  const parsed = Number.parseFloat(String(value || ''))
  if (!Number.isFinite(parsed) || parsed <= 0) return 12
  return Math.max(6, Math.round(parsed))
}

function normalizeDisplayText(value) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim()
}

function normalizeText(value) {
  return normalizeDisplayText(value).toLowerCase()
}

function decodeHtmlEntities(value) {
  return String(value || '')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
}

function buildHeaderComment() {
  return `// Generated by scripts/sync-google-drive-music-catalog.mjs on ${new Date().toISOString()}\n`
}

await main()
