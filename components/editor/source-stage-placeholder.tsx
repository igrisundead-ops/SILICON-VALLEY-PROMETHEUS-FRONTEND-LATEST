'use client'

import * as React from 'react'
import { Plus } from 'lucide-react'
import { motion } from 'framer-motion'

import { InfinityTrailLoader } from '@/components/editor/infinity-trail-loader'
import { useStableReducedMotion } from '@/hooks/use-stable-reduced-motion'
import { cn } from '@/lib/utils'

export type SourceStageStatus = 'empty' | 'loading' | 'error'

interface SourceStagePlaceholderProps {
  status: SourceStageStatus
  isDragActive?: boolean
  onPickSource: () => void
  onDragOver: React.DragEventHandler<HTMLButtonElement>
  onDragLeave: React.DragEventHandler<HTMLButtonElement>
  onDrop: React.DragEventHandler<HTMLButtonElement>
}

export function SourceStagePlaceholder({
  status,
  isDragActive = false,
  onPickSource,
  onDragOver,
  onDragLeave,
  onDrop,
}: SourceStagePlaceholderProps) {
  const reduceMotion = useStableReducedMotion()
  const isLoading = status === 'loading'
  const isError = status === 'error'

  return (
    <button
      type="button"
      aria-label="Stage a source video"
      onClick={onPickSource}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      className={cn(
        'group relative flex h-full min-h-[clamp(250px,40vh,460px)] w-full overflow-hidden rounded-[18px] border bg-[linear-gradient(180deg,rgba(7,7,11,0.98)_0%,rgba(10,10,15,0.98)_100%)] text-left shadow-[0_18px_48px_-28px_rgba(0,0,0,0.9)] transition-[border-color,box-shadow,opacity,transform] duration-300 ease-out opacity-[0.84] hover:opacity-100',
        isDragActive
          ? 'border-[#9ff6e3]/34 shadow-[0_0_0_1px_rgba(159,246,227,0.16),0_24px_48px_-32px_rgba(159,246,227,0.2)]'
          : isError
            ? 'border-rose-400/28'
            : 'border-[#267dff]/18 hover:border-[#267dff]/30 hover:shadow-[0_22px_52px_-30px_rgba(38,125,255,0.22)]',
      )}
    >
      <div
        className={cn(
          'absolute inset-0 transition-opacity duration-300',
          'bg-[linear-gradient(180deg,rgba(255,255,255,0.03)_0%,rgba(255,255,255,0)_18%,rgba(0,0,0,0.35)_100%),radial-gradient(circle_at_18%_20%,rgba(38,125,255,0.12)_0%,rgba(38,125,255,0)_28%),radial-gradient(circle_at_82%_14%,rgba(159,246,227,0.08)_0%,rgba(159,246,227,0)_24%)]',
          'opacity-80 group-hover:opacity-100',
        )}
      />
      <div className="absolute inset-x-0 top-0 h-px bg-[linear-gradient(90deg,rgba(255,255,255,0)_0%,rgba(255,255,255,0.16)_50%,rgba(255,255,255,0)_100%)]" />
      <div className="absolute inset-x-10 bottom-0 h-px bg-[linear-gradient(90deg,rgba(255,255,255,0)_0%,rgba(159,246,227,0.12)_50%,rgba(255,255,255,0)_100%)] opacity-80 group-hover:opacity-100 transition-opacity duration-300" />

      <div className="relative z-10 flex w-full flex-1 items-center justify-center px-6">
        {isLoading ? (
          <InfinityTrailLoader
            label="Restoring source preview"
            subtitle="Rebuilding the media stage inside the editor."
            variant="stacked"
            className="w-full max-w-[360px]"
          />
        ) : (
          <motion.div
            aria-hidden
            className="relative grid size-14 place-items-center"
            animate={
              reduceMotion
                ? undefined
                : isDragActive
                  ? { scale: [1, 1.02, 1] }
                  : undefined
            }
            transition={
              reduceMotion || !isDragActive
                ? undefined
                : {
                    duration: 1.7,
                    repeat: Number.POSITIVE_INFINITY,
                    ease: 'easeInOut',
                  }
            }
          >
            <span
              aria-hidden
              className={cn(
                'absolute inset-[-35%] rounded-full blur-2xl transition-all duration-300',
                'bg-[radial-gradient(circle,rgba(38,125,255,0.24)_0%,rgba(38,125,255,0.12)_36%,rgba(38,125,255,0)_72%)]',
                'opacity-70 group-hover:opacity-100 group-hover:scale-110',
                isError && 'bg-[radial-gradient(circle,rgba(251,113,133,0.2)_0%,rgba(251,113,133,0.1)_36%,rgba(251,113,133,0)_72%)]',
                isDragActive && 'bg-[radial-gradient(circle,rgba(159,246,227,0.22)_0%,rgba(159,246,227,0.1)_36%,rgba(159,246,227,0)_72%)]',
              )}
            />
            <span
              aria-hidden
              className={cn(
                'absolute inset-[-16%] rounded-full blur-md transition-opacity duration-300',
                'bg-[radial-gradient(circle,rgba(255,255,255,0.12)_0%,rgba(255,255,255,0)_68%)]',
                'opacity-55 group-hover:opacity-90',
              )}
            />
            <Plus
              className={cn(
                'relative size-5 stroke-[2.2] text-white drop-shadow-[0_0_14px_rgba(255,255,255,0.28)] transition-transform duration-300 group-hover:scale-105',
              )}
            />
          </motion.div>
        )}
      </div>

      <div className="absolute inset-x-0 bottom-4 z-10 px-5 text-center">
        <p className="text-[12px] leading-5 text-white/40">
          {isLoading
            ? 'Waking the preview frame up for your staged source.'
            : 'Click to add a source video, or drop one here.'}
        </p>
      </div>
    </button>
  )
}
