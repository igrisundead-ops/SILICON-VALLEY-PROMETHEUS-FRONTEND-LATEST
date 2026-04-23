import type { EditorialRevisionRequest, QueuedPreviewRevisionState } from './types'

function sleep(ms: number) {
  return new Promise((resolve) => globalThis.setTimeout(resolve, ms))
}

export async function queuePreviewRevisionRequest(
  request: EditorialRevisionRequest,
): Promise<QueuedPreviewRevisionState> {
  if (process.env.NODE_ENV === 'development') {
    console.info('[editorial-revision] queued-preview-request', request)
  }

  await sleep(220)

  return {
    requestId: `preview-revision-${Date.now()}`,
    request,
    queuedAt: new Date().toISOString(),
    etaMs: request.frameTarget ? 1800 + Math.min(2200, request.frameTarget.endFrame - request.frameTarget.startFrame + 1) * 12 : 1800,
    status: 'queued',
  }
}
