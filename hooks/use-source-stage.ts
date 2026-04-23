'use client'

import * as React from 'react'

import { detectSourceFileKind, inspectSourceFile } from '@/lib/media/source-profile'
import { persistSourceAsset } from '@/lib/source-asset-store'
import type { MediaKind, SourceProfile, SourceStagePhase } from '@/lib/types'

type PreviewableMediaKind = 'video' | 'image'

type PersistedSourceStage = {
  assetId: string
  file: File
  previewKind: PreviewableMediaKind | null
  sourceProfile: SourceProfile | null
}

interface StageSourceOptions {
  allowedMediaKinds?: MediaKind[]
  sourceProfile?: SourceProfile | null
  onPersisted?: (result: PersistedSourceStage) => void | Promise<void>
}

interface UseSourceStageOptions {
  currentPreviewUrl?: string | null
  currentPreviewKind?: PreviewableMediaKind | null
}

function debugSourceStage(event: string, detail?: Record<string, unknown>) {
  if (process.env.NODE_ENV !== 'development') return

  console.debug('[source-stage]', event, detail ?? {})
}

function isPreviewableMediaKind(kind: MediaKind): kind is PreviewableMediaKind {
  return kind === 'video' || kind === 'image'
}

function isInspectableMediaKind(kind: MediaKind) {
  return kind === 'video' || kind === 'image' || kind === 'audio'
}

function readFileKindLabel(kind: MediaKind) {
  if (kind === 'video') return 'video'
  if (kind === 'image') return 'image'
  if (kind === 'audio') return 'audio file'
  return 'file'
}

function waitForPreviewReady(url: string | null, previewKind: PreviewableMediaKind | null) {
  if (typeof window === 'undefined' || !url || !previewKind) {
    return Promise.resolve()
  }

  return new Promise<void>((resolve, reject) => {
    if (previewKind === 'image') {
      const image = new window.Image()

      const cleanup = () => {
        image.onload = null
        image.onerror = null
      }

      image.onload = () => {
        cleanup()
        resolve()
      }

      image.onerror = () => {
        cleanup()
        reject(new Error('Unable to draw the staged preview image'))
      }

      image.src = url
      return
    }

    const video = window.document.createElement('video')
    video.preload = 'auto'
    video.muted = true
    video.playsInline = true

    const cleanup = () => {
      video.onloadeddata = null
      video.oncanplay = null
      video.onerror = null
      video.removeAttribute('src')
      video.load()
    }

    const resolveReady = () => {
      cleanup()
      resolve()
    }

    video.onloadeddata = resolveReady
    video.oncanplay = resolveReady
    video.onerror = () => {
      cleanup()
      reject(new Error('Unable to draw the staged preview video'))
    }

    video.src = url

    if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
      resolveReady()
    }
  })
}

