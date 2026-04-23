'use client'

import { cn } from '@/lib/utils'

type LiquidEffectAnimationProps = {
  className?: string
  imageUrl?: string
  active?: boolean
  canvasClassName?: string
}

export function LiquidEffectAnimation({
  className,
  imageUrl = '/ui/popup/iphone-earpiece.png',
  active = true,
  canvasClassName,
}: LiquidEffectAnimationProps) {
  if (!active) return null

  return (
    <div className={cn('pointer-events-none absolute inset-0 overflow-hidden', className)}>
      <div
        className={cn(
          'absolute inset-0 overflow-hidden [transform:translateZ(0)]',
          canvasClassName,
        )}
      >
        <div className="liquid-film absolute inset-0" />
        <div
          className="absolute right-[-8%] top-[-14%] h-[78%] w-[46%] opacity-[0.09] mix-blend-screen"
          style={{
            backgroundImage: `linear-gradient(180deg,rgba(255,255,255,0.10),rgba(255,255,255,0)), url(${imageUrl})`,
            backgroundPosition: 'top right, top right',
            backgroundRepeat: 'no-repeat, no-repeat',
            backgroundSize: '100% 100%, contain',
          }}
        />
        <div className="liquid-lens liquid-lens-a absolute inset-[-18%_42%_26%_-14%]" />
      </div>

      <style jsx>{`
        .liquid-film {
          background:
            linear-gradient(180deg, rgba(255,255,255,0.045) 0%, rgba(255,255,255,0.016) 22%, rgba(255,255,255,0.01) 100%),
            radial-gradient(circle at 18% 18%, rgba(187, 155, 255, 0.12) 0%, transparent 32%),
            radial-gradient(circle at 82% 14%, rgba(255, 214, 166, 0.08) 0%, transparent 24%),
            linear-gradient(180deg, rgba(10,7,17,0.14) 0%, rgba(10,7,17,0.28) 100%);
        }

        .liquid-lens {
          border-radius: 42%;
          background:
            radial-gradient(circle at 35% 32%, rgba(255,255,255,0.18) 0%, rgba(255,255,255,0.06) 22%, rgba(255,255,255,0.015) 48%, transparent 72%),
            linear-gradient(145deg, rgba(255,255,255,0.10) 0%, rgba(255,255,255,0.02) 42%, rgba(0,0,0,0.08) 100%);
          opacity: 0.52;
          mix-blend-mode: screen;
          filter: blur(10px);
          will-change: transform, opacity;
        }

        .liquid-lens-a {
          animation: liquidDriftA 12s cubic-bezier(0.22, 1, 0.36, 1) infinite alternate;
        }

        @keyframes liquidDriftA {
          0% {
            transform: translate3d(-2%, -1%, 0) scale(1) rotate(-2deg);
          }
          50% {
            transform: translate3d(2%, 2%, 0) scale(1.03) rotate(1deg);
          }
          100% {
            transform: translate3d(5%, -1%, 0) scale(1.05) rotate(3deg);
          }
        }
      `}</style>
    </div>
  )
}
