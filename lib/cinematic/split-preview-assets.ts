import { execFile } from 'node:child_process'
import { createHash } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { access, mkdir, readFile, stat, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

const SPLIT_PREVIEW_CACHE_ROOT = path.join(os.tmpdir(), 'prometheus-split-preview-cache')
const TARGET_OUTPUT_HEIGHT = 960
const TARGET_OUTPUT_WIDTH = 540

type SplitPreviewSide = 'left' | 'right'

type SplitPreviewManifest = {
  key: string
  createdAt: string
  leftFileName: string
  rightFileName: string
}

export async function createSplitPreviewAssets({
  buffer,
  fileName,
}: {
  buffer: Buffer
  fileName: string
}) {
  const key = createHash('sha1').update(buffer).update('split-preview-v2').digest('hex')
  const extension = normalizeExtension(path.extname(fileName))
  const cacheDir = path.join(SPLIT_PREVIEW_CACHE_ROOT, key)
  const manifestFilePath = path.join(cacheDir, 'manifest.json')
  const inputFilePath = path.join(cacheDir, `source${extension}`)
  const leftFileName = 'left.mp4'
  const rightFileName = 'right.mp4'
  const leftFilePath = path.join(cacheDir, leftFileName)
  const rightFilePath = path.join(cacheDir, rightFileName)

  await mkdir(cacheDir, { recursive: true })

  const existingManifest = await readManifest(manifestFilePath)
  if (existingManifest) {
    const leftReady = await fileExists(path.join(cacheDir, existingManifest.leftFileName))
    const rightReady = await fileExists(path.join(cacheDir, existingManifest.rightFileName))
    if (leftReady && rightReady) {
      return buildSplitPreviewPayload(key, existingManifest.leftFileName, existingManifest.rightFileName)
    }
  }

  await writeFile(inputFilePath, buffer)
  const dimensions = await probeVideoDimensions(inputFilePath)
  const cropWidth = roundToEven(Math.min(dimensions.width, (dimensions.height * 9) / 16))
  const cropHeight = roundToEven(dimensions.height)
  const leftCropX = 0
  const rightCropX = Math.max(0, dimensions.width - cropWidth)

  await renderSplitVariant({
    inputFilePath,
    outputFilePath: leftFilePath,
    cropWidth,
    cropHeight,
    cropX: leftCropX,
  })
  await renderSplitVariant({
    inputFilePath,
    outputFilePath: rightFilePath,
    cropWidth,
    cropHeight,
    cropX: rightCropX,
  })

  const manifest: SplitPreviewManifest = {
    key,
    createdAt: new Date().toISOString(),
    leftFileName,
    rightFileName,
  }
  await writeFile(manifestFilePath, JSON.stringify(manifest, null, 2), 'utf8')

  return buildSplitPreviewPayload(key, leftFileName, rightFileName)
}

export async function resolveSplitPreviewAssetFile(key: string, side: SplitPreviewSide) {
  const safeKey = sanitizeKey(key)
  if (!safeKey) return null

  const cacheDir = path.join(SPLIT_PREVIEW_CACHE_ROOT, safeKey)
  const manifest = await readManifest(path.join(cacheDir, 'manifest.json'))
  if (!manifest) return null

  const fileName = side === 'left' ? manifest.leftFileName : manifest.rightFileName
  const filePath = path.join(cacheDir, fileName)

  await access(filePath)
  const fileStat = await stat(filePath)

  return {
    filePath,
    fileStat,
    contentType: 'video/mp4',
  }
}

export function createSplitPreviewNodeStream(filePath: string) {
  return createReadStream(filePath)
}

function buildSplitPreviewPayload(key: string, leftFileName: string, rightFileName: string) {
  return {
    key,
    leftUrl: `/api/cinematic/split-preview?key=${encodeURIComponent(key)}&side=left`,
    rightUrl: `/api/cinematic/split-preview?key=${encodeURIComponent(key)}&side=right`,
    leftFileName,
    rightFileName,
  }
}

async function renderSplitVariant({
  inputFilePath,
  outputFilePath,
  cropWidth,
  cropHeight,
  cropX,
}: {
  inputFilePath: string
  outputFilePath: string
  cropWidth: number
  cropHeight: number
  cropX: number
}) {
  const filter = [
    `crop=${cropWidth}:${cropHeight}:${cropX}:0`,
    `scale=${TARGET_OUTPUT_WIDTH}:${TARGET_OUTPUT_HEIGHT}:force_original_aspect_ratio=increase`,
    `crop=${TARGET_OUTPUT_WIDTH}:${TARGET_OUTPUT_HEIGHT}`,
    'fps=24',
    'format=yuv420p',
  ].join(',')

  const ffmpegPath = await resolveFfmpegPath()
  await execFileAsync(ffmpegPath, [
    '-y',
    '-i',
    inputFilePath,
    '-an',
    '-vf',
    filter,
    '-c:v',
    'libx264',
    '-preset',
    'veryfast',
    '-crf',
    '30',
    '-movflags',
    '+faststart',
    outputFilePath,
  ])
}

async function probeVideoDimensions(filePath: string) {
  const ffprobePath = await resolveFfprobePath()
  const { stdout } = await execFileAsync(ffprobePath, [
    '-v',
    'error',
    '-select_streams',
    'v:0',
    '-show_entries',
    'stream=width,height',
    '-of',
    'default=noprint_wrappers=1:nokey=0',
    filePath,
  ])

  const widthMatch = stdout.match(/width=(\d+)/)
  const heightMatch = stdout.match(/height=(\d+)/)
  const width = Number(widthMatch?.[1] ?? 0)
  const height = Number(heightMatch?.[1] ?? 0)

  if (!width || !height) {
    throw new Error('Unable to read source video dimensions for split preview generation.')
  }

  return { width, height }
}

async function resolveFfmpegPath() {
  const candidates = [process.env.FFMPEG_PATH?.trim(), 'C:\\ffmpeg\\bin\\ffmpeg.exe', 'ffmpeg'].filter(
    (value): value is string => Boolean(value),
  )

  for (const candidate of candidates) {
    try {
      await execFileAsync(candidate, ['-version'])
      return candidate
    } catch {
      // Try next candidate.
    }
  }

  throw new Error('ffmpeg is not available for split preview generation.')
}

async function resolveFfprobePath() {
  const candidates = [process.env.FFPROBE_PATH?.trim(), 'C:\\ffmpeg\\bin\\ffprobe.exe', 'ffprobe'].filter(
    (value): value is string => Boolean(value),
  )

  for (const candidate of candidates) {
    try {
      await execFileAsync(candidate, ['-version'])
      return candidate
    } catch {
      // Try next candidate.
    }
  }

  throw new Error('ffprobe is not available for split preview generation.')
}

async function readManifest(filePath: string) {
  try {
    const value = await readFile(filePath, 'utf8')
    const parsed = JSON.parse(value) as SplitPreviewManifest
    if (parsed?.leftFileName && parsed?.rightFileName) {
      return parsed
    }
  } catch {
    // Ignore malformed or missing manifest.
  }

  return null
}

async function fileExists(filePath: string) {
  try {
    await access(filePath)
    return true
  } catch {
    return false
  }
}

function sanitizeKey(value: string) {
  const trimmed = value.trim()
  return /^[a-f0-9]{40}$/i.test(trimmed) ? trimmed : null
}

function normalizeExtension(extension: string) {
  const normalized = extension.trim().toLowerCase()
  if (normalized === '.mov' || normalized === '.webm' || normalized === '.mkv') {
    return normalized
  }
  return '.mp4'
}

function roundToEven(value: number) {
  const rounded = Math.max(2, Math.round(value))
  return rounded % 2 === 0 ? rounded : rounded - 1
}
