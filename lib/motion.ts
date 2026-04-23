import type { Variants } from 'framer-motion'

export const cinematicEase = [0.22, 1, 0.36, 1] as const

type RevealVariantOptions = {
  delay?: number
  distance?: number
  scale?: number
  blur?: number
  duration?: number
  exitDistance?: number
  exitBlur?: number
}

type PopVariantOptions = {
  delay?: number
  scale?: number
  distance?: number
  blur?: number
  duration?: number
}

export function buildRevealVariants({
  delay = 0,
  distance = 18,
  scale = 0.985,
  blur = 10,
  duration = 0.36,
  exitDistance,
  exitBlur,
}: RevealVariantOptions = {}): Variants {
  const resolvedExitDistance = exitDistance ?? Math.max(10, Math.round(distance * 0.7))
  const resolvedExitBlur = exitBlur ?? Math.max(6, Math.round(blur * 0.8))

  return {
    hidden: {
      opacity: 0,
      y: distance,
      scale,
      filter: `blur(${blur}px)`,
    },
    visible: {
      opacity: 1,
      y: 0,
      scale: 1,
      filter: 'blur(0px)',
      transition: {
        duration,
        delay,
        ease: cinematicEase,
      },
    },
    exit: {
      opacity: 0,
      y: -resolvedExitDistance,
      scale: Math.max(0.96, scale),
      filter: `blur(${resolvedExitBlur}px)`,
      transition: {
        duration: Math.max(0.2, duration * 0.82),
        ease: cinematicEase,
      },
    },
  }
}

export function buildPopVariants({
  delay = 0,
  scale = 0.72,
  distance = 10,
  blur = 12,
  duration = 0.28,
}: PopVariantOptions = {}): Variants {
  return {
    hidden: {
      opacity: 0,
      scale,
      x: distance,
      y: -distance,
      filter: `blur(${blur}px)`,
    },
    visible: {
      opacity: 1,
      scale: 1,
      x: 0,
      y: 0,
      filter: 'blur(0px)',
      transition: {
        type: 'spring',
        stiffness: 320,
        damping: 26,
        mass: 0.86,
        delay,
      },
    },
    exit: {
      opacity: 0,
      scale: Math.max(0.82, scale + 0.06),
      x: distance * 0.55,
      y: -distance * 0.55,
      filter: `blur(${Math.max(6, Math.round(blur * 0.75))}px)`,
      transition: {
        duration: Math.max(0.18, duration * 0.8),
        ease: cinematicEase,
      },
    },
  }
}
