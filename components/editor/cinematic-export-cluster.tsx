'use client'

import * as React from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowUpRight, Check, ChevronDown, Download, Link2, Plus } from 'lucide-react'

import { useStableReducedMotion } from '@/hooks/use-stable-reduced-motion'
import { cn } from '@/lib/utils'

interface CinematicExportClusterProps {
  className?: string
  onExport: () => void
}

interface PlatformOption {
  id: string
  name: string
  shortLabel: string
  subtitle: string
  publishLabel: string
  accent: string
  accentSoft: string
}

const PLATFORM_OPTIONS: PlatformOption[] = [
  {
    id: 'youtube',
    name: 'YouTube',
    shortLabel: 'YT',
    subtitle: 'Long-form drops and Shorts handoff',
    publishLabel: 'Queue master',
    accent: '#ff5a70',
    accentSoft: 'rgba(255, 90, 112, 0.22)',
  },
  {
    id: 'instagram',
    name: 'Instagram',
    shortLabel: 'IG',
    subtitle: 'Reels launch with cover-safe framing',
    publishLabel: 'Send reel',
    accent: '#ff8c63',
    accentSoft: 'rgba(255, 140, 99, 0.22)',
  },
  {
    id: 'x',
    name: 'X / Twitter',
    shortLabel: 'X',
    subtitle: 'Fast thread-ready uploads and teaser cuts',
    publishLabel: 'Post teaser',
    accent: '#79b8ff',
    accentSoft: 'rgba(121, 184, 255, 0.22)',
  },
  {
    id: 'tiktok',
    name: 'TikTok',
    shortLabel: 'TT',
    subtitle: 'Vertical publish flow with audio-first pacing',
    publishLabel: 'Drop vertical',
    accent: '#69f0d1',
    accentSoft: 'rgba(105, 240, 209, 0.2)',
  },
  {
    id: 'linkedin',
    name: 'LinkedIn',
    shortLabel: 'IN',
    subtitle: 'Professional clips with clean metadata handoff',
    publishLabel: 'Share cut',
    accent: '#7f9bff',
    accentSoft: 'rgba(127, 155, 255, 0.2)',
  },
]

const ORBIT_LAYOUT = [
  { x: 32, y: -28, scale: 0.96 },
  { x: 82, y: -2, scale: 1 },
  { x: 32, y: 24, scale: 0.94 },
] as const

const CONTROL_FONT_STYLE = {
  fontFamily: '"SF Pro Text","SF Pro Display",-apple-system,BlinkMacSystemFont,"Segoe UI","Helvetica Neue",Arial,sans-serif',
} satisfies React.CSSProperties

