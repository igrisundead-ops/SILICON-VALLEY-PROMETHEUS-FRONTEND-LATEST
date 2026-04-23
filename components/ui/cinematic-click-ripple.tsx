'use client'

import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { useEffect, useRef, useState } from 'react'

type Ripple = {
  id: number
  x: number
  y: number
  size: number
}

const INTERACTIVE_SELECTOR = [
  'button',
  'a[href]',
  '[role="button"]',
  'input[type="button"]',
  'input[type="submit"]',
  '[data-click-ripple]',
].join(', ')

export function CinematicClickRipple() {
  const prefersReducedMotion = useReducedMotion() ?? false
  const [ripples, setRipples] = useState<Ripple[]>([])
  const nextIdRef = useRef(0)

  useEffect(() => {
    if (prefersReducedMotion) return

    const handlePointerDown = (event: PointerEvent) => {
      if (event.button !== 0) return

      const target = event.target
      if (!(target instanceof Element)) return

      const interactive = target.closest(INTERACTIVE_SELECTOR)
      if (!(interactive instanceof HTMLElement)) return
      if (interactive.dataset.noRipple === 'true') return
      if (interactive.matches(':disabled,[aria-disabled="true"]')) return

      const rect = interactive.getBoundingClientRect()
      const originX = Number.isFinite(event.clientX) ? event.clientX : rect.left + rect.width / 2
      const originY = Number.isFinite(event.clientY) ? event.clientY : rect.top + rect.height / 2
      const size = Math.min(Math.max(Math.max(rect.width, rect.height) * 0.95, 56), 168)
      const id = nextIdRef.current++

      setRipples((current) => [...current.slice(-10), { id, x: originX, y: originY, size }])

      window.setTimeout(() => {
        setRipples((current) => current.filter((ripple) => ripple.id !== id))
      }, 760)
    }

    document.addEventListener('pointerdown', handlePointerDown, true)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown, true)
    }
  }, [prefersReducedMotion])

  if (prefersReducedMotion) return null

  return (
    <div className="pointer-events-none fixed inset-0 z-[160] overflow-hidden">
      <AnimatePresence>
        {ripples.map((ripple) => (
          <motion.div
            key={ripple.id}
            className="absolute -translate-x-1/2 -translate-y-1/2"
            style={{
              left: ripple.x,
              top: ripple.y,
              width: ripple.size,
              height: ripple.size,
            }}
            initial={{ opacity: 0.34, scale: 0.16 }}
            animate={{ opacity: 0, scale: 1.85 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.72, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="absolute inset-0 rounded-full bg-[radial-gradient(circle,rgba(255,255,255,0.24)_0%,rgba(197,170,255,0.14)_26%,rgba(128,96,220,0.10)_46%,rgba(128,96,220,0.04)_60%,transparent_78%)] blur-[1px]" />
            <div className="absolute inset-[18%] rounded-full border border-white/18" />
            <div className="absolute inset-[34%] rounded-full border border-white/14" />
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}
