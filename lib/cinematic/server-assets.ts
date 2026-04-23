import { execFile } from 'node:child_process'
import { createReadStream } from 'node:fs'
import { access, readFile, readdir, stat } from 'node:fs/promises'
import path from 'node:path'
import { promisify } from 'node:util'

import type {
  CinematicAssetRegistry,
  CinematicBackgroundAsset,
  CinematicTemplateAsset,
  CinematicTemplateTextArtifact,
} from '@/lib/types'

const execFileAsync = promisify(execFile)

const SVG_ANIMATION_ROOT = 'C:\\Users\\HomePC\\Downloads\\HELP, VIDEO MATTING\\SVG animations'
const SVG_MANIFEST_PATH = path.join(SVG_ANIMATION_ROOT, 'assets.json')
const BACKGROUND_VIDEO_ROOT = 'C:\\Users\\HomePC\\Downloads\\HELP, VIDEO MATTING\\BACKGROUND VIDEOS FOR PROMETHEUS OVERLAY'

type RawTemplateManifestAsset = {
  assetId: string
  displayName: string
  filename: string
  type: string
  macro?: string
  keywords?: string[]
  imageSlotNames?: string[]
  imageSlotRoles?: string[]
  textSlotNames?: string[]
  textSlotRoles?: string[]
  textArtifacts?: CinematicTemplateTextArtifact[]
  format?: string
}

type RawTemplateManifest = {
  version?: number
  assets?: RawTemplateManifestAsset[]
}

let registryPromise: Promise<CinematicAssetRegistry> | null = null

export async function readCinematicAssetRegistry(): Promise<CinematicAssetRegistry> {
  registryPromise ??= buildRegistry()
  return registryPromise
}

export async function readTemplateRuntimeHtml(templateId: string) {
  const registry = await readCinematicAssetRegistry()
  const template = registry.templates.find((entry) => entry.id === templateId)
  if (!template) return null

  const templatePath = path.join(SVG_ANIMATION_ROOT, template.filename)
  const html = await readFile(templatePath, 'utf8')
  return {
    template,
    html: rewriteTemplateHtmlAssetUrls(html),
  }
}

export async function resolveBackgroundFile(fileId: string) {
  const registry = await readCinematicAssetRegistry()
  const background = registry.backgrounds.find((entry) => entry.id === fileId)
  if (!background) return null

  const filePath = path.join(BACKGROUND_VIDEO_ROOT, fileId)
  const fileStat = await stat(filePath)
  return {
    filePath,
    fileStat,
    contentType: mimeTypeFromPath(filePath),
  }
}

export async function resolveTemplateSupportFile(assetPath: string) {
  const resolved = resolveSafePath(SVG_ANIMATION_ROOT, assetPath)
  if (!resolved) return null

  await access(resolved)
  const fileStat = await stat(resolved)
  return {
    filePath: resolved,
    fileStat,
    contentType: mimeTypeFromPath(resolved),
  }
}

export function createNodeStream(filePath: string) {
  return createReadStream(filePath)
}

async function buildRegistry(): Promise<CinematicAssetRegistry> {
  const templates = await readTemplateAssets()
  const backgrounds = await readBackgroundAssets()
  const signature = hashString(
    JSON.stringify({
      templateIds: templates.map((entry) => entry.id),
      backgroundIds: backgrounds.map((entry) => entry.id),
    }),
  )

  return {
    signature,
    templates,
    backgrounds,
  }
}

async function readTemplateAssets(): Promise<CinematicTemplateAsset[]> {
  try {
    const raw = JSON.parse(await readFile(SVG_MANIFEST_PATH, 'utf8')) as RawTemplateManifest
    return (raw.assets ?? []).map((asset) => ({
      id: asset.assetId,
      displayName: asset.displayName,
      filename: asset.filename,
      type: asset.type,
      macro: asset.macro,
      keywords: asset.keywords ?? [],
      imageSlotNames: asset.imageSlotNames ?? [],
      imageSlotRoles: asset.imageSlotRoles ?? [],
      textSlotNames: asset.textSlotNames ?? [],
      textSlotRoles: asset.textSlotRoles ?? [],
      textArtifacts: asset.textArtifacts ?? [],
      format: asset.format,
      preferredLayout: inferTemplateLayout(asset.type),
      internalMotionCapable: (asset.format ?? '').toLowerCase().includes('gsap'),
    }))
  } catch {
    return []
  }
}

