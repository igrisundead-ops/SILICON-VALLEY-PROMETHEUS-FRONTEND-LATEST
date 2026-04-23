type PreviewableMediaKind = 'video' | 'image'

export type SessionSourcePreview = {
  projectId: string
  sourceAssetId: string | null
  fileName: string
  kind: PreviewableMediaKind
  url: string
}

type SourcePreviewSessionWindow = Window & {
  __prometheusSourcePreviewSession__?: Map<string, SessionSourcePreview>
}

function getSourcePreviewSessionStore() {
  if (typeof window === 'undefined') return null

  const sessionWindow = window as SourcePreviewSessionWindow

  if (!sessionWindow.__prometheusSourcePreviewSession__) {
    sessionWindow.__prometheusSourcePreviewSession__ = new Map<string, SessionSourcePreview>()
  }

  return sessionWindow.__prometheusSourcePreviewSession__
}

export function setSessionSourcePreview(params: {
  projectId: string
  file: File
  previewKind: PreviewableMediaKind
  sourceAssetId?: string | null
}) {
  const store = getSourcePreviewSessionStore()
  if (!store) return null

  const previousEntry = store.get(params.projectId)
  const nextUrl = URL.createObjectURL(params.file)

  if (previousEntry?.url && previousEntry.url !== nextUrl) {
    URL.revokeObjectURL(previousEntry.url)
  }

  const nextEntry: SessionSourcePreview = {
    projectId: params.projectId,
    sourceAssetId: params.sourceAssetId ?? null,
    fileName: params.file.name,
    kind: params.previewKind,
    url: nextUrl,
  }

  store.set(params.projectId, nextEntry)
  return nextEntry
}

export function getSessionSourcePreview(projectId: string, sourceAssetId?: string | null) {
  const store = getSourcePreviewSessionStore()
  if (!store) return null

  const sessionPreview = store.get(projectId)
  if (!sessionPreview) return null

  if (sourceAssetId && sessionPreview.sourceAssetId && sessionPreview.sourceAssetId !== sourceAssetId) {
    return null
  }

  return sessionPreview
}

export function clearSessionSourcePreview(projectId: string) {
  const store = getSourcePreviewSessionStore()
  if (!store) return

  const sessionPreview = store.get(projectId)
  if (!sessionPreview) return

  URL.revokeObjectURL(sessionPreview.url)
  store.delete(projectId)
}
