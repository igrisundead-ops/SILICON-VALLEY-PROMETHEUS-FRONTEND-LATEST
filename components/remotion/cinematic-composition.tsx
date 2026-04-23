'use client'

import * as React from 'react'
import {
  AbsoluteFill,
  Html5Video,
  Img,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion'
import { BarChart3, Sparkles, UserRound } from 'lucide-react'

import { CinematicTemplateHost } from '@/components/editor/cinematic-template-host'
import type {
  AnimationPlan,
  BackgroundCue,
  CounterCue,
  ExplainerCue,
  SpeechCue,
  TransitionCue,
} from '@/lib/types'

const CAPTION_ENTER_FRAMES = 8
const CAPTION_EXIT_FRAMES = 6

export type CinematicRemotionCompositionProps = {
  animationPlan: AnimationPlan | null
  previewUrl: string | null
  previewKind: 'video' | 'image'
  projectTitle: string
  fitMode: 'fill' | 'fit'
  offsetX: number
  offsetY: number
  scale: number
  showSafeZones: boolean
}

export function CinematicRemotionComposition({
  animationPlan,
  previewUrl,
  previewKind,
  projectTitle,
  fitMode,
  offsetX,
  offsetY,
  scale,
  showSafeZones,
}: CinematicRemotionCompositionProps) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const currentMs = (frame / fps) * 1000

  const activeSpeechCues = React.useMemo(
    () => (animationPlan ? animationPlan.speechCues.filter((cue) => isCueActive(cue.startMs, cue.endMs, currentMs, 220)) : []),
    [animationPlan, currentMs],
  )
  const activeTransitions = React.useMemo(
    () => (animationPlan ? animationPlan.transitionCues.filter((cue) => isCueActive(cue.startMs, cue.endMs, currentMs, 160)) : []),
    [animationPlan, currentMs],
  )
  const activeExplainers = React.useMemo(
    () => (animationPlan ? animationPlan.explainerCues.filter((cue) => isCueActive(cue.startMs, cue.endMs, currentMs, 160)) : []),
    [animationPlan, currentMs],
  )
  const activeBackgrounds = React.useMemo(
    () => (animationPlan ? animationPlan.backgroundCues.filter((cue) => isCueActive(cue.startMs, cue.endMs, currentMs, 160)) : []),
    [animationPlan, currentMs],
  )
  const activeCounters = React.useMemo(
    () => (animationPlan ? animationPlan.counterCues.filter((cue) => isCueActive(cue.startMs, cue.endMs, currentMs, 100)) : []),
    [animationPlan, currentMs],
  )

  const activeHeading = pickLatest(activeSpeechCues.filter((cue) => cue.variant === 'heading'))
  const activeCaption = pickLatest(activeSpeechCues.filter((cue) => cue.variant === 'caption'))
  const activeLine = pickLatest(activeTransitions.filter((cue) => cue.type === 'line' || cue.type === 'section-divider'))
  const activeSidePan = pickLatest(activeTransitions.filter((cue) => cue.type === 'side-pan'))
  const activeExplainer = pickLatest(activeExplainers)
  const activeBackgroundVideo = pickLatest(activeBackgrounds.filter((cue) => cue.kind === 'video'))
  const activeBackgroundImage = pickLatest(activeBackgrounds.filter((cue) => cue.kind === 'image'))
  const activeCounter = pickLatest(activeCounters)

  const explainerSideProgress = activeExplainer?.layout === 'side-panel' ? cueVisibility(frame, fps, activeExplainer.startMs, activeExplainer.endMs) : 0
  const sidePanProgress = activeSidePan ? cueVisibility(frame, fps, activeSidePan.startMs, activeSidePan.endMs) : explainerSideProgress
  const fullscreenProgress =
    activeExplainer?.layout === 'full-frame' ? cueVisibility(frame, fps, activeExplainer.startMs, activeExplainer.endMs) : 0

  const mediaShiftPct = interpolate(sidePanProgress, [0, 1], [0, 18])
  const mediaScale = scale / 100 * interpolate(sidePanProgress, [0, 1], [1, 0.82]) * interpolate(fullscreenProgress, [0, 1], [1, 0.94])
  const mediaBrightness = interpolate(sidePanProgress, [0, 1], [1, 0.74]) * interpolate(fullscreenProgress, [0, 1], [1, 0.46])
  const mediaSaturate = interpolate(sidePanProgress + fullscreenProgress, [0, 1], [1, 0.88])

  return (
    <AbsoluteFill style={{ backgroundColor: '#020202', color: 'white', overflow: 'hidden', fontFamily: '"Helvetica Neue", Arial, sans-serif' }}>
      <AbsoluteFill
        style={{
          transform: `translate(${offsetX}px, ${offsetY}px) translateX(${mediaShiftPct}%) scale(${mediaScale})`,
          transformOrigin: 'center center',
          filter: `brightness(${mediaBrightness}) saturate(${mediaSaturate})`,
        }}
      >
        {previewUrl ? (
          previewKind === 'image' ? (
            <Img
              src={previewUrl}
              alt={projectTitle}
              style={{ width: '100%', height: '100%', objectFit: fitMode === 'fill' ? 'cover' : 'contain' }}
            />
          ) : (
            <Html5Video
              src={previewUrl}
              style={{ width: '100%', height: '100%', objectFit: fitMode === 'fill' ? 'cover' : 'contain' }}
            />
          )
        ) : (
          <AbsoluteFill
            style={{
              background:
                'radial-gradient(circle at top, rgba(255,255,255,0.14) 0%, rgba(255,255,255,0) 38%), linear-gradient(180deg, #121218 0%, #050507 100%)',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <div
              style={{
                padding: '22px 28px',
                borderRadius: 24,
                border: '1px solid rgba(255,255,255,0.1)',
                background: 'rgba(255,255,255,0.04)',
                letterSpacing: '0.2em',
                textTransform: 'uppercase',
                fontSize: 22,
                color: 'rgba(255,255,255,0.56)',
              }}
            >
              Waiting for source media
            </div>
          </AbsoluteFill>
        )}
      </AbsoluteFill>

      {activeBackgroundVideo ? <RemotionBackgroundVideo cue={activeBackgroundVideo} frame={frame} fps={fps} /> : null}
      {activeBackgroundImage ? <RemotionBackgroundImage cue={activeBackgroundImage} frame={frame} fps={fps} /> : null}
      {activeLine ? <RemotionTransitionLine cue={activeLine} frame={frame} fps={fps} /> : null}
      {activeCounter ? <RemotionCounter cue={activeCounter} frame={frame} fps={fps} /> : null}

      {activeExplainer ? (
        <RemotionExplainer cue={activeExplainer} frame={frame} fps={fps} />
      ) : null}

      {activeHeading ? (
        <div
          style={{
            position: 'absolute',
            left: '6%',
            top: '11%',
            zIndex: 30,
            maxWidth: '54%',
            opacity: cueVisibility(frame, fps, activeHeading.startMs, activeHeading.endMs),
            transform: `translateY(${interpolate(cueVisibility(frame, fps, activeHeading.startMs, activeHeading.endMs), [0, 1], [24, 0])}px)`,
          }}
        >
          <RemotionSpeechPanel cue={activeHeading} heading />
        </div>
      ) : null}

      {activeCaption ? (
        <div
          style={{
            position: 'absolute',
            insetInline: '6%',
            bottom: '13%',
            zIndex: 30,
            display: 'flex',
            justifyContent: 'center',
            opacity: cueVisibility(frame, fps, activeCaption.startMs, activeCaption.endMs),
            transform: `translateY(${interpolate(cueVisibility(frame, fps, activeCaption.startMs, activeCaption.endMs), [0, 1], [22, 0])}px) scale(${interpolate(cueVisibility(frame, fps, activeCaption.startMs, activeCaption.endMs), [0, 1], [0.96, 1])})`,
          }}
        >
          <RemotionSpeechPanel cue={activeCaption} />
        </div>
      ) : null}

      {showSafeZones ? <RemotionSafeZones /> : null}
    </AbsoluteFill>
  )
}

function RemotionBackgroundVideo({
  cue,
  frame,
  fps,
}: {
  cue: BackgroundCue
  frame: number
  fps: number
}) {
  const visibility = cueVisibility(frame, fps, cue.startMs, cue.endMs)
  const rotateScale = cue.transform === 'rotateAndCover16x9' ? 1.78 : 1

  return (
    <AbsoluteFill
      style={{
        opacity: cue.opacity * visibility,
        mixBlendMode: cue.blendMode ?? 'normal',
        pointerEvents: 'none',
      }}
    >
      <AbsoluteFill
        style={{
          background:
            'radial-gradient(circle at top, rgba(255,255,255,0.12) 0%, rgba(255,255,255,0) 56%), linear-gradient(180deg, rgba(0,0,0,0.18) 0%, rgba(0,0,0,0.58) 100%)',
        }}
      />
      <Html5Video
        src={cue.sourceUrl}
        muted
        loop
        volume={0}
        style={{
          position: 'absolute',
          left: '50%',
          top: '50%',
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          transform: `translate(-50%, -50%) rotate(90deg) scale(${rotateScale})`,
          transformOrigin: 'center center',
        }}
      />
    </AbsoluteFill>
  )
}

function RemotionBackgroundImage({
  cue,
  frame,
  fps,
}: {
  cue: BackgroundCue
  frame: number
  fps: number
}) {
  const visibility = cueVisibility(frame, fps, cue.startMs, cue.endMs)
  const placementStyle =
    cue.placement === 'right-stage'
      ? { right: '3%', top: '14%', width: '34%', height: '60%' }
      : cue.placement === 'left-stage'
        ? { left: '3%', top: '14%', width: '34%', height: '60%' }
        : { inset: '10%' }

  return (
    <div
      style={{
        position: 'absolute',
        zIndex: 20,
        overflow: 'hidden',
        borderRadius: 26,
        opacity: cue.opacity * visibility,
        mixBlendMode: cue.blendMode ?? 'screen',
        transform: `translateY(${interpolate(visibility, [0, 1], [28, 0])}px) scale(${interpolate(visibility, [0, 1], [0.94, 1])})`,
        ...placementStyle,
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          zIndex: 1,
          background:
            'radial-gradient(circle at top, rgba(255,255,255,0.18) 0%, rgba(255,255,255,0) 44%), linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(0,0,0,0.52) 100%)',
        }}
      />
      <Img src={cue.sourceUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
    </div>
  )
}

function RemotionTransitionLine({
  cue,
  frame,
  fps,
}: {
  cue: TransitionCue
  frame: number
  fps: number
}) {
  const progress = cueTimelineProgress(frame, fps, cue.startMs, cue.endMs)
  const expansion = progress <= 0.5 ? progress * 2 : (1 - progress) * 2

  return (
    <div
      style={{
        position: 'absolute',
        left: '50%',
        top: '20%',
        zIndex: 30,
        height: 2,
        width: '46%',
        transform: 'translateX(-50%)',
      }}
    >
      <div
        style={{
          width: '100%',
          height: '100%',
          borderRadius: 999,
          opacity: Math.max(0.18, expansion),
          transform: `scaleX(${Math.max(0.08, expansion)})`,
          transformOrigin: 'center center',
          background:
            'linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.92) 22%, rgba(183,255,102,0.9) 50%, rgba(255,255,255,0.92) 78%, rgba(255,255,255,0) 100%)',
          boxShadow: '0 0 24px rgba(177,255,96,0.4)',
        }}
      />
    </div>
  )
}

function RemotionCounter({
  cue,
  frame,
  fps,
}: {
  cue: CounterCue
  frame: number
  fps: number
}) {
  const visibility = cueVisibility(frame, fps, cue.startMs, cue.endMs)
  const progress = cueTimelineProgress(frame, fps, cue.startMs, cue.endMs)
  const value = Math.round(cue.from + (cue.to - cue.from) * progress)
  const formatted = formatCounterValue(cue, value)
  const Icon = cue.icon === 'user' ? UserRound : cue.icon === 'chart' ? BarChart3 : Sparkles

  return (
    <div
      style={{
        position: 'absolute',
        left: '50%',
        top: '12%',
        zIndex: 30,
        transform: `translateX(-50%) translateY(${interpolate(visibility, [0, 1], [18, 0])}px) scale(${interpolate(visibility, [0, 1], [0.94, 1])})`,
        opacity: visibility,
      }}
    >
      <div
        style={{
          borderRadius: 24,
          border: '1px solid rgba(255,255,255,0.1)',
          background: 'linear-gradient(180deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.02) 100%)',
          padding: '16px 24px',
          textAlign: 'center',
          boxShadow: '0 24px 60px -30px rgba(0,0,0,0.95)',
          backdropFilter: 'blur(20px)',
        }}
      >
        <div
          style={{
            marginInline: 'auto',
            marginBottom: 8,
            display: 'grid',
            placeItems: 'center',
            width: 40,
            height: 40,
            borderRadius: '999px',
            background: 'white',
            color: 'black',
            boxShadow: '0 12px 24px -18px rgba(255,255,255,0.95)',
          }}
        >
          <Icon size={20} />
        </div>
        <div
          style={{
            fontSize: 56,
            fontWeight: 900,
            letterSpacing: '-0.05em',
            background: 'linear-gradient(90deg, #93ff6f 0%, #11d84e 100%)',
            color: 'transparent',
            backgroundClip: 'text',
            WebkitBackgroundClip: 'text',
            filter: 'drop-shadow(0 0 18px rgba(66,255,120,0.4))',
          }}
        >
          {formatted}
        </div>
        <div
          style={{
            marginTop: 4,
            fontSize: 10,
            textTransform: 'uppercase',
            letterSpacing: '0.26em',
            color: 'rgba(255,255,255,0.55)',
          }}
        >
          {cue.label}
        </div>
      </div>
    </div>
  )
}

function RemotionExplainer({
  cue,
  frame,
  fps,
}: {
  cue: ExplainerCue
  frame: number
  fps: number
}) {
  const visibility = cueVisibility(frame, fps, cue.startMs, cue.endMs)
  const sidePanel = cue.layout === 'side-panel'
  const translateX = sidePanel ? interpolate(visibility, [0, 1], [-34, 0]) : 0
  const translateY = sidePanel ? 0 : interpolate(visibility, [0, 1], [20, 0])

  return (
    <div
      style={{
        position: 'absolute',
        zIndex: 20,
        opacity: visibility,
        transform: `translate(${translateX}px, ${translateY}px) scale(${interpolate(visibility, [0, 1], [0.96, 1])})`,
        left: sidePanel ? '4%' : '50%',
        top: sidePanel ? '7%' : '50%',
        width: sidePanel ? '42%' : '74%',
        height: sidePanel ? '86%' : '76%',
        ...(sidePanel ? {} : { marginLeft: '-37%', marginTop: '-19%' }),
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: 26,
          background: 'radial-gradient(circle at top, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0) 62%)',
        }}
      />
      <CinematicTemplateHost cue={cue} className="h-full w-full" />
    </div>
  )
}

function RemotionSpeechPanel({
  cue,
  heading = false,
}: {
  cue: SpeechCue
  heading?: boolean
}) {
  const accentToneClass =
    cue.tone === 'lime'
      ? 'linear-gradient(90deg, #e9ff7a 0%, #5fef63 100%)'
      : cue.tone === 'rose'
        ? 'linear-gradient(90deg, #ffc0d6 0%, #ff7bb0 100%)'
        : cue.tone === 'ice'
          ? 'linear-gradient(90deg, #e7f6ff 0%, #a5dfff 100%)'
          : 'linear-gradient(90deg, #ffe6b8 0%, #ffb347 100%)'

  return (
    <div
      style={
        heading
          ? { maxWidth: 560 }
          : {
              maxWidth: 880,
              borderRadius: 24,
              border: '1px solid rgba(255,255,255,0.1)',
              background: 'linear-gradient(180deg, rgba(11,11,16,0.72) 0%, rgba(7,7,10,0.2) 100%)',
              padding: '12px 16px',
              boxShadow: '0 24px 60px -30px rgba(0,0,0,0.95)',
              backdropFilter: 'blur(18px)',
            }
      }
    >
      {cue.leadText ? (
        <div
          style={{
            color: 'white',
            fontSize: heading ? 62 : 30,
            fontWeight: heading ? 900 : 700,
            lineHeight: heading ? 0.92 : 1.02,
            letterSpacing: heading ? '-0.06em' : '-0.04em',
          }}
        >
          {cue.leadText}
        </div>
      ) : null}
      {cue.accentText ? (
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            marginTop: heading ? 10 : 6,
            borderRadius: 16,
            padding: '8px 14px',
            background: accentToneClass,
            color: '#111',
            fontSize: heading ? 74 : 38,
            fontWeight: 900,
            fontStyle: 'italic',
            lineHeight: heading ? 0.9 : 1,
            letterSpacing: '-0.06em',
            textDecoration: cue.treatment === 'underline' ? 'underline' : undefined,
            textDecorationThickness: cue.treatment === 'underline' ? '0.16em' : undefined,
            boxShadow: heading ? '0 20px 44px -28px rgba(255,179,71,0.55)' : undefined,
          }}
        >
          {cue.accentText}
        </div>
      ) : null}
      {cue.trailingText ? (
        <div
          style={{
            marginTop: heading ? 10 : 6,
            color: 'rgba(255,255,255,0.92)',
            fontSize: heading ? 24 : 19,
            fontWeight: heading ? 600 : 500,
            letterSpacing: heading ? '-0.02em' : '-0.01em',
          }}
        >
          {cue.trailingText}
        </div>
      ) : null}
    </div>
  )
}

function RemotionSafeZones() {
  return (
    <AbsoluteFill style={{ pointerEvents: 'none', zIndex: 20 }}>
      <div
        style={{
          position: 'absolute',
          left: '6%',
          right: '6%',
          bottom: '13%',
          height: '18%',
          borderRadius: 22,
          border: '1px dashed rgba(244,235,114,0.45)',
          background: 'rgba(244,235,114,0.03)',
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: '4.5%',
          right: '4.5%',
          top: '5.5%',
          bottom: '5.5%',
          borderRadius: 24,
          border: '1px dashed rgba(255,255,255,0.12)',
        }}
      />
    </AbsoluteFill>
  )
}

function cueVisibility(frame: number, fps: number, startMs: number, endMs: number) {
  const startFrame = msToFrame(startMs, fps)
  const endFrame = Math.max(startFrame + 1, msToFrame(endMs, fps))
  const duration = Math.max(1, endFrame - startFrame)
  const enterFrames = Math.min(CAPTION_ENTER_FRAMES, Math.max(1, Math.floor(duration / 2)))
  const exitFrames = Math.min(CAPTION_EXIT_FRAMES, Math.max(1, Math.floor(duration / 2)))
  const enter = interpolate(frame, [startFrame, startFrame + enterFrames], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })
  const exit = interpolate(frame, [endFrame - exitFrames, endFrame], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })

  return Math.max(0, Math.min(1, Math.min(enter, exit)))
}

function cueTimelineProgress(frame: number, fps: number, startMs: number, endMs: number) {
  const startFrame = msToFrame(startMs, fps)
  const endFrame = Math.max(startFrame + 1, msToFrame(endMs, fps))
  return interpolate(frame, [startFrame, endFrame], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })
}

function msToFrame(ms: number, fps: number) {
  return Math.round((ms / 1000) * fps)
}

function isCueActive(startMs: number, endMs: number, currentTimeMs: number, paddingMs = 0) {
  return currentTimeMs >= startMs - paddingMs && currentTimeMs <= endMs + paddingMs
}

function pickLatest<T extends { startMs: number }>(items: T[]) {
  if (items.length === 0) return null
  return [...items].sort((left, right) => right.startMs - left.startMs)[0] ?? null
}

function formatCounterValue(cue: CounterCue, value: number) {
  if (cue.format === 'currency') {
    return `${cue.prefix ?? '$'}${value.toLocaleString()}${cue.suffix ?? ''}`
  }
  if (cue.format === 'percent') {
    return `${cue.prefix ?? ''}${value.toLocaleString()}${cue.suffix || '%'}`
  }
  return `${cue.prefix ?? ''}${value.toLocaleString()}${cue.suffix ?? ''}`
}