async function readBackgroundAssets(): Promise<CinematicBackgroundAsset[]> {
  try {
    const entries = await readdir(BACKGROUND_VIDEO_ROOT, { withFileTypes: true })
    const files = entries
      .filter((entry) => entry.isFile() && /\.(mp4|mov|webm)$/i.test(entry.name))
      .map((entry) => entry.name)
      .sort((left, right) => left.localeCompare(right))

    const backgrounds = await Promise.all(
      files.map(async (fileName) => {
        const filePath = path.join(BACKGROUND_VIDEO_ROOT, fileName)
        const dimensions = await probeVideoDimensions(filePath)
        const orientation: CinematicBackgroundAsset['orientation'] =
          dimensions.height >= dimensions.width ? 'portrait' : 'landscape'
        return {
          id: fileName,
          displayName: prettifyBackgroundName(fileName),
          url: `/api/cinematic/file?kind=background&id=${encodeURIComponent(fileName)}`,
          width: dimensions.width,
          height: dimensions.height,
          orientation,
          transform: 'rotateAndCover16x9' as const,
        }
      }),
    )

    return backgrounds
  } catch {
    return []
  }
}

async function probeVideoDimensions(filePath: string) {
  const fallback = { width: 720, height: 1280 }
  const candidates = [
    process.env.FFPROBE_PATH?.trim(),
    'C:\\ffmpeg\\bin\\ffprobe.exe',
    'ffprobe',
  ].filter((value): value is string => Boolean(value))

  for (const command of candidates) {
    try {
      const { stdout } = await execFileAsync(command, [
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

      const parsed = parseDimensions(stdout)
      if (parsed.width > 0 && parsed.height > 0) {
        return parsed
      }
    } catch {
      // Best effort only. The preview can still run with fallback dimensions.
    }
  }

  return fallback
}

function parseDimensions(value: string) {
  const widthMatch = value.match(/width=(\d+)/)
  const heightMatch = value.match(/height=(\d+)/)
  return {
    width: Number(widthMatch?.[1] ?? 0),
    height: Number(heightMatch?.[1] ?? 0),
  }
}

function rewriteTemplateHtmlAssetUrls(html: string) {
  return html.replace(
    /\b(href|src)=["'](assets\/[^"']+)["']/g,
    (_match, attribute: string, assetPath: string) =>
      `${attribute}="/api/cinematic/file?kind=template-asset&path=${encodeURIComponent(assetPath)}"`,
  )
}

function inferTemplateLayout(type: string): 'side-panel' | 'full-frame' {
  const normalized = type.toLowerCase()
  if (
    normalized.includes('poster') ||
    normalized.includes('headline') ||
    normalized.includes('command') ||
    normalized.includes('typographic')
  ) {
    return 'full-frame'
  }

  return 'side-panel'
}

function resolveSafePath(root: string, nextPath: string) {
  const resolved = path.resolve(root, nextPath)
  const normalizedRoot = path.resolve(root)
  if (resolved === normalizedRoot || resolved.startsWith(`${normalizedRoot}${path.sep}`)) {
    return resolved
  }
  return null
}

function prettifyBackgroundName(fileName: string) {
  return fileName.replace(/\.[^.]+$/, '').replace(/[_-]?720w$/i, '').slice(0, 18)
}

function hashString(value: string) {
  let hash = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return `reg_${(hash >>> 0).toString(16)}`
}

function mimeTypeFromPath(filePath: string) {
  const extension = path.extname(filePath).toLowerCase()
  if (extension === '.mp4') return 'video/mp4'
  if (extension === '.mov') return 'video/quicktime'
  if (extension === '.webm') return 'video/webm'
  if (extension === '.png') return 'image/png'
  if (extension === '.jpg' || extension === '.jpeg' || extension === '.jfif') return 'image/jpeg'
  if (extension === '.svg') return 'image/svg+xml'
  return 'application/octet-stream'
}
