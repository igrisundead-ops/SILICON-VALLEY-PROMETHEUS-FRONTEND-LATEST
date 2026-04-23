import { NextResponse } from 'next/server'

import { buildGoogleDriveDownloadUrl, findDriveMusicTrackById } from '@/lib/music-drive'
import { findMusicTrack, type MusicCatalogTrack } from '@/lib/music-catalog'

export const runtime = 'nodejs'

export async function GET(req: Request) {
  const url = new URL(req.url)
  const sourceUrl = url.searchParams.get('url')?.trim() ?? ''
  const trackId = url.searchParams.get('trackId')?.trim() ?? ''
  const seed = url.searchParams.get('seed')?.trim() ?? ''
  const title = url.searchParams.get('title')?.trim() ?? ''
  const artist = url.searchParams.get('artist')?.trim() ?? ''
  const mood = url.searchParams.get('mood')?.trim() ?? ''
  const bpm = Number(url.searchParams.get('bpm') ?? '')

  if (sourceUrl) {
    return proxyRemotePreview(sourceUrl)
  }

  if (!trackId) {
    if (seed || title || artist) {
      const wav = synthesizeGeneratedPreview({
        seed: seed || `${title}-${artist}`,
        title,
        artist,
        mood,
        bpm: Number.isFinite(bpm) ? bpm : 108,
      })

      return new NextResponse(wav, {
        headers: {
          'Content-Type': 'audio/wav',
          'Content-Length': String(wav.byteLength),
          'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
        },
      })
    }

    return NextResponse.json({ error: 'Missing trackId.' }, { status: 400 })
  }

  const track = findMusicTrack(trackId)
  if (track) {
    const wav = synthesizePreview(track)

    return new NextResponse(wav, {
      headers: {
        'Content-Type': 'audio/wav',
        'Content-Length': String(wav.byteLength),
        'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
      },
    })
  }

  const driveTrack = await findDriveMusicTrackById(trackId)
  if (driveTrack?.storageKey) {
    return proxyRemotePreview(buildGoogleDriveDownloadUrl(driveTrack.storageKey))
  }

  return NextResponse.json({ error: 'Unknown trackId.' }, { status: 404 })
}

async function proxyRemotePreview(sourceUrl: string) {
  const allowedUrl = sanitizeRemotePreviewUrl(sourceUrl)
  if (!allowedUrl) {
    return NextResponse.json({ error: 'Unsupported preview URL.' }, { status: 400 })
  }

  const upstream = await fetch(allowedUrl, {
    cache: 'no-store',
    headers: {
      Accept: 'audio/*',
    },
  })

  if (!upstream.ok || !upstream.body) {
    return NextResponse.json({ error: 'Unable to load the online preview.' }, { status: 502 })
  }

  const contentType = upstream.headers.get('content-type') ?? 'audio/mpeg'
  return new NextResponse(upstream.body, {
    headers: {
      'Content-Type': contentType,
      'Cache-Control': 'no-store',
    },
  })
}

function sanitizeRemotePreviewUrl(value: string) {
  try {
    const parsed = new URL(value)
    const hostname = parsed.hostname.toLowerCase()
    const allowed =
      hostname.endsWith('itunes.apple.com') ||
      hostname.endsWith('mzstatic.com') ||
      hostname.endsWith('apple.com') ||
      hostname.endsWith('scdn.co') ||
      hostname.endsWith('spotifycdn.com') ||
      hostname === 'drive.google.com' ||
      hostname.endsWith('drive.usercontent.google.com')

    if (!allowed || (parsed.protocol !== 'https:' && parsed.protocol !== 'http:')) {
      return null
    }

    parsed.protocol = 'https:'
    return parsed.toString()
  } catch {
    return null
  }
}

