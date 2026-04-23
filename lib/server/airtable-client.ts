import 'server-only'

export type AirtableAttachment = {
  id?: string
  url?: string
  filename?: string
  type?: string
  thumbnails?: Record<string, { url?: string; width?: number; height?: number }>
}

type AirtableRecord = {
  id: string
  createdTime?: string
  fields: Record<string, unknown>
}

type AirtableListResponse = {
  records: AirtableRecord[]
  offset?: string
}

export type NormalizedAirtableImageItem = {
  id: string
  name: string | null
  styleKey: string | null
  imageUrl: string | null
  thumbUrl: string | null
  hasAttachment: boolean
  tags: string[]
  updatedTime: string
}

export type NormalizedAirtableImageResponse = {
  source: 'airtable'
  baseId: string
  table: string
  count: number
  items: NormalizedAirtableImageItem[]
}

type FetchRecordsArgs = {
  token: string
  baseId: string
  table: string
  view?: string | null
  limit?: number
}

const CACHE_TTL_MS = 45_000
const cache = new Map<string, { expiresAt: number; value: NormalizedAirtableImageResponse }>()

function pickField(fields: Record<string, unknown>, candidates: string[]) {
  for (const key of candidates) {
    if (key in fields) return fields[key]
  }
  return undefined
}

function asString(value: unknown): string | null {
  if (typeof value === 'string') return value
  if (typeof value === 'number') return String(value)
  return null
}

function asStringArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(asString).filter((v): v is string => !!v)
  if (typeof value === 'string') {
    return value
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
  }
  return []
}

function asAttachmentArray(value: unknown): AirtableAttachment[] {
  if (!Array.isArray(value)) return []
  return value.filter((x): x is AirtableAttachment => !!x && typeof x === 'object')
}

function pickThumbUrl(att: AirtableAttachment): string | null {
  const thumbs = att.thumbnails ?? {}
  const preferredKeys = ['small', 'large', 'full']
  for (const k of preferredKeys) {
    const url = thumbs?.[k]?.url
    if (typeof url === 'string' && url.length > 0) return url
  }
  return typeof att.url === 'string' ? att.url : null
}

function normalizeRecord(record: AirtableRecord): NormalizedAirtableImageItem {
  const fields = record.fields ?? {}

  const name =
    asString(pickField(fields, ['Name', 'name', 'Title', 'title'])) ?? null

  const styleKey =
    asString(
      pickField(fields, [
        'styleKey',
        'Style Key',
        'Style',
        'StyleKey',
        'style',
        'style_key',
      ])
    ) ?? null

  const tags = asStringArray(pickField(fields, ['Tags', 'tags', 'Tag', 'tag']))

  const attachments = asAttachmentArray(
    pickField(fields, [
      'Image',
      'image',
      'Images',
      'images',
      'Photo',
      'photo',
      'Photos',
      'photos',
      'Thumbnail',
      'thumbnail',
      'Thumb',
      'thumb',
      'Attachment',
      'Attachments',
      'File',
      'Files',
      'Asset',
      'Assets',
      'Preview',
      'Previews',
      'Preview Image',
      'previewImage',
    ])
  )

  const first = attachments[0]
  const imageUrlFromAttachment = typeof first?.url === 'string' ? first.url : null
  const thumbUrlFromAttachment = first ? pickThumbUrl(first) : null

  const imageUrlFromField =
    asString(pickField(fields, ['imageUrl', 'Image URL', 'url', 'URL'])) ?? null
  const thumbUrlFromField =
    asString(pickField(fields, ['thumbUrl', 'Thumb URL', 'thumbnailUrl', 'Thumbnail URL'])) ?? null

  const hasAttachment = attachments.length > 0
  const imageUrl = imageUrlFromAttachment ?? imageUrlFromField
  const thumbUrl = thumbUrlFromAttachment ?? thumbUrlFromField

  const updatedTime =
    asString(
      pickField(fields, [
        'updatedTime',
        'Updated Time',
        'Updated',
        'Last Modified',
        'Last modified',
        'LastModified',
        'lastModified',
      ])
    ) ??
    record.createdTime ??
    new Date().toISOString()

  return {
    id: record.id,
    name,
    styleKey,
    imageUrl,
    thumbUrl,
    hasAttachment,
    tags,
    updatedTime,
  }
}

async function airtableFetch(url: string, token: string): Promise<Response> {
  return fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
    cache: 'no-store',
  })
}

export async function fetchImageArchiveRecords({
  token,
  baseId,
  table,
  view,
  limit = 50,
}: FetchRecordsArgs): Promise<NormalizedAirtableImageResponse> {
  const safeLimit = Math.max(1, Math.min(500, Number.isFinite(limit) ? limit : 50))
  const cacheKey = JSON.stringify({ baseId, table, view: view ?? null, limit: safeLimit })

  const cached = cache.get(cacheKey)
  if (cached && cached.expiresAt > Date.now()) return cached.value

  const items: NormalizedAirtableImageItem[] = []
  let offset: string | undefined

  while (items.length < safeLimit) {
    const pageSize = Math.min(100, safeLimit - items.length)
    const params = new URLSearchParams()
    params.set('pageSize', String(pageSize))
    if (view) params.set('view', view)
    if (offset) params.set('offset', offset)

    const encodedTable = encodeURIComponent(table)
    const url = `https://api.airtable.com/v0/${baseId}/${encodedTable}?${params.toString()}`

    const res = await airtableFetch(url, token)
    if (!res.ok) {
      let detail: string | undefined
      try {
        const body = (await res.json()) as { error?: { message?: string } }
        detail = body?.error?.message
      } catch {
        // ignore
      }
      const message = detail ? `Airtable error: ${detail}` : `Airtable error: HTTP ${res.status}`
      throw Object.assign(new Error(message), { status: res.status })
    }

    const data = (await res.json()) as AirtableListResponse
    for (const record of data.records ?? []) items.push(normalizeRecord(record))
    offset = data.offset
    if (!offset) break
  }

  const value: NormalizedAirtableImageResponse = {
    source: 'airtable',
    baseId,
    table,
    count: items.length,
    items,
  }

  cache.set(cacheKey, { expiresAt: Date.now() + CACHE_TTL_MS, value })
  return value
}