function PlatformLogo({ platformId, className }: { platformId: string; className?: string }) {
  switch (platformId) {
    case 'youtube':
      return (
        <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden="true">
          <rect x="3.5" y="6.5" width="17" height="11" rx="4" stroke="currentColor" strokeWidth="1.8" />
          <path d="M10 9.4 15.6 12 10 14.6V9.4Z" fill="currentColor" />
        </svg>
      )
    case 'instagram':
      return (
        <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden="true">
          <rect x="5" y="5" width="14" height="14" rx="4.4" stroke="currentColor" strokeWidth="1.8" />
          <circle cx="12" cy="12" r="3.1" stroke="currentColor" strokeWidth="1.8" />
          <circle cx="16.5" cy="7.6" r="1.1" fill="currentColor" />
        </svg>
      )
    case 'x':
      return (
        <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden="true">
          <path d="M6 5h3.3l4.2 5.5L18 5h1.8l-5.3 6.7 5.6 7.3h-3.3l-4.5-5.9L7.6 19H5.8l5.5-6.9L6 5Z" fill="currentColor" />
        </svg>
      )
    case 'tiktok':
      return (
        <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden="true">
          <path
            d="M13.7 5.2c1.1 1.8 2.4 2.8 4.1 3.1v2.4c-1.6-.1-2.9-.7-4.1-1.8v4.9a4.5 4.5 0 1 1-4.5-4.5c.4 0 .9.1 1.3.2V12a2.3 2.3 0 1 0 1 1.8V5.2h2.2Z"
            fill="currentColor"
          />
        </svg>
      )
    case 'linkedin':
      return (
        <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden="true">
          <circle cx="7.2" cy="7.4" r="1.4" fill="currentColor" />
          <path d="M6 10.2v7.3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          <path d="M11 17.5V10.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          <path d="M11 12.8c.7-1.4 1.8-2.1 3.3-2.1 2.1 0 3.4 1.4 3.4 3.8v3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      )
    default:
      return null
  }
}

export function CinematicExportCluster({ className, onExport }: CinematicExportClusterProps) {
  const prefersReducedMotion = useStableReducedMotion()
  const closeTimerRef = React.useRef<number | null>(null)
  const spotlightTimerRef = React.useRef<number | null>(null)
  const platformCardRefs = React.useRef<Record<string, HTMLDivElement | null>>({})
  const [isOpen, setIsOpen] = React.useState(false)
  const [connectedPlatforms, setConnectedPlatforms] = React.useState<Record<string, boolean>>(() =>
    Object.fromEntries(PLATFORM_OPTIONS.map((platform) => [platform.id, false])),
  )
  const [statusMessage, setStatusMessage] = React.useState('Hover the plus lobe to bring channels online.')
  const [activePlatformId, setActivePlatformId] = React.useState<string | null>(null)
  const [spotlightPlatformId, setSpotlightPlatformId] = React.useState<string | null>(null)

  const linkedCount = React.useMemo(
    () => Object.values(connectedPlatforms).filter(Boolean).length,
    [connectedPlatforms],
  )

  const clearCloseTimer = React.useCallback(() => {
    if (closeTimerRef.current !== null) {
      window.clearTimeout(closeTimerRef.current)
      closeTimerRef.current = null
    }
  }, [])

  const openTray = React.useCallback(() => {
    clearCloseTimer()
    setIsOpen(true)
  }, [clearCloseTimer])

  const describePlatformState = React.useCallback(
    (platform: PlatformOption) =>
      connectedPlatforms[platform.id]
        ? `${platform.name} is linked and ready for ${platform.publishLabel.toLowerCase()}.`
        : `${platform.name} is ready to link for direct publishing.`,
    [connectedPlatforms],
  )

  const focusPlatform = React.useCallback(
    (platform: PlatformOption) => {
      openTray()
      setActivePlatformId(platform.id)
      setStatusMessage(describePlatformState(platform))
    },
    [describePlatformState, openTray],
  )

  const scheduleClose = React.useCallback(() => {
    clearCloseTimer()
    closeTimerRef.current = window.setTimeout(() => {
      setIsOpen(false)
      setActivePlatformId(null)
    }, 220)
  }, [clearCloseTimer])

  React.useEffect(() => {
    return () => {
      clearCloseTimer()
      if (spotlightTimerRef.current !== null) {
        window.clearTimeout(spotlightTimerRef.current)
      }
    }
  }, [clearCloseTimer])

  const triggerSpotlight = React.useCallback((platformId: string) => {
    if (spotlightTimerRef.current !== null) {
      window.clearTimeout(spotlightTimerRef.current)
    }

    setSpotlightPlatformId(platformId)
    spotlightTimerRef.current = window.setTimeout(() => {
      setSpotlightPlatformId((current) => (current === platformId ? null : current))
      spotlightTimerRef.current = null
    }, 1400)
  }, [])

  const togglePlatformLink = React.useCallback((platform: PlatformOption) => {
    setConnectedPlatforms((prev) => {
      const nextConnected = !prev[platform.id]
      setStatusMessage(
        nextConnected
          ? `${platform.name} linked. This destination is ready for direct publishing.`
          : `${platform.name} disconnected. You can relink whenever you want.`,
      )
      return {
        ...prev,
        [platform.id]: nextConnected,
      }
    })
  }, [])

  const queuePlatformUpload = React.useCallback((platform: PlatformOption) => {
    setStatusMessage(`${platform.name} is staged for a cinematic handoff.`)
  }, [])

  const handleBlurCapture = React.useCallback((event: React.FocusEvent<HTMLDivElement>) => {
    const nextTarget = event.relatedTarget as Node | null
    if (nextTarget && event.currentTarget.contains(nextTarget)) return
    scheduleClose()
  }, [scheduleClose])

  const scrollToPlatformCard = React.useCallback(
    (platform: PlatformOption) => {
      focusPlatform(platform)
      triggerSpotlight(platform.id)

      const card = platformCardRefs.current[platform.id]
      if (!card) return

      window.requestAnimationFrame(() => {
        card.scrollIntoView({
          behavior: prefersReducedMotion ? 'auto' : 'smooth',
          block: 'center',
          inline: 'nearest',
        })
      })
    },
    [focusPlatform, prefersReducedMotion, triggerSpotlight],
  )

  return (
    <div
      className={cn('relative inline-flex items-center justify-end pr-[6.5rem] sm:pr-[6.75rem]', className)}
      style={CONTROL_FONT_STYLE}
      onMouseLeave={scheduleClose}
      onMouseEnter={clearCloseTimer}
      onFocusCapture={openTray}
      onBlurCapture={handleBlurCapture}
    >
      <AnimatePresence>
        {isOpen ? (
          <motion.div
            aria-hidden
            className="pointer-events-none fixed inset-0 z-0 bg-[radial-gradient(circle_at_78%_12%,rgba(255,255,255,0.14)_0%,rgba(255,255,255,0)_20%),linear-gradient(180deg,rgba(9,9,14,0.18)_0%,rgba(9,9,14,0.42)_100%)] backdrop-blur-[14px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: prefersReducedMotion ? 0 : 0.28, ease: 'easeOut' }}
          />
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {isOpen ? (
          <motion.div
            aria-hidden
            className="pointer-events-none absolute right-5 top-1/2 z-0 h-[9.5rem] w-[10.5rem] -translate-y-1/2 rounded-[999px] bg-[radial-gradient(circle_at_32%_48%,rgba(127,242,212,0.16)_0%,rgba(255,184,122,0.12)_30%,rgba(255,255,255,0)_70%)] blur-3xl"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.86 }}
            transition={{ duration: prefersReducedMotion ? 0 : 0.3, ease: 'easeOut' }}
          />
        ) : null}
      </AnimatePresence>

      <div className="relative z-10 inline-flex items-center rounded-full border border-[#ede7de]/72 bg-[#f5f1ea]/96 p-[4px] shadow-[0_28px_56px_-34px_rgba(0,0,0,0.72),0_10px_22px_-20px_rgba(255,255,255,0.8),inset_0_1px_0_rgba(255,255,255,0.92)]">
        <motion.div
          aria-hidden
          className="pointer-events-none absolute inset-[2px] rounded-full bg-[rgba(255,255,255,0.18)] backdrop-blur-[24px] backdrop-saturate-[1.35]"
          animate={{
            opacity: isOpen ? (activePlatformId ? 0.82 : 0.58) : 0,
            scale: isOpen ? 1 : 0.96,
          }}
          transition={{ duration: prefersReducedMotion ? 0 : 0.26, ease: 'easeOut' }}
        />
        <motion.div
          aria-hidden
          className="pointer-events-none absolute inset-y-[4px] left-[4px] rounded-full bg-white shadow-[0_14px_28px_-22px_rgba(0,0,0,0.42)]"
          animate={{
            width: isOpen ? 78 : 48,
            opacity: isOpen ? 1 : 0.96,
            scale: isOpen ? 1.02 : 1,
          }}
          transition={
            prefersReducedMotion
              ? { duration: 0 }
              : { type: 'spring', stiffness: 380, damping: 30, mass: 0.82 }
          }
        />
        <motion.div
          aria-hidden
          className="pointer-events-none absolute left-[4px] top-[4px] size-12 rounded-full bg-white/55 blur-[10px]"
          animate={{
            opacity: isOpen ? (activePlatformId ? 0.24 : 0.14) : 0,
            scale: activePlatformId ? 1.04 : 1,
          }}
          transition={{ duration: prefersReducedMotion ? 0 : 0.24, ease: 'easeOut' }}
        />
        <motion.div
          aria-hidden
          className="pointer-events-none absolute -inset-x-4 -inset-y-4 rounded-full bg-[radial-gradient(circle_at_18%_50%,rgba(255,255,255,0.92)_0%,rgba(255,255,255,0.18)_34%,rgba(255,255,255,0)_62%)] blur-2xl"
          animate={{
            opacity: isOpen ? 0.7 : 0.28,
            scaleX: isOpen ? 1.08 : 1,
          }}
          transition={{ duration: prefersReducedMotion ? 0 : 0.32, ease: 'easeOut' }}
        />

        <AnimatePresence>
          {isOpen
            ? PLATFORM_OPTIONS.slice(0, ORBIT_LAYOUT.length).map((platform, index) => {
                const orbit = ORBIT_LAYOUT[index]!
                const isOrbitActive = activePlatformId === platform.id
                return (
                  <motion.button
                    key={platform.id}
                    type="button"
                    aria-label={`Focus ${platform.name} publish controls`}
                    onMouseEnter={() => focusPlatform(platform)}
                    onFocus={() => focusPlatform(platform)}
                    onClick={() => scrollToPlatformCard(platform)}
                    className="absolute left-7 top-1/2 z-20 flex h-11 w-11 -translate-x-1/2 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full border border-white/16 bg-[#14141a]/94 text-white shadow-[0_18px_30px_-20px_rgba(0,0,0,0.85)] backdrop-blur-xl focus-visible:outline-none"
                    style={{
                      boxShadow: `0 18px 30px -18px rgba(0,0,0,0.82), 0 0 0 1px ${platform.accentSoft}`,
                      zIndex: isOrbitActive ? 28 : 22 + index,
                    }}
                    initial={{ opacity: 0, scale: 0.4, x: 10, y: 0, rotate: -14, filter: 'blur(12px)' }}
                    animate={{
                      opacity: 1,
                      scale: isOrbitActive ? orbit.scale + 0.06 : orbit.scale,
                      x: orbit.x,
                      y: orbit.y,
                      rotate: 0,
                      filter: 'blur(0px)',
                    }}
                    exit={{ opacity: 0, scale: 0.35, x: 10, y: 0, rotate: -10, filter: 'blur(10px)' }}
                    whileHover={
                      prefersReducedMotion
                        ? undefined
                        : {
                            scale: orbit.scale + 0.1,
                            y: orbit.y - 2,
                          }
                    }
                    whileTap={
                      prefersReducedMotion
                        ? undefined
                        : {
                            scale: orbit.scale - 0.06,
                          }
                    }
                    transition={{
                      duration: prefersReducedMotion ? 0 : 0.42,
                      delay: prefersReducedMotion ? 0 : index * 0.03,
                      ease: [0.22, 1, 0.36, 1],
                    }}
                  >
                    <PlatformLogo platformId={platform.id} className="size-4.5" />
                  </motion.button>
                )
              })
            : null}
        </AnimatePresence>

        <motion.button
          type="button"
          aria-label="Open destination publish options"
          onMouseEnter={openTray}
          onClick={() => setIsOpen((current) => !current)}
          className="relative z-10 flex size-12 items-center justify-center rounded-full text-[#121219] transition-transform duration-300 hover:scale-[1.02] focus-visible:outline-none"
          whileHover={prefersReducedMotion ? undefined : { scale: 1.03 }}
          whileTap={prefersReducedMotion ? undefined : { scale: 0.96 }}
        >
          <motion.div
            animate={{ rotate: isOpen ? 90 : 0, scale: isOpen ? 1.08 : 1 }}
            transition={{ duration: prefersReducedMotion ? 0 : 0.28, ease: 'easeOut' }}
          >
            <Plus className="size-4.5" />
          </motion.div>
        </motion.button>

        <div
          aria-hidden
          className="relative z-10 h-7 w-px rounded-full bg-[linear-gradient(180deg,rgba(120,111,103,0)_0%,rgba(120,111,103,0.42)_50%,rgba(120,111,103,0)_100%)]"
        />

        <motion.button
          type="button"
          onClick={onExport}
          className="relative z-10 inline-flex h-12 min-w-[8.5rem] items-center justify-between gap-3 rounded-full pl-3.5 pr-4 text-[15px] font-medium tracking-[-0.015em] text-[#16131a] transition-[color,transform] duration-300 hover:translate-x-[1px] hover:text-black focus-visible:outline-none"
          whileHover={prefersReducedMotion ? undefined : { x: 1 }}
          whileTap={prefersReducedMotion ? undefined : { scale: 0.985 }}
        >
          <span className="inline-flex items-center gap-2.5">
            <Download className="size-[15px]" />
            <span>Export</span>
          </span>
          <ChevronDown className="size-[15px] text-[#5e5854]" />
        </motion.button>
      </div>

      <AnimatePresence>
        {isOpen ? (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.96, filter: 'blur(10px)' }}
            animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
            exit={{ opacity: 0, y: -8, scale: 0.98, filter: 'blur(8px)' }}
            transition={{
              duration: prefersReducedMotion ? 0 : 0.34,
              ease: [0.22, 1, 0.36, 1],
            }}
            className="absolute right-0 top-[calc(100%+18px)] z-[60] w-[min(40rem,calc(100vw-2rem))] overflow-hidden rounded-[30px] border border-white/10 bg-[linear-gradient(180deg,rgba(16,16,23,0.98)_0%,rgba(9,9,14,1)_100%)] p-3 shadow-[0_42px_92px_-28px_rgba(0,0,0,0.9),0_18px_38px_-28px_rgba(115,107,255,0.4)] backdrop-blur-2xl"
          >
            <div
              aria-hidden
              className="pointer-events-none absolute -inset-6 rounded-[36px] bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.18)_0%,rgba(145,125,255,0.12)_24%,rgba(255,255,255,0)_62%)] blur-3xl"
            />
            <div className="relative max-h-[min(72vh,35rem)] overflow-y-auto rounded-[24px] border border-white/8 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.08)_0%,rgba(255,255,255,0)_42%),linear-gradient(180deg,rgba(255,255,255,0.05)_0%,rgba(255,255,255,0.02)_100%)] px-5 py-5 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
              <div
                aria-hidden
                className="pointer-events-none absolute -right-12 -top-16 h-36 w-36 rounded-full bg-[radial-gradient(circle,rgba(255,255,255,0.14)_0%,rgba(255,255,255,0)_68%)] blur-2xl"
              />
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="max-w-[19.5rem]">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.34em] text-white/42">Publish Relay</div>
                  <div className="mt-2.5 text-[1.65rem] font-medium leading-[1.08] tracking-[-0.03em] text-white">
                    Link a platform and stage the release.
                  </div>
                  <div className="mt-2.5 text-[14px] leading-6 text-white/56">{statusMessage}</div>
                </div>
                <div className="rounded-[22px] border border-white/10 bg-white/[0.04] px-4 py-3 text-right shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-white/34">Connections</div>
                  <div className="mt-1.5 text-[15px] font-medium tracking-[-0.01em] text-white/82">{linkedCount}/5 live</div>
                </div>
              </div>

              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                {PLATFORM_OPTIONS.map((platform, index) => {
                  const connected = connectedPlatforms[platform.id]
                  const isActive = activePlatformId === platform.id
                  const isSpotlit = spotlightPlatformId === platform.id

                  return (
                    <motion.div
                      key={platform.id}
                      className="group relative overflow-hidden rounded-[24px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.05)_0%,rgba(255,255,255,0.02)_100%)] px-5 py-5 cursor-pointer"
                      ref={(node) => {
                        platformCardRefs.current[platform.id] = node
                      }}
                      style={{
                        boxShadow: isSpotlit
                          ? `0 34px 54px -32px ${platform.accent}, inset 0 1px 0 rgba(255,255,255,0.08)`
                          : isActive
                            ? `0 24px 34px -30px ${platform.accent}`
                            : undefined,
                      }}
                      initial={{ opacity: 0, y: 10, scale: 0.985 }}
                      animate={{ opacity: 1, y: 0, scale: isSpotlit ? 1.015 : 1 }}
                      transition={{
                        duration: prefersReducedMotion ? 0 : 0.28,
                        delay: prefersReducedMotion ? 0 : index * 0.04,
                        ease: [0.22, 1, 0.36, 1],
                      }}
                      onMouseEnter={() => {
                        focusPlatform(platform)
                      }}
                      onMouseLeave={() => setActivePlatformId(null)}
                      onClick={() => focusPlatform(platform)}
                    >
                      <motion.div
                        aria-hidden
                        className="pointer-events-none absolute inset-0"
                        style={{
                          background: `radial-gradient(circle at top left, ${platform.accentSoft} 0%, rgba(255,255,255,0) 58%)`,
                        }}
                        animate={{
                          opacity: isSpotlit ? 1 : isActive ? 0.82 : 0,
                          scale: isSpotlit ? 1.03 : 1,
                        }}
                        transition={{ duration: prefersReducedMotion ? 0 : 0.34, ease: 'easeOut' }}
                      />
                      <motion.div
                        aria-hidden
                        className="pointer-events-none absolute inset-[1px] rounded-[23px] border"
                        style={{
                          borderColor: platform.accentSoft,
                        }}
                        animate={{
                          opacity: isSpotlit ? 1 : 0,
                          boxShadow: isSpotlit
                            ? `inset 0 1px 0 rgba(255,255,255,0.08), 0 0 0 1px ${platform.accentSoft}, 0 30px 42px -30px ${platform.accent}`
                            : 'none',
                        }}
                        transition={{ duration: prefersReducedMotion ? 0 : 0.42, ease: 'easeOut' }}
                      />
                      <div className="relative flex items-start justify-between gap-4">
                        <div className="flex min-w-0 flex-1 items-center gap-3.5">
                          <div
                            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-white/12 bg-[#0f1016] text-xs font-semibold tracking-[0.16em] text-white"
                            style={{
                              boxShadow: `inset 0 1px 0 rgba(255,255,255,0.06), 0 0 0 1px ${platform.accentSoft}`,
                            }}
                          >
                            <PlatformLogo platformId={platform.id} className="size-5 shrink-0" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="text-[15px] font-medium tracking-[-0.015em] text-white">{platform.name}</div>
                            <div className="mt-1.5 max-w-[15.75rem] text-[13px] leading-[1.55] text-white/48">
                              {platform.subtitle}
                            </div>
                          </div>
                        </div>
                        <div
                          className={cn(
                            'shrink-0 rounded-full border px-3.5 py-1.5 text-center text-[10px] font-semibold uppercase tracking-[0.18em] whitespace-nowrap',
                            connected
                              ? 'border-emerald-300/18 bg-emerald-300/10 text-emerald-100'
                              : 'border-white/10 bg-white/[0.05] text-white/42',
                          )}
                        >
                          {connected ? 'Linked' : 'Standby'}
                        </div>
                      </div>

                      <div className="relative mt-5 flex flex-wrap items-center gap-2.5">
                        <motion.button
                          type="button"
                          onClick={() => togglePlatformLink(platform)}
                          className={cn(
                            'group relative inline-flex h-10 items-center gap-2 overflow-hidden rounded-full px-4 text-[13px] font-medium tracking-[-0.01em] transition-all',
                            connected
                              ? 'border border-emerald-300/20 bg-emerald-300/10 text-emerald-50 hover:bg-emerald-300/14 hover:shadow-[0_14px_26px_-18px_rgba(110,231,183,0.55)]'
                              : 'border border-white/10 bg-white/[0.06] text-white/76 hover:bg-white/[0.10] hover:shadow-[0_16px_28px_-18px_rgba(255,255,255,0.2)]',
                          )}
                          whileHover={prefersReducedMotion ? undefined : { y: -1, scale: 1.01 }}
                          whileTap={prefersReducedMotion ? undefined : { scale: 0.98 }}
                        >
                          <span
                            aria-hidden
                            className={cn(
                              'pointer-events-none absolute inset-x-5 bottom-1 h-px translate-x-[-10px] rounded-full opacity-0 blur-[1px] transition-all duration-300 group-hover:translate-x-[10px] group-hover:opacity-100',
                              connected
                                ? 'bg-gradient-to-r from-transparent via-emerald-200/90 to-transparent'
                                : 'bg-gradient-to-r from-transparent via-white/80 to-transparent',
                            )}
                          />
                          {connected ? <Check className="size-3.5" /> : <Link2 className="size-3.5" />}
                          <span>{connected ? 'Account linked' : 'Link account'}</span>
                        </motion.button>
                        <motion.button
                          type="button"
                          disabled={!connected}
                          onClick={() => queuePlatformUpload(platform)}
                          className={cn(
                            'group relative inline-flex h-10 items-center gap-2 overflow-hidden rounded-full px-4 text-[13px] font-medium tracking-[-0.01em] transition-all',
                            connected
                              ? 'bg-white text-[#111116] hover:bg-white/92 hover:shadow-[0_16px_28px_-20px_rgba(255,255,255,0.45)]'
                              : 'bg-white/[0.04] text-white/28',
                          )}
                          whileHover={prefersReducedMotion || !connected ? undefined : { y: -1, scale: 1.01 }}
                          whileTap={prefersReducedMotion || !connected ? undefined : { scale: 0.98 }}
                        >
                          <span
                            aria-hidden
                            className={cn(
                              'pointer-events-none absolute inset-x-5 bottom-1 h-px rounded-full opacity-0 blur-[1px] transition-all duration-300',
                              connected ? 'bg-gradient-to-r from-transparent via-[#4c4a54]/70 to-transparent group-hover:translate-x-[10px] group-hover:opacity-100' : '',
                            )}
                          />
                          <ArrowUpRight className="size-3.5" />
                          <span>{platform.publishLabel}</span>
                        </motion.button>
                      </div>
                    </motion.div>
                  )
                })}
              </div>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  )
}
