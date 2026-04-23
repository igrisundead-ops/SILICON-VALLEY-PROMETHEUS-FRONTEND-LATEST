'use client'

import * as React from 'react'
import { motion, stagger, useAnimate } from 'framer-motion'

import { cn } from '@/lib/utils'

type TextGenerateEffectProps = {
  words: string
  className?: string
  textClassName?: string
  wordClassName?: string
  filter?: boolean
  duration?: number
  staggerDelay?: number
}

export function TextGenerateEffect({
  words,
  className,
  textClassName,
  wordClassName,
  filter = true,
  duration = 0.42,
  staggerDelay = 0.035,
}: TextGenerateEffectProps) {
  const [scope, animate] = useAnimate()
  const tokens = React.useMemo(() => words.split(/(\s+)/), [words])

  React.useEffect(() => {
    if (!scope.current) return

    void animate(
      'span[data-token="word"]',
      {
        opacity: 1,
        y: 0,
        filter: filter ? 'blur(0px)' : 'none',
      },
      {
        duration,
        delay: stagger(staggerDelay),
        ease: [0.16, 1, 0.3, 1],
      }
    )
  }, [animate, duration, filter, scope, staggerDelay, words])

  return (
    <div className={cn('font-medium', className)}>
      <motion.div ref={scope} className={cn('whitespace-pre-wrap leading-snug tracking-wide', textClassName)}>
        {tokens.map((token, index) => {
          if (!token.trim()) {
            return <React.Fragment key={`space-${index}`}>{token}</React.Fragment>
          }

          return (
            <motion.span
              key={`${token}-${index}`}
              data-token="word"
              className={cn('inline-block opacity-0', wordClassName)}
              style={{
                y: 6,
                filter: filter ? 'blur(10px)' : 'none',
              }}
            >
              {token}
            </motion.span>
          )
        })}
      </motion.div>
    </div>
  )
}