export function useSourceStage({ currentPreviewUrl = null, currentPreviewKind = null }: UseSourceStageOptions) {
  const [visiblePreviewUrl, setVisiblePreviewUrl] = React.useState<string | null>(currentPreviewUrl)
  const [previewKind, setPreviewKind] = React.useState<PreviewableMediaKind | null>(currentPreviewKind)
  const [candidatePreviewUrl, setCandidatePreviewUrl] = React.useState<string | null>(null)
  const [phase, setPhase] = React.useState<SourceStagePhase>(currentPreviewUrl ? 'ready' : 'empty')
  const [error, setError] = React.useState<string | null>(null)
  const [sourceFile, setSourceFile] = React.useState<File | null>(null)
  const [sourceAssetId, setSourceAssetId] = React.useState<string | null>(null)
  const [sourceProfile, setSourceProfile] = React.useState<SourceProfile | null>(null)
  const isMountedRef = React.useRef(true)

  const visiblePreviewUrlRef = React.useRef<string | null>(currentPreviewUrl)
  const ownedVisiblePreviewUrlRef = React.useRef<string | null>(null)
  const ownedCandidatePreviewUrlRef = React.useRef<string | null>(null)
  const latestSettledResultRef = React.useRef<PersistedSourceStage | null>(null)
  const inFlightStagePromiseRef = React.useRef<Promise<PersistedSourceStage | null> | null>(null)
  const currentStageRunRef = React.useRef(0)
  const hasPendingStageRef = React.useRef(false)

  const replaceVisiblePreview = React.useCallback(
    (nextUrl: string | null, nextKind: PreviewableMediaKind | null, options?: { owned?: boolean }) => {
      const currentOwnedVisible = ownedVisiblePreviewUrlRef.current
      if (currentOwnedVisible && currentOwnedVisible !== nextUrl) {
        URL.revokeObjectURL(currentOwnedVisible)
      }

      ownedVisiblePreviewUrlRef.current = options?.owned ? nextUrl : null
      visiblePreviewUrlRef.current = nextUrl
      debugSourceStage('replace-visible-preview', {
        nextKind,
        nextUrl,
        owned: options?.owned ?? false,
      })
      setVisiblePreviewUrl(nextUrl)
      setPreviewKind(nextKind)
    },
    [],
  )

  const clearCandidatePreview = React.useCallback((preserveVisibleMatch = false) => {
    const candidateUrl = ownedCandidatePreviewUrlRef.current
    if (candidateUrl && (!preserveVisibleMatch || candidateUrl !== visiblePreviewUrlRef.current)) {
      URL.revokeObjectURL(candidateUrl)
    }

    ownedCandidatePreviewUrlRef.current = null
    setCandidatePreviewUrl(null)
  }, [])

  React.useEffect(() => {
    if (hasPendingStageRef.current) {
      if (!visiblePreviewUrlRef.current && currentPreviewUrl) {
        replaceVisiblePreview(currentPreviewUrl, currentPreviewKind ?? null, { owned: false })
      }
      return
    }

    if (currentPreviewUrl) {
      const shouldKeepOwnedVisiblePreview =
        Boolean(ownedVisiblePreviewUrlRef.current) &&
        Boolean(visiblePreviewUrlRef.current) &&
        visiblePreviewUrlRef.current !== currentPreviewUrl

      if (!shouldKeepOwnedVisiblePreview && (visiblePreviewUrlRef.current !== currentPreviewUrl || ownedVisiblePreviewUrlRef.current)) {
        replaceVisiblePreview(currentPreviewUrl, currentPreviewKind ?? null, { owned: false })
      }
      if (phase === 'empty' || phase === 'failed') {
        debugSourceStage('phase-ready-from-current-preview', {
          currentPreviewKind,
          currentPreviewUrl,
        })
        setPhase('ready')
      }
      return
    }

    if (ownedVisiblePreviewUrlRef.current) return

    if (visiblePreviewUrlRef.current) {
      replaceVisiblePreview(null, null, { owned: false })
    }
    if (phase !== 'failed') {
      debugSourceStage('phase-empty', {})
      setPhase('empty')
    }
  }, [currentPreviewKind, currentPreviewUrl, phase, replaceVisiblePreview])

  React.useEffect(() => {
    return () => {
      isMountedRef.current = false
      if (ownedCandidatePreviewUrlRef.current) {
        URL.revokeObjectURL(ownedCandidatePreviewUrlRef.current)
        ownedCandidatePreviewUrlRef.current = null
      }

      if (ownedVisiblePreviewUrlRef.current) {
        URL.revokeObjectURL(ownedVisiblePreviewUrlRef.current)
        ownedVisiblePreviewUrlRef.current = null
      }
    }
  }, [])

  const awaitSettledSource = React.useCallback(async () => {
    if (inFlightStagePromiseRef.current) {
      return (await inFlightStagePromiseRef.current) ?? latestSettledResultRef.current
    }

    return latestSettledResultRef.current
  }, [])

  const clearPendingStage = React.useCallback(() => {
    currentStageRunRef.current += 1
    hasPendingStageRef.current = false
    inFlightStagePromiseRef.current = null
    clearCandidatePreview(false)
    setError(null)

    if (currentPreviewUrl) {
      replaceVisiblePreview(currentPreviewUrl, currentPreviewKind ?? null, { owned: false })
      setPhase('ready')
      return
    }

    if (!ownedVisiblePreviewUrlRef.current) {
      replaceVisiblePreview(null, null, { owned: false })
      setPhase('empty')
    }
  }, [clearCandidatePreview, currentPreviewKind, currentPreviewUrl, replaceVisiblePreview])

  const resetStage = React.useCallback(() => {
    clearPendingStage()
    latestSettledResultRef.current = null
    setSourceFile(null)
    setSourceAssetId(null)
    setSourceProfile(null)

    if (!currentPreviewUrl) {
      replaceVisiblePreview(null, null, { owned: false })
      setPhase('empty')
    }
  }, [clearPendingStage, currentPreviewUrl, replaceVisiblePreview])

  const stageSource = React.useCallback(
    async (file: File, options?: StageSourceOptions) => {
      const allowedMediaKinds = options?.allowedMediaKinds ?? null
      const detectedKind = detectSourceFileKind(file)

      if (allowedMediaKinds && !allowedMediaKinds.includes(detectedKind)) {
        clearCandidatePreview(false)
        setSourceFile(file)
        setSourceAssetId(null)
        setError(`Please choose a ${readFileKindLabel(allowedMediaKinds[0] ?? 'video')}.`)
        setPhase('failed')
        return null
      }

      const runId = currentStageRunRef.current + 1
      currentStageRunRef.current = runId
      hasPendingStageRef.current = true
      latestSettledResultRef.current = null

      const nextPreviewKind = isPreviewableMediaKind(detectedKind) ? detectedKind : null
      const previousVisiblePreviewUrl = visiblePreviewUrlRef.current
      const previousVisiblePreviewKind = previewKind
      const hadVisiblePreview = Boolean(previousVisiblePreviewUrl)
      const candidateUrl = nextPreviewKind ? URL.createObjectURL(file) : null

      clearCandidatePreview(false)
      ownedCandidatePreviewUrlRef.current = hadVisiblePreview ? candidateUrl : null
      setCandidatePreviewUrl(hadVisiblePreview ? candidateUrl : null)
      setSourceFile(file)
      setSourceAssetId(null)
      setSourceProfile(options?.sourceProfile ?? null)
      setError(null)
      debugSourceStage('stage-source-start', {
        detectedKind,
        hadVisiblePreview,
        candidateUrl,
        currentPreviewUrl,
      })

      if (!hadVisiblePreview && candidateUrl) {
        replaceVisiblePreview(candidateUrl, nextPreviewKind, { owned: true })
        debugSourceStage('phase-persisting-with-local-preview', {
          candidateUrl,
          nextPreviewKind,
        })
        setPhase('persisting')
      } else if (hadVisiblePreview && candidateUrl) {
        debugSourceStage('phase-staging-local-preview', {
          candidateUrl,
          nextPreviewKind,
        })
        setPhase('staging_local_preview')
      } else {
        debugSourceStage('phase-persisting-without-preview', {
          detectedKind,
        })
        setPhase('persisting')
      }

      const persistPromise = persistSourceAsset(file)
      const inspectionPromise =
        options?.sourceProfile !== undefined
          ? Promise.resolve(options.sourceProfile ?? null)
          : isInspectableMediaKind(detectedKind)
            ? inspectSourceFile(file).catch(() => null)
            : Promise.resolve<SourceProfile | null>(null)
      const previewReadyPromise = waitForPreviewReady(candidateUrl, nextPreviewKind)
        .then(() => null)
        .catch((previewError) =>
          previewError instanceof Error ? previewError.message : 'Unable to draw the staged preview video',
        )

      const runPromise = (async () => {
        let promotedCandidatePreview = false

        try {
          let previewReadyError: string | null = null

          if (hadVisiblePreview && candidateUrl) {
            previewReadyError = await previewReadyPromise

            if (currentStageRunRef.current !== runId) {
              return null
            }

            if (!previewReadyError) {
              if (isMountedRef.current) {
                replaceVisiblePreview(candidateUrl, nextPreviewKind, { owned: true })
                promotedCandidatePreview = true
                debugSourceStage('promote-local-preview', {
                  candidateUrl,
                  nextPreviewKind,
                  runId,
                })
                setPhase('persisting')
                clearCandidatePreview(true)
              }
            } else if (isMountedRef.current) {
              debugSourceStage('local-preview-ready-failed', {
                candidateUrl,
                nextPreviewKind,
                previewReadyError,
                runId,
              })
              clearCandidatePreview(false)
            }
          } else {
            previewReadyError = await previewReadyPromise

            if (currentStageRunRef.current !== runId) {
              return null
            }
          }

          const [assetId, nextSourceProfile] = await Promise.all([persistPromise, inspectionPromise])

          if (currentStageRunRef.current !== runId) {
            return null
          }

          const result: PersistedSourceStage = {
            assetId,
            file,
            previewKind: nextPreviewKind,
            sourceProfile: nextSourceProfile,
          }

          latestSettledResultRef.current = result
          if (isMountedRef.current) {
            setSourceAssetId(assetId)
            setSourceProfile(nextSourceProfile)
          }
          debugSourceStage('persisted-source-asset', {
            assetId,
            nextPreviewKind,
            previewReadyError,
            runId,
          })

          if (options?.onPersisted) {
            await options.onPersisted(result)
          }

          if (currentStageRunRef.current !== runId) {
            return null
          }

          if (isMountedRef.current) {
            clearCandidatePreview(true)
          }
          hasPendingStageRef.current = false
          inFlightStagePromiseRef.current = null
          if (isMountedRef.current) {
            setError(previewReadyError)
            debugSourceStage('phase-ready', {
              assetId,
              nextPreviewKind,
              previewReadyError,
              runId,
            })
            setPhase('ready')
          }

          return result
        } catch (stageError) {
          if (currentStageRunRef.current !== runId) {
            return null
          }

          hasPendingStageRef.current = false
          inFlightStagePromiseRef.current = null
          if (isMountedRef.current) {
            clearCandidatePreview(false)
          }

          if (promotedCandidatePreview && isMountedRef.current) {
            replaceVisiblePreview(previousVisiblePreviewUrl ?? currentPreviewUrl, previousVisiblePreviewKind ?? currentPreviewKind ?? null, { owned: false })
          }

          if (!hadVisiblePreview) {
            if (isMountedRef.current && currentPreviewUrl) {
              replaceVisiblePreview(currentPreviewUrl, currentPreviewKind ?? null, { owned: false })
            } else if (isMountedRef.current) {
              replaceVisiblePreview(null, null, { owned: false })
            }
          }

          const nextError =
            stageError instanceof Error ? stageError.message : 'Unable to stage that source right now.'
          if (isMountedRef.current) {
            setError(nextError)
            setPhase('failed')
          }
          return null
        }
      })()

      inFlightStagePromiseRef.current = runPromise
      return await runPromise
    },
    [clearCandidatePreview, currentPreviewKind, currentPreviewUrl, previewKind, replaceVisiblePreview],
  )

  return {
    visiblePreviewUrl,
    candidatePreviewUrl,
    previewKind,
    phase,
    error,
    sourceFile,
    sourceAssetId,
    sourceProfile,
    stageSource,
    awaitSettledSource,
    clearPendingStage,
    resetStage,
  }
}
