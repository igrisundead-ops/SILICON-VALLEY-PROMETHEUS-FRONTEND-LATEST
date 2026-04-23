'use client'

import * as React from 'react'
import { Player, type PlayerRef } from '@remotion/player'

import { CinematicRemotionComposition, type CinematicRemotionCompositionProps } from '@/components/remotion/cinematic-composition'

type RemotionCinematicPlayerProps = CinematicRemotionCompositionProps & {
  durationInFrames: number
  fps?: number
  onFrameChange?: (frame: number) => void
  className?: string
}

export function RemotionCinematicPlayer({
  durationInFrames,
  fps = 30,
  onFrameChange,
  className,
  ...inputProps
}: RemotionCinematicPlayerProps) {
  const playerRef = React.useRef<PlayerRef>(null)

  React.useEffect(() => {
    const player = playerRef.current
    if (!player || !onFrameChange) return

    const handleFrameUpdate = (event: { detail: { frame: number } }) => {
      onFrameChange(event.detail.frame)
    }

    player.addEventListener('frameupdate', handleFrameUpdate)
    onFrameChange(player.getCurrentFrame())

    return () => {
      player.removeEventListener('frameupdate', handleFrameUpdate)
    }
  }, [onFrameChange])

  return (
    <Player
      ref={playerRef}
      component={CinematicRemotionComposition}
      inputProps={inputProps}
      durationInFrames={durationInFrames}
      compositionWidth={1920}
      compositionHeight={1080}
      fps={fps}
      controls
      clickToPlay
      doubleClickToFullscreen
      spaceKeyToPlayOrPause
      style={{ width: '100%', height: '100%' }}
      className={className}
      acknowledgeRemotionLicense
      initiallyShowControls
      moveToBeginningWhenEnded
      showPosterWhenPaused={false}
      overflowVisible={false}
      errorFallback={({ error }) => (
        <div className="grid h-full w-full place-items-center bg-black text-center text-white/72">
          <div className="max-w-[360px] rounded-[20px] border border-white/10 bg-white/[0.03] px-6 py-5">
            <div className="text-[11px] uppercase tracking-[0.24em] text-white/38">Remotion Preview</div>
            <div className="mt-3 text-sm leading-6 text-white/72">{error.message}</div>
          </div>
        </div>
      )}
    />
  )
}
