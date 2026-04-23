import { NextResponse } from 'next/server'

import { ensureEndpoint } from '@/app/api/auth/_utils'
import { getXanoToken } from '@/lib/auth/cookies'
import type { Project, ProjectStatus } from '@/lib/types'
import { ENDPOINTS } from '@/lib/xano/config'
import { xanoFetch } from '@/lib/xano/server'

type UnknownRecord = Record<string, unknown>

const VALID_STATUS = new Set<ProjectStatus>(['draft', 'processing', 'ready', 'exported'])

export async function GET() {
  try {
    ensureEndpoint(ENDPOINTS.projectsList, 'projectsList')

    const token = await getXanoToken()
    if (!token) {
      return NextResponse.json({ error: 'Missing authentication token' }, { status: 401 })
    }

    const payload = await xanoFetch<unknown>(ENDPOINTS.projectsList, { method: 'GET' }, token)
    const records = extractRecords(payload)

    const projects = records
      .map((record, index) => normalizeProject(record, index))
      .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))

    return NextResponse.json({ projects })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch projects'
    const lowered = message.toLowerCase()

    if (message.includes('[CONFIG]')) {
      return NextResponse.json({ error: message }, { status: 500 })
    }

    if (lowered.includes('[xano] 401') || lowered.includes('[xano] 403')) {
      return NextResponse.json({ error: 'Authentication expired. Please sign in again.' }, { status: 401 })
    }

    return NextResponse.json({ error: message }, { status: 502 })
  }
}

function extractRecords(payload: unknown): UnknownRecord[] {
  if (Array.isArray(payload)) return payload.filter(isObject)
  if (!isObject(payload)) return []

  const root = payload as UnknownRecord
  const candidates = [root.projects, root.items, root.records, root.result, root.data]

  for (const candidate of candidates) {
    const records = coerceToRecords(candidate)
    if (records.length > 0) return records
  }

  if (looksLikeProjectRecord(root)) return [root]
  return []
}

function coerceToRecords(value: unknown): UnknownRecord[] {
  if (Array.isArray(value)) return value.filter(isObject)
  if (!isObject(value)) return []

  const nested = value as UnknownRecord
  const candidates = [nested.projects, nested.items, nested.records, nested.result, nested.data]

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) return candidate.filter(isObject)
  }

  if (looksLikeProjectRecord(nested)) return [nested]
  return []
}

function normalizeProject(record: UnknownRecord, index: number): Project {
  const now = new Date().toISOString()
  const createdAt = toIsoDate(pickString(record, ['createdAt', 'created_at', 'inserted_at', 'date_created'])) ?? now
  const updatedAt =
    toIsoDate(pickString(record, ['updatedAt', 'updated_at', 'modified_at', 'date_updated', 'last_modified'])) ??
    createdAt

  const thumbnailUrl = pickString(record, [
    'thumbnailUrl',
    'thumbnail_url',
    'thumbnail',
    'preview_url',
    'cover_url',
    'image_url',
  ])

  const previewKind = inferPreviewKind(
    pickString(record, ['previewKind', 'preview_kind', 'media_kind', 'asset_type']),
    thumbnailUrl
  )

  return {
    id:
      pickString(record, ['id', '_id', 'project_id', 'projectId', 'uuid']) ??
      `proj_${Date.now().toString(16)}_${index.toString(16)}`,
    title: pickString(record, ['title', 'name', 'project_name', 'projectName']) ?? `Untitled Project ${index + 1}`,
    status: normalizeStatus(pickString(record, ['status', 'state', 'project_status'])),
    createdAt,
    updatedAt,
    thumbnailUrl: thumbnailUrl ?? '',
    previewKind,
  }
}

function normalizeStatus(value: string | undefined): ProjectStatus {
  if (!value) return 'draft'
  const normalized = value.trim().toLowerCase()
  if (VALID_STATUS.has(normalized as ProjectStatus)) return normalized as ProjectStatus
  if (normalized.includes('process')) return 'processing'
  if (normalized.includes('ready') || normalized.includes('done') || normalized.includes('complete')) return 'ready'
  if (normalized.includes('export')) return 'exported'
  return 'draft'
}

function inferPreviewKind(
  rawKind: string | undefined,
  thumbnailUrl: string | undefined
): Project['previewKind'] | undefined {
  const normalizedKind = rawKind?.trim().toLowerCase()
  if (normalizedKind?.includes('video')) return 'video'
  if (normalizedKind?.includes('image') || normalizedKind?.includes('photo')) return 'image'

  if (!thumbnailUrl) return undefined
  const url = thumbnailUrl.toLowerCase()
  if (url.match(/\.(mp4|mov|webm|mkv|avi|m4v)(\?|$)/)) return 'video'
  if (url.match(/\.(png|jpe?g|webp|gif|bmp|svg|avif)(\?|$)/)) return 'image'
  return undefined
}

function pickString(source: UnknownRecord, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = source[key]
    if (typeof value === 'string' && value.trim()) return value.trim()
    if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  }
  return undefined
}

function toIsoDate(value: string | undefined): string | undefined {
  if (!value) return undefined
  const ts = Date.parse(value)
  if (Number.isNaN(ts)) return undefined
  return new Date(ts).toISOString()
}

function isObject(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function looksLikeProjectRecord(value: UnknownRecord): boolean {
  return (
    typeof value.id === 'string' ||
    typeof value._id === 'string' ||
    typeof value.title === 'string' ||
    typeof value.name === 'string'
  )
}