function synthesizePreview(track: MusicCatalogTrack) {
  const sampleRate = 22050
  const durationSec = Math.max(6, Math.min(12, track.durationSec))
  const totalSamples = Math.floor(sampleRate * durationSec)
  const bytesPerSample = 2
  const numChannels = 1
  const dataSize = totalSamples * numChannels * bytesPerSample
  const buffer = Buffer.alloc(44 + dataSize)

  writeString(buffer, 0, 'RIFF')
  buffer.writeUInt32LE(36 + dataSize, 4)
  writeString(buffer, 8, 'WAVE')
  writeString(buffer, 12, 'fmt ')
  buffer.writeUInt32LE(16, 16)
  buffer.writeUInt16LE(1, 20)
  buffer.writeUInt16LE(numChannels, 22)
  buffer.writeUInt32LE(sampleRate, 24)
  buffer.writeUInt32LE(sampleRate * numChannels * bytesPerSample, 28)
  buffer.writeUInt16LE(numChannels * bytesPerSample, 32)
  buffer.writeUInt16LE(16, 34)
  writeString(buffer, 36, 'data')
  buffer.writeUInt32LE(dataSize, 40)

  const beatHz = track.bpm / 60
  const root = track.previewTone.rootHz
  const harmony = track.previewTone.harmonyHz
  const bass = track.previewTone.bassHz
  const pulse = track.previewTone.pulseHz

  for (let i = 0; i < totalSamples; i += 1) {
    const t = i / sampleRate
    const beatPhase = (t * beatHz) % 1
    const pulseShape = Math.pow(Math.sin(Math.PI * beatPhase), 2)
    const motion = 0.36 + pulseShape * 0.64
    const fadeIn = Math.min(1, t / 0.45)
    const fadeOut = Math.min(1, Math.max(0, (durationSec - t) / 0.85))
    const envelope = fadeIn * fadeOut * motion

    const layer =
      Math.sin(2 * Math.PI * root * t) * 0.4 +
      Math.sin(2 * Math.PI * harmony * t * 0.5) * 0.24 +
      Math.sin(2 * Math.PI * bass * t * 0.25) * 0.2 +
      Math.sin(2 * Math.PI * pulse * t) * 0.12

    const sample = clamp(layer * envelope * 0.8, -0.95, 0.95)
    buffer.writeInt16LE(Math.round(sample * 0x7fff), 44 + i * 2)
  }

  return buffer
}

function synthesizeGeneratedPreview({
  seed,
  title,
  artist,
  mood,
  bpm,
}: {
  seed: string
  title: string
  artist: string
  mood: string
  bpm: number
}) {
  const sampleRate = 22050
  const durationSec = 8
  const totalSamples = Math.floor(sampleRate * durationSec)
  const bytesPerSample = 2
  const numChannels = 1
  const dataSize = totalSamples * numChannels * bytesPerSample
  const buffer = Buffer.alloc(44 + dataSize)

  writeString(buffer, 0, 'RIFF')
  buffer.writeUInt32LE(36 + dataSize, 4)
  writeString(buffer, 8, 'WAVE')
  writeString(buffer, 12, 'fmt ')
  buffer.writeUInt32LE(16, 16)
  buffer.writeUInt16LE(1, 20)
  buffer.writeUInt16LE(numChannels, 22)
  buffer.writeUInt32LE(sampleRate, 24)
  buffer.writeUInt32LE(sampleRate * numChannels * bytesPerSample, 28)
  buffer.writeUInt16LE(numChannels * bytesPerSample, 32)
  buffer.writeUInt16LE(16, 34)
  writeString(buffer, 36, 'data')
  buffer.writeUInt32LE(dataSize, 40)

  const hash = hashString(`${seed}-${title}-${artist}-${mood}`)
  const baseRoot =
    mood === 'uplifting'
      ? 146.83
      : mood === 'dark'
        ? 98
        : mood === 'minimal'
          ? 88
          : mood === 'playful'
            ? 132
            : 110
  const root = baseRoot + (hash % 9) - 4
  const harmony = root * 2
  const bass = root / 2
  const pulse = Math.max(2.2, bpm / 36)
  const beatHz = bpm / 60

  for (let i = 0; i < totalSamples; i += 1) {
    const t = i / sampleRate
    const beatPhase = (t * beatHz) % 1
    const pulseShape = Math.pow(Math.sin(Math.PI * beatPhase), 2)
    const motion = 0.34 + pulseShape * 0.66
    const fadeIn = Math.min(1, t / 0.4)
    const fadeOut = Math.min(1, Math.max(0, (durationSec - t) / 0.8))
    const envelope = fadeIn * fadeOut * motion

    const layer =
      Math.sin(2 * Math.PI * root * t) * 0.42 +
      Math.sin(2 * Math.PI * harmony * t * 0.5) * 0.24 +
      Math.sin(2 * Math.PI * bass * t * 0.25) * 0.18 +
      Math.sin(2 * Math.PI * pulse * t) * 0.12

    const sample = clamp(layer * envelope * 0.82, -0.95, 0.95)
    buffer.writeInt16LE(Math.round(sample * 0x7fff), 44 + i * 2)
  }

  return buffer
}

function writeString(buffer: Buffer, offset: number, value: string) {
  buffer.write(value, offset, value.length, 'ascii')
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value))
}

function hashString(value: string) {
  let hash = 0
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(index)
    hash |= 0
  }
  return Math.abs(hash)
}
